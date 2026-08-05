import { getAdminDatabase } from '../../utils/firebase-admin'
import { OwnFoodSaveSchema } from '../../types/schemas'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { checkPremiumStatus } from '../../utils/license'
import { isCommunityFoodHidden, isShareableSource } from '../../utils/community-food'
import { storedNumberEquals } from '../../utils/numeric'
import { normalizeFoodName } from '../../../shared/utils/material-food'
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

// Check for duplicate community foods
async function checkDuplicateCommunityFood(
  db: ReturnType<typeof getAdminDatabase>,
  name: string,
  phe: number,
  language: string
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
  const { locale, ...foodData } = await validateBody(event, OwnFoodSaveSchema)

  // Where the values came from decides whether they may be published. The tools
  // that can't share hide the option, so this is the backstop rather than a
  // message a user normally runs into. Checked before anything is written, so a
  // rejected share leaves no own food behind either.
  if (foodData.shared && !isShareableSource(foodData.source)) {
    throw createError({
      statusCode: 400,
      message: 'These values may not be shared with the community',
      data: { code: 'source-not-shareable' }
    })
  }

  const db = getAdminDatabase()
  const isPremium = await checkPremiumStatus(userId)
  const ownFoodRef = db.ref(`/${userId}/ownFood`)

  const ownFoodSnapshot = await ownFoodRef.once('value')
  const existingFoods = ownFoodSnapshot.val() as Record<
    string,
    {
      name: string
      phe: number
      shared?: boolean
      source?: string | null
      sourceId?: string | null
    }
  > | null

  // Scanning the same product twice is a normal thing to do — the second scan
  // is the same food, not a new one. Where the source identifies the product
  // (a barcode), that is answered here rather than by a 409 the user has to
  // interpret: the existing entry is reported back untouched, and the caller
  // logs the diary entry it was really after. Values that moved on since (Open
  // Food Facts is edited by its users) are deliberately not written over the
  // entry the user already has — editing it is theirs to do.
  if (existingFoods && foodData.source && foodData.sourceId) {
    const existing = Object.entries(existingFoods).find(
      ([, food]) => food.source === foodData.source && food.sourceId === foodData.sourceId
    )
    if (existing) {
      return {
        success: true,
        key: existing[0],
        alreadyExists: true
      }
    }
  }

  // Duplicate = same name (case-insensitive) AND exact same phe value,
  // mirroring the community duplicate rule
  if (existingFoods) {
    const normalizedName = normalizeFoodName(foodData.name)
    const isDuplicate = Object.values(existingFoods).some(
      (food) =>
        normalizeFoodName(food.name) === normalizedName &&
        storedNumberEquals(food.phe, foodData.phe)
    )
    if (isDuplicate) {
      throw createError({
        statusCode: 409,
        message: 'A similar food already exists in your own foods',
        data: { code: 'duplicate-own-food' }
      })
    }
  }

  // Check limit based on premium status (shared foods don't count towards limit)
  if (!isPremium && existingFoods) {
    // Count only non-shared foods
    const nonSharedCount = Object.values(existingFoods).filter((food) => !food.shared).length

    if (nonSharedCount >= 50) {
      throw createError({
        statusCode: 403,
        message: 'Own food limit reached. Upgrade to premium for unlimited entries.',
        data: { code: 'limit-reached' }
      })
    }
  }

  let communityKey: string | null

  // If sharing to community, create community food entry
  if (foodData.shared) {
    const language = getLanguage(event, locale)

    // Check for duplicates
    const isDuplicate = await checkDuplicateCommunityFood(db, foodData.name, foodData.phe, language)
    if (isDuplicate) {
      throw createError({
        statusCode: 409,
        message: 'A similar food already exists in the community database',
        data: { code: 'duplicate-community-food' }
      })
    }

    // Create the own food entry first to get the key
    const newOwnFoodRef = ownFoodRef.push()
    const ownFoodKey = newOwnFoodRef.key!

    // Create community food entry
    const communityFoodRef = db.ref('communityFoods').push()
    communityKey = communityFoodRef.key

    const now = Date.now()
    const communityFoodData = {
      name: foodData.name,
      icon: foodData.icon || null,
      emoji: foodData.emoji || null,
      phe: foodData.phe,
      kcal: foodData.kcal,
      note: foodData.note || null,
      // Provenance travels with the published copy: it is what tells everyone
      // else in food search how the values were arrived at, and it carries the
      // nutrients the contributor's food has beyond Phe and kcal.
      source: foodData.source || null,
      sourceId: foodData.sourceId || null,
      factor: foodData.factor ?? null,
      nutrients: foodData.nutrients || null,
      ...(foodData.materiallyEdited === true && { materiallyEdited: true }),
      language,
      contributorId: userId,
      ownFoodKey,
      createdAt: now,
      updatedAt: now,
      likes: 0,
      dislikes: 0,
      score: 0,
      usageCount: 0
    }

    // Write both atomically (multi-location update) so a failed write can't
    // leave an orphaned community food without its backing own-food entry.
    await db.ref().update({
      [`${userId}/ownFood/${ownFoodKey}`]: {
        ...foodData,
        communityKey,
        createdAt: foodData.createdAt ?? now,
        updatedAt: foodData.updatedAt ?? now
      },
      [`communityFoods/${communityKey}`]: communityFoodData
    })

    return {
      success: true,
      key: ownFoodKey,
      communityKey
    }
  }

  // Not shared - just save the own food. Timestamps are server-owned; client
  // values are honored only so undo-restore can keep the original ones.
  const now = Date.now()
  const newRef = ownFoodRef.push()
  await newRef.set({
    ...foodData,
    communityKey: null,
    createdAt: foodData.createdAt ?? now,
    updatedAt: foodData.updatedAt ?? now
  })

  return {
    success: true,
    key: newRef.key
  }
})
