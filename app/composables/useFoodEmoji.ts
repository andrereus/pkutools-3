import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai'
import { getApp } from 'firebase/app'

const EMOJI_MODEL = 'gemini-2.5-flash-lite'

/**
 * Fetches a single emoji for a food name using Gemini 2.5 Flash Lite (client-side).
 * Returns null if the name is empty or if the API call fails.
 * Uses Flash Lite only for minimal cost (~$0.000004 per call).
 */
export function useFoodEmoji() {
  const fetchEmojiForFood = async (foodName: string): Promise<string | null> => {
    if (!foodName || typeof foodName !== 'string' || foodName.trim() === '') {
      return null
    }

    const sanitizedName = foodName
      .trim()
      .slice(0, 200)
      .replace(/"/g, '\\"')
      .replace(/\n/g, ' ')
      .replace(/\r/g, '')
      .replace(/\t/g, ' ')
      .trim()

    if (sanitizedName === '') return null

    try {
      const firebaseApp = getApp()
      const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() })
      const model = getGenerativeModel(ai, {
        model: EMOJI_MODEL,
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })

      const prompt = `Return one emoji for this food: "${sanitizedName}"

Return JSON: {"emoji": string (one emoji character) or null}`

      const result = await model.generateContent(prompt)
      const text = result.response.text()
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null

      const data = JSON.parse(jsonMatch[0])
      const emoji = data?.emoji
      if (typeof emoji === 'string' && emoji.trim() !== '') {
        return emoji.trim()
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * Ensures emoji is set for a log entry when neither emoji nor icon is present.
   * Fetches emoji from AI and returns the entry with emoji filled in.
   * Does not mutate the original entry.
   */
  const ensureEmojiForLogEntry = async <
    T extends { name: string; emoji?: string | null; icon?: string | null }
  >(
    entry: T
  ): Promise<T> => {
    const hasEmoji = entry.emoji != null && entry.emoji !== ''
    const hasIcon = entry.icon != null && entry.icon !== ''
    if (hasEmoji || hasIcon) {
      return entry
    }

    const emoji = await fetchEmojiForFood(entry.name)
    return { ...entry, emoji: emoji || null }
  }

  return { fetchEmojiForFood, ensureEmojiForLogEntry }
}
