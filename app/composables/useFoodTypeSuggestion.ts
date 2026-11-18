import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai'
import { getApp } from 'firebase/app'
import { parseModelJson } from '../utils/model-json'
import type { FoodType } from '../utils/nutrition'

// A food type suggested from a food name, alongside `foodTypeFromCategories`,
// which reads a scanned product's category data, and the dialog that offers
// either one. Offered only: the caller keeps its current type until the user
// accepts a suggestion.
const FOOD_TYPE_MODEL = 'gemini-3.5-flash-lite'

const FOOD_TYPES: readonly string[] = ['fruit', 'vegetable', 'meat', 'other']

/**
 * The food type named in a model's answer, or null when it named none. Only the
 * four exact values are accepted; anything else leaves the caller's type alone.
 */
export const parseFoodTypeAnswer = (value: unknown): FoodType | null => {
  if (typeof value !== 'string') return null
  const answer = value.trim().toLowerCase()
  return FOOD_TYPES.includes(answer) ? (answer as FoodType) : null
}

export function useFoodTypeSuggestion() {
  // Resolved while the page is still setting up. `confirmFoodType` reaches for
  // both of these after an await, and `useI18n` has no active instance to bind
  // to by then.
  const { t } = useI18n()
  const confirm = useConfirm()
  // The model only sees the normalized name, so the answer remains usable when
  // a dismissed save returns to the same form for other edits.
  const suggestionCache = new Map<string, FoodType | null>()

  /**
   * The food type a name points at, or null when it points at none, when the
   * name is empty, or when the call fails. Null always means "leave the type
   * alone", never "this is a general food".
   */
  const suggestFoodType = async (foodName: string): Promise<FoodType | null> => {
    if (!foodName || typeof foodName !== 'string' || foodName.trim() === '') {
      return null
    }

    // The name is interpolated into the prompt, so it is bounded and stripped of
    // quotes and line breaks the same way `useFoodEmoji` does it.
    const sanitizedName = foodName
      .trim()
      .slice(0, 200)
      .replace(/"/g, '\\"')
      .replace(/\n/g, ' ')
      .replace(/\r/g, '')
      .replace(/\t/g, ' ')
      .trim()

    if (sanitizedName === '') return null

    const cacheKey = sanitizedName.toLowerCase()
    if (suggestionCache.has(cacheKey)) return suggestionCache.get(cacheKey) ?? null

    try {
      const ai = getAI(getApp(), { backend: new GoogleAIBackend() })
      const model = getGenerativeModel(ai, {
        model: FOOD_TYPE_MODEL,
        generationConfig: { responseMimeType: 'application/json' }
      })

      const prompt = `Identify the food type of: "${sanitizedName}"

It will be used as a factor to calculate phenylalanine from protein.

Return JSON: {"foodType": "fruit" | "vegetable" | "meat" | "other" | null}`

      const result = await model.generateContent(prompt)
      const suggestion = parseFoodTypeAnswer(parseModelJson(result.response.text())?.foodType)
      suggestionCache.set(cacheKey, suggestion)
      return suggestion
    } catch {
      return null
    }
  }

  /**
   * A suggestion as the user reads it: why the type is suggested, what the
   * entry comes to under it in mg Phe, and that the ingredients decide. The
   * number is what is being decided; a factor name means nothing on its own to
   * someone counting Phe for the day.
   */
  const describeSuggestion = (reason: string, current: number, corrected: number): string =>
    `${reason} ${t('phe-calculator.type-suggestion-result', { corrected, current })} ${t(
      'common.check-composition'
    )}`

  /**
   * Asks whether to switch from `currentType` to `suggested`, with `message`
   * from `describeSuggestion`. Returns the type to calculate with, or null when
   * the dialog is dismissed, which tells the caller to abort its save and leave
   * the form available for editing.
   */
  const offerFoodType = async (
    message: string,
    currentType: FoodType,
    suggested: FoodType
  ): Promise<FoodType | null> => {
    // The buttons stand on their own rather than naming the types: a food type
    // label is a phrase ("Protein from vegetables"), and two of them side by
    // side wrap onto several lines on a phone.
    const accepted = await confirm.confirm({
      title: t('phe-calculator.type-suggestion-title'),
      message,
      confirmLabel: t('phe-calculator.type-suggestion-use'),
      cancelLabel: t('phe-calculator.type-suggestion-keep'),
      variant: 'default'
    })

    if (accepted === null) return null
    return accepted ? suggested : currentType
  }

  /**
   * The type to calculate with, after offering the user a correction. Returns
   * `currentType` unchanged when there is nothing to suggest, when the
   * suggestion agrees with it, or when the user explicitly keeps it. Returns
   * null when the dialog is dismissed.
   *
   * `pheFor` gives the mg Phe the entry ends up with under a type. It has to be
   * computed from the same values the entry was built from, or the dialog would
   * quote a figure the save doesn't produce.
   *
   * `isCurrent` prevents a suggestion for an edit that was dismissed while the
   * model request was pending.
   */
  const confirmFoodType = async (
    foodName: string,
    currentType: FoodType,
    pheFor: (foodType: FoodType) => number,
    isCurrent: () => boolean = () => true
  ): Promise<FoodType | null> => {
    const suggested = await suggestFoodType(foodName)
    if (!suggested || suggested === currentType || !isCurrent()) return currentType

    const reason = t('phe-calculator.type-suggestion-message', {
      type: t(`phe-calculator.${suggested}`)
    })
    return offerFoodType(
      describeSuggestion(reason, pheFor(currentType), pheFor(suggested)),
      currentType,
      suggested
    )
  }

  return { suggestFoodType, describeSuggestion, offerFoodType, confirmFoodType }
}
