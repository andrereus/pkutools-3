import { getAdminDatabase } from '../../utils/firebase-admin'
import { OwnFoodUpdateSchema } from '../../types/schemas'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { isCommunityFoodHidden, isShareableSource } from '../../utils/community-food'
import { storedNumberEquals } from '../../utils/numeric'
import { queueCommunityFoodCommentRemoval } from '../../utils/community-food-comment'
import { hasMaterialFoodChange, normalizeFoodName } from '../../../shared/utils/material-food'
import type { H3Event } from 'h3'

// Helper to get user's language from request body or Accept-Language header (fallback)
function getLanguage(event: H3Event, bodyLocale?: string): 'en' | 'de' | 'es' | 'fr' {
  // Prefer locale from request body (from frontend i18n)
  if (bodyLocale && ['en', 'de', 'es', 'fr'].includes(bodyLocale)) {
    return bodyLocale as 'en' | 'de' | 'es' | 'fr'
  }

  // Fallback to Accept-Language header
  const acceptLanguage = getHeader(event, 'accept-language') || ''
  const supportedLanguages = ['en', 'de', 'es', 'fr'] as const
  for (const lang of supportedLanguages) {
    if (acceptLanguage.toLowerCase().includes(lang)) {
      return lang
    }
  }
  return 'en'
}

// Helper to normalize string for duplicate comparison
// Check for duplicate community foods (excluding a specific key)
async function checkDuplicateCommunityFood(
  db: ReturnType<typeof getAdminDatabase>,
  name: string,
  phe: number,
  language: string,
  excludeKey?: string
): Promise<boolean> {
  const communityFoodsSnapshot = await db
    .ref('communityFoods')
    .orderByChild('language')
    .equalTo(language)
    .once('value')

  const foods = communityFoodsSnapshot.val()
  if (!foods) return false

  const normalizedName = normalizeFoodName(name)
  for (const key of Object.keys(foods)) {
    if (key === excludeKey) continue
    const existing = foods[key]
    // Skip hidden foods (based on score) - they shouldn't block new submissions
    const score = (existing.likes || 0) - (existing.dislikes || 0)
    if (isCommunityFoodHidden(score)) continue
    // Duplicate = same name (case-insensitive) AND exact same phe value
    if (
      normalizeFoodName(existing.name) === normalizedName &&
      storedNumberEquals(existing.phe, phe)
    ) {
      return true
    }
  }
  return false
}

export default defineAuthedHandler(async ({ event, userId }) => {
  const { entryKey, locale, data } = await validateBody(event, OwnFoodUpdateSchema)

  const db = getAdminDatabase()
  const ownFoodRef = db.ref(`/${userId}/ownFood/${entryKey}`)
  const ownFoodSnapshot = await ownFoodRef.once('value')
  const ownFood = ownFoodSnapshot.val()

  if (!ownFood) {
    throw createError({
      statusCode: 404,
      message: 'Own food entry not found'
    })
  }

  // Only name and Phe changes can introduce a duplicate. Keep unrelated edits
  // independent of duplicate validation.
  const normalizedName = normalizeFoodName(data.name)
  const identityChanged =
    normalizeFoodName(ownFood.name) !== normalizedName || !storedNumberEquals(ownFood.phe, data.phe)

  if (identityChanged) {
    const allOwnFoodSnapshot = await db.ref(`/${userId}/ownFood`).once('value')
    const allOwnFood = (allOwnFoodSnapshot.val() || {}) as Record<
      string,
      { name: string; phe: number | string }
    >
    // The entry being edited is not its own duplicate
    const isOwnDuplicate = Object.entries(allOwnFood).some(
      ([key, food]) =>
        key !== entryKey &&
        normalizeFoodName(food.name) === normalizedName &&
        storedNumberEquals(food.phe, data.phe)
    )
    if (isOwnDuplicate) {
      throw createError({
        statusCode: 409,
        message: 'A similar food already exists in your own foods',
        data: { code: 'duplicate-own-food' }
      })
    }
  }

  const willBeShared = data.shared === true
  const existingCommunityKey =
    typeof ownFood.communityKey === 'string' && ownFood.communityKey ? ownFood.communityKey : null

  // Source fields are immutable; omitted conversion fields retain stored values.
  const nutrients = data.nutrients !== undefined ? data.nutrients : (ownFood.nutrients ?? null)
  const factor = data.factor !== undefined ? data.factor : (ownFood.factor ?? null)
  const materialChange = hasMaterialFoodChange(ownFood, { ...data, nutrients, factor })
  const materiallyEdited = ownFood.materiallyEdited === true || materialChange
  const provenance = {
    source: (ownFood.source ?? null) as string | null,
    sourceId: (ownFood.sourceId ?? null) as string | null,
    factor: factor as number | null,
    nutrients: nutrients as Record<string, unknown> | null,
    ...(materiallyEdited && { materiallyEdited: true })
  }

  // Same backstop as on save: the client hides the option, this refuses it.
  if (willBeShared && !isShareableSource(provenance.source)) {
    throw createError({
      statusCode: 400,
      message: 'These values may not be shared with the community',
      data: { code: 'source-not-shareable' }
    })
  }

  let communityKey: string | null = existingCommunityKey

  // Both records describe the same food, so they are written as one
  // multi-location update at the root: Realtime Database applies it atomically,
  // and a failure leaves neither a published food without its own food nor an
  // own food claiming a share that was never published. Everything below fills
  // this map; nothing writes on its own.
  const writes: Record<string, unknown> = {}

  // A community pointer is a destructive/update target only when both records
  // agree on the relationship. Older interrupted writes can point at a record
  // that no longer exists; malformed data must never let one user's update
  // modify or delete somebody else's contribution.
  let existingCommunityFood: Record<string, unknown> | null = null
  let hasValidCommunityLink = false
  if (existingCommunityKey) {
    const snapshot = await db.ref(`communityFoods/${existingCommunityKey}`).once('value')
    const candidate = snapshot.val() as Record<string, unknown> | null
    if (candidate?.contributorId === userId && candidate?.ownFoodKey === entryKey) {
      existingCommunityFood = candidate
      hasValidCommunityLink = true
    }
  }

  const queueNewCommunityFood = async () => {
    const language = getLanguage(event, locale)
    const isDuplicate = await checkDuplicateCommunityFood(db, data.name, data.phe, language)
    if (isDuplicate) {
      throw createError({
        statusCode: 409,
        message: 'A similar food already exists in the community database',
        data: { code: 'duplicate-community-food' }
      })
    }

    const newCommunityKey = db.ref('communityFoods').push().key!
    const now = Date.now()
    communityKey = newCommunityKey
    writes[`communityFoods/${newCommunityKey}`] = {
      name: data.name,
      icon: data.icon || null,
      emoji: data.emoji || null,
      phe: data.phe,
      kcal: data.kcal,
      note: data.note || null,
      ...provenance,
      language,
      contributorId: userId,
      ownFoodKey: entryKey,
      createdAt: now,
      updatedAt: now,
      likes: 0,
      dislikes: 0,
      score: 0,
      usageCount: 0,
      commentCount: 0
    }
  }

  // Handle sharing state changes
  if (willBeShared && !hasValidCommunityLink) {
    // Publish a new food, or repair an old shared flag whose public copy is
    // missing/mismatched. The own-food pointer changes in the same root update.
    await queueNewCommunityFood()
  } else if (!willBeShared) {
    // Remove the public copy only when ownership was verified. A missing or
    // foreign target is left untouched while the broken local pointer clears.
    if (existingCommunityKey && hasValidCommunityLink) {
      writes[`communityFoods/${existingCommunityKey}`] = null
      queueCommunityFoodCommentRemoval(existingCommunityKey, writes)
    }
    communityKey = null
  } else if (
    willBeShared &&
    existingCommunityKey &&
    hasValidCommunityLink &&
    existingCommunityFood
  ) {
    // Still shared - update community food entry
    // Votes endorse the visible food identity and all nutritional values.
    // Formatting-only name edits do not change that identity.
    const nameChanged =
      normalizeFoodName(existingCommunityFood.name) !== normalizeFoodName(data.name)
    const pheChanged = !storedNumberEquals(existingCommunityFood.phe, data.phe)
    const communityMaterialChange = hasMaterialFoodChange(existingCommunityFood, {
      ...data,
      nutrients,
      factor
    })

    // Publishing checks for a duplicate, so editing a published food has to
    // check too — otherwise renaming one onto another is the way past it. The
    // language is the one it was published in, not the app's current locale,
    // which is the set it would collide with. Checked before anything is
    // written, so a rejected edit changes neither copy.
    if (nameChanged || pheChanged) {
      const isDuplicate = await checkDuplicateCommunityFood(
        db,
        data.name,
        data.phe,
        (existingCommunityFood.language as string | undefined) || getLanguage(event, locale),
        existingCommunityKey
      )
      if (isDuplicate) {
        throw createError({
          statusCode: 409,
          message: 'A similar food already exists in the community database',
          data: { code: 'duplicate-community-food' }
        })
      }
    }

    const updateData: Record<string, unknown> = {
      name: data.name,
      icon: data.icon || null,
      emoji: data.emoji || null,
      phe: data.phe,
      kcal: data.kcal,
      note: data.note || null,
      // Original provenance remains attached; materiallyEdited says that the
      // current snapshot has subsequently diverged from it.
      ...provenance,
      updatedAt: Date.now()
    }

    if (communityMaterialChange) {
      // Votes and comments refer to the previous food identity/values. Reset
      // both through the same material-change boundary so feedback never
      // describes a version that is no longer visible.
      updateData.likes = 0
      updateData.dislikes = 0
      updateData.score = 0
      updateData.voterIds = null // Clear all votes
      updateData.commentCount = 0
      queueCommunityFoodCommentRemoval(existingCommunityKey, writes)
    }

    // Field by field rather than as a whole node: the votes, the usage count
    // and the language are not in this map and have to survive the write.
    for (const [field, value] of Object.entries(updateData)) {
      writes[`communityFoods/${existingCommunityKey}/${field}`] = value
    }
  }

  // The own food, also field by field, so it keeps merge semantics: the edit
  // form sends no provenance, and what it leaves out has to stay on the record.
  // The stored createdAt wins over anything the client sent, and a legacy entry
  // stays without one.
  const ownFoodUpdate: Record<string, unknown> = {
    ...data,
    ...provenance,
    communityKey,
    ...(ownFood.createdAt != null && { createdAt: ownFood.createdAt }),
    updatedAt: Date.now()
  }
  for (const [field, value] of Object.entries(ownFoodUpdate)) {
    // An absent optional field is not a field to clear
    if (value !== undefined) writes[`${userId}/ownFood/${entryKey}/${field}`] = value
  }

  await db.ref().update(writes)

  return {
    success: true,
    key: entryKey,
    communityKey
  }
})
