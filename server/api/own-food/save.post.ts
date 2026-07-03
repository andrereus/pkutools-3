import { getAdminDatabase } from '../../utils/firebase-admin'
import { OwnFoodSaveSchema } from '../../types/schemas'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { checkPremiumStatus } from '../../utils/license'
import { isCommunityFoodHidden } from '../../utils/community-food'
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
function normalizeString(str: string): string {
  return str.toLowerCase().trim()
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

  const normalizedName = normalizeString(name)
  for (const key of Object.keys(foods)) {
    const existing = foods[key]
    // Skip hidden foods (based on score) - they shouldn't block new submissions
    const score = (existing.likes || 0) - (existing.dislikes || 0)
    if (isCommunityFoodHidden(score)) continue
    // Duplicate = same name (case-insensitive) AND exact same phe value
    if (normalizeString(existing.name) === normalizedName && existing.phe === phe) {
      return true
    }
  }
  return false
}

export default defineAuthedHandler(async ({ event, userId }) => {
  const { locale, ...foodData } = await validateBody(event, OwnFoodSaveSchema)

  const db = getAdminDatabase()
  const isPremium = await checkPremiumStatus(userId)
  const ownFoodRef = db.ref(`/${userId}/ownFood`)

  const ownFoodSnapshot = await ownFoodRef.once('value')
  const existingFoods = ownFoodSnapshot.val() as Record<
    string,
    { name: string; phe: number; shared?: boolean }
  > | null

  // Duplicate = same name (case-insensitive) AND exact same phe value,
  // mirroring the community duplicate rule
  if (existingFoods) {
    const normalizedName = normalizeString(foodData.name)
    const isDuplicate = Object.values(existingFoods).some(
      (food) => normalizeString(food.name) === normalizedName && food.phe === foodData.phe
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
      [`${userId}/ownFood/${ownFoodKey}`]: { ...foodData, communityKey },
      [`communityFoods/${communityKey}`]: communityFoodData
    })

    return {
      success: true,
      key: ownFoodKey,
      communityKey
    }
  }

  // Not shared - just save the own food
  const newRef = ownFoodRef.push()
  await newRef.set({
    ...foodData,
    communityKey: null
  })

  return {
    success: true,
    key: newRef.key
  }
})
