import { getAdminDatabase } from '../../utils/firebase-admin'
import { OwnFoodSchema } from '../../types/schemas'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'
import { formatValidationError } from '../../utils/validation'
import { checkPremiumStatus } from '../../utils/license'
import { isCommunityFoodHidden } from '../../utils/community-food'

// Helper to get user's language from Accept-Language header
function getLanguageFromHeader(event: Parameters<typeof defineEventHandler>[0] extends (e: infer E) => unknown ? E : never): 'en' | 'de' | 'es' | 'fr' {
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

export default defineEventHandler(async (event) => {
  try {
    const userId = await getAuthenticatedUser(event)
    const body = await readBody(event)

    // Validate input with Zod schema
    const validation = OwnFoodSchema.safeParse(body)
    if (!validation.success) {
      formatValidationError(validation.error)
    }

    const db = getAdminDatabase()
    const isPremium = await checkPremiumStatus(userId)
    const ownFoodRef = db.ref(`/${userId}/ownFood`)

    // Check limit based on premium status (shared foods don't count towards limit)
    if (!isPremium) {
      const ownFoodSnapshot = await ownFoodRef.once('value')
      const foods = ownFoodSnapshot.val()

      if (foods) {
        // Count only non-shared foods
        const nonSharedCount = Object.values(foods).filter(
          (food: unknown) => !(food as { shared?: boolean }).shared
        ).length

        if (nonSharedCount >= 50) {
          throw createError({
            statusCode: 403,
            message: 'Own food limit reached. Upgrade to premium for unlimited entries.'
          })
        }
      }
    }

    const foodData = validation.data
    let communityKey: string | null = null

    // If sharing to community, create community food entry
    if (foodData.shared) {
      const language = getLanguageFromHeader(event)

      // Check for duplicates
      const isDuplicate = await checkDuplicateCommunityFood(db, foodData.name, foodData.phe, language)
      if (isDuplicate) {
        throw createError({
          statusCode: 409,
          message: 'A similar food already exists in the community database'
        })
      }

      // Create the own food entry first to get the key
      const newOwnFoodRef = ownFoodRef.push()
      const ownFoodKey = newOwnFoodRef.key!

      // Create community food entry
      const communityFoodRef = db.ref('communityFoods').push()
      communityKey = communityFoodRef.key

      const communityFoodData = {
        name: foodData.name,
        icon: foodData.icon || null,
        phe: foodData.phe,
        kcal: foodData.kcal,
        note: foodData.note || null,
        language,
        contributorId: userId,
        ownFoodKey,
        createdAt: Date.now(),
        likes: 0,
        dislikes: 0,
        score: 0,
        usageCount: 0
      }

      await communityFoodRef.set(communityFoodData)

      // Save own food with community key reference
      await newOwnFoodRef.set({
        ...foodData,
        communityKey
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
  } catch (error: unknown) {
    handleServerError(error)
  }
})
