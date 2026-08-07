import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai'
import { getApp } from 'firebase/app'
import { parseModelJson } from '../utils/model-json'

const EMOJI_MODEL = 'gemini-3.1-flash-lite'

/**
 * Fetches a single emoji for a food name (client-side). Returns null if the
 * name is empty or if the API call fails.
 *
 * `EMOJI_MODEL` stays on the flash-lite tier deliberately: picking an emoji is
 * a lightweight, cost-sensitive task rather than one that needs a stronger model.
 *
 * Pass `currentEmoji` to ask for a replacement of an emoji the user already has;
 * the model is told which one it is and asked to return a different one. It can
 * still return the same emoji, which callers handle.
 */
export function useFoodEmoji() {
  const fetchEmojiForFood = async (
    foodName: string,
    currentEmoji?: string | null
  ): Promise<string | null> => {
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

    // `currentEmoji` is interpolated into the prompt, so bound it and strip
    // quotes, backslashes, tabs and line breaks. `slice` counts UTF-16 code
    // units and can truncate long ZWJ sequences; the value is only a hint to
    // the model.
    const sanitizedCurrentEmoji =
      typeof currentEmoji === 'string'
        ? currentEmoji
            .trim()
            .slice(0, 8)
            .replace(/["\\\n\r\t]/g, '')
            .trim()
        : ''

    try {
      const firebaseApp = getApp()
      const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() })
      const model = getGenerativeModel(ai, {
        model: EMOJI_MODEL,
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })

      const replaceLine = sanitizedCurrentEmoji
        ? `\nThe current emoji is ${sanitizedCurrentEmoji}. Return a different one that still fits.\n`
        : ''

      const prompt = `Return one emoji for this food: "${sanitizedName}"
${replaceLine}
Return JSON: {"emoji": string (one emoji character) or null}`

      const result = await model.generateContent(prompt)
      const text = result.response.text()
      const data = parseModelJson(text)
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
