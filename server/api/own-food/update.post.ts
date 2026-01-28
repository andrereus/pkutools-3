import { getAdminDatabase } from '../../utils/firebase-admin'
import { OwnFoodUpdateSchema } from '../../types/schemas'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'
import { formatValidationError } from '../../utils/validation'
import { isCommunityFoodHidden } from '../../utils/community-food'

// Helper to get user's language from request body or Accept-Language header (fallback)
function getLanguage(
  event: Parameters<typeof defineEventHandler>[0] extends (e: infer E) => unknown ? E : never,
  bodyLocale?: string
): 'en' | 'de' | 'es' | 'fr' {
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

  const normalizedName = normalizeString(name)
  for (const key of Object.keys(foods)) {
    if (key === excludeKey) continue
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

    // Validate input
    const validation = OwnFoodUpdateSchema.safeParse(body)
    if (!validation.success) {
      formatValidationError(validation.error)
    }

    const { entryKey, locale, data } = validation.data

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

    const wasShared = ownFood.shared === true
    const willBeShared = data.shared === true
    const existingCommunityKey = ownFood.communityKey || null

    let communityKey: string | null = existingCommunityKey

    // Handle sharing state changes
    if (!wasShared && willBeShared) {
      // Newly sharing - create community food entry
      const language = getLanguage(event, locale)

      // Check for duplicates
      const isDuplicate = await checkDuplicateCommunityFood(db, data.name, data.phe, language)
      if (isDuplicate) {
        throw createError({
          statusCode: 409,
          message: 'A similar food already exists in the community database'
        })
      }

      const communityFoodRef = db.ref('communityFoods').push()
      communityKey = communityFoodRef.key

      const communityFoodData = {
        name: data.name,
        icon: data.icon || null,
        phe: data.phe,
        kcal: data.kcal,
        note: data.note || null,
        language,
        contributorId: userId,
        ownFoodKey: entryKey,
        createdAt: Date.now(),
        likes: 0,
        dislikes: 0,
        score: 0,
        usageCount: 0
      }

      await communityFoodRef.set(communityFoodData)
    } else if (wasShared && !willBeShared) {
      // Unsharing - remove community food entry (voterIds deleted automatically as child)
      if (existingCommunityKey) {
        await db.ref(`communityFoods/${existingCommunityKey}`).remove()
      }
      communityKey = null
    } else if (wasShared && willBeShared && existingCommunityKey) {
      // Still shared - update community food entry
      const communityFoodRef = db.ref(`communityFoods/${existingCommunityKey}`)
      const communityFoodSnapshot = await communityFoodRef.once('value')
      const existingCommunityFood = communityFoodSnapshot.val()

      if (existingCommunityFood) {
        // Check if name, phe or kcal changed - reset votes if so
        const nameChanged = existingCommunityFood.name !== data.name
        const pheChanged = existingCommunityFood.phe !== data.phe
        const kcalChanged = existingCommunityFood.kcal !== data.kcal

        const updateData: Record<string, unknown> = {
          name: data.name,
          icon: data.icon || null,
          phe: data.phe,
          kcal: data.kcal,
          note: data.note || null
        }

        if (nameChanged || pheChanged || kcalChanged) {
          // Reset votes when name or nutritional values change
          updateData.likes = 0
          updateData.dislikes = 0
          updateData.score = 0
          updateData.voterIds = null // Clear all votes
        }

        await communityFoodRef.update(updateData)
      }
    }

    // Update the own food entry
    await ownFoodRef.update({
      ...data,
      communityKey
    })

    return {
      success: true,
      key: entryKey,
      communityKey
    }
  } catch (error: unknown) {
    handleServerError(error)
  }
})
