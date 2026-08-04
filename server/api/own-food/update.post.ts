import { getAdminDatabase } from '../../utils/firebase-admin'
import { OwnFoodUpdateSchema } from '../../types/schemas'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { isCommunityFoodHidden, isShareableSource } from '../../utils/community-food'
import { storedNumberEquals } from '../../utils/numeric'
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

  // Same duplicate rule as on save — same name (case-insensitive) and the exact
  // same Phe value. Saving guards against creating a second copy, this guards
  // against editing one food into a copy of another, which reaches the same
  // state by a different route.
  //
  // Only an edit that moves those two values can do that, so only such an edit
  // is checked. Everything else — unsharing, a note, an emoji, kcal — goes
  // through untouched, including on an entry that already collides with another
  // one: duplicate pairs exist from before this check did, and refusing to
  // unshare a food over a name the user didn't touch would be a dead end rather
  // than a guard. Renaming the entry back out of the collision stays possible
  // for the same reason.
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

  const wasShared = ownFood.shared === true
  const willBeShared = data.shared === true
  const existingCommunityKey = ownFood.communityKey || null

  // Original provenance is immutable. The client may edit nutrients, but it
  // cannot turn an AI estimate into a manual food by rewriting its source or
  // erase the product id and factor that explain where it began.
  const nutrients = data.nutrients !== undefined ? data.nutrients : (ownFood.nutrients ?? null)
  const materialChange = hasMaterialFoodChange(ownFood, { ...data, nutrients })
  const materiallyEdited = ownFood.materiallyEdited === true || materialChange
  const provenance = {
    source: (ownFood.source ?? null) as string | null,
    sourceId: (ownFood.sourceId ?? null) as string | null,
    factor: (ownFood.factor ?? null) as number | null,
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

  // Handle sharing state changes
  if (!wasShared && willBeShared) {
    // Newly sharing - create community food entry
    const language = getLanguage(event, locale)

    // Check for duplicates
    const isDuplicate = await checkDuplicateCommunityFood(db, data.name, data.phe, language)
    if (isDuplicate) {
      throw createError({
        statusCode: 409,
        message: 'A similar food already exists in the community database',
        data: { code: 'duplicate-community-food' }
      })
    }

    const communityFoodRef = db.ref('communityFoods').push()
    communityKey = communityFoodRef.key

    const now = Date.now()
    const communityFoodData = {
      name: data.name,
      icon: data.icon || null,
      emoji: data.emoji || null,
      phe: data.phe,
      kcal: data.kcal,
      note: data.note || null,
      // See save.post.ts: provenance is what food search shows about a
      // published food's origin
      ...provenance,
      language,
      contributorId: userId,
      ownFoodKey: entryKey,
      createdAt: now,
      updatedAt: now,
      likes: 0,
      dislikes: 0,
      score: 0,
      usageCount: 0
    }

    writes[`communityFoods/${communityKey}`] = communityFoodData
  } else if (wasShared && !willBeShared) {
    // Unsharing - remove community food entry (voterIds deleted automatically as child)
    if (existingCommunityKey) {
      writes[`communityFoods/${existingCommunityKey}`] = null
    }
    communityKey = null
  } else if (wasShared && willBeShared && existingCommunityKey) {
    // Still shared - update community food entry
    const communityFoodRef = db.ref(`communityFoods/${existingCommunityKey}`)
    const communityFoodSnapshot = await communityFoodRef.once('value')
    const existingCommunityFood = communityFoodSnapshot.val()

    if (existingCommunityFood) {
      // Votes endorse the visible food identity and all nutritional values.
      // Formatting-only name edits do not change that identity.
      const nameChanged =
        normalizeFoodName(existingCommunityFood.name) !== normalizeFoodName(data.name)
      const pheChanged = !storedNumberEquals(existingCommunityFood.phe, data.phe)
      const communityMaterialChange = hasMaterialFoodChange(existingCommunityFood, {
        ...data,
        nutrients
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
          existingCommunityFood.language || getLanguage(event, locale),
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
        // Reset votes when the food identity or nutritional content changes.
        updateData.likes = 0
        updateData.dislikes = 0
        updateData.score = 0
        updateData.voterIds = null // Clear all votes
      }

      // Field by field rather than as a whole node: the votes, the usage count
      // and the language are not in this map and have to survive the write.
      for (const [field, value] of Object.entries(updateData)) {
        writes[`communityFoods/${existingCommunityKey}/${field}`] = value
      }
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
