import { failureReason } from '../utils/api-error'
import type { FoodNutrients, FoodSource } from './useApi'

// Saving a food to Own Food alongside the diary entry a tool is writing anyway.
// The Phe calculator, the barcode scanner and both AI modes all do this, and
// what they need is identical: the diary entry must survive a failed own-food
// save, the reason has to reach the user inside the message that reports the
// entry, and a rescanned product has to come back as "already saved" rather
// than as an error. That policy lives here rather than in four copies.

export interface OwnFoodSaveOutcome {
  /** The stored food was recognised by its source id; nothing was written. */
  alreadyExists: boolean
  /** Why the save failed, translated. Null when it didn't. */
  failure: string | null
  /** Whether this save was also asking to publish the food. */
  wantedToShare: boolean
}

interface OwnFoodInput {
  name: string
  icon?: string | null
  emoji?: string | null
  phe: number
  kcal: number
  note?: string | null
  shared?: boolean
  nutrients?: FoodNutrients | null
  factor?: number | null
  source?: FoodSource | null
  sourceId?: string | null
}

interface SaveNotesInput {
  useOwnFoodNote: boolean
  saveToOwnFood: boolean
  ownFoodNote: unknown
  defaultDiaryNote: unknown
}

const normalizedNote = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

// One note decision for both destinations. `useOwnFoodNote` is true for a
// label scan, where the visible Own Food note should also reach the diary. It
// is false for an estimate, whose model explanation stays authoritative.
export const resolveSaveNotes = ({
  useOwnFoodNote,
  saveToOwnFood,
  ownFoodNote,
  defaultDiaryNote
}: SaveNotesInput): { diary: string | null; ownFood: string | null } => {
  const note = useOwnFoodNote
    ? saveToOwnFood
      ? normalizedNote(ownFoodNote)
      : null
    : normalizedNote(defaultDiaryNote)

  return {
    diary: note,
    ownFood: saveToOwnFood ? note : null
  }
}

export const useSaveToOwnFood = () => {
  const { saveOwnFood } = useApi()
  const notifications = useNotifications()
  const { t, te } = useI18n()

  /**
   * Saves the food, reporting nothing itself. Never throws: the caller is in
   * the middle of writing a diary entry, and that entry is what the user
   * pressed the button for.
   */
  const saveAlongsideDiary = async (food: OwnFoodInput): Promise<OwnFoodSaveOutcome> => {
    const wantedToShare = food.shared === true
    try {
      // Silent: the outcome is reported once, below, together with the diary
      // entry — two notifications would replace one another.
      const result = await saveOwnFood(food, { silent: true })
      return { alreadyExists: result?.alreadyExists === true, failure: null, wantedToShare }
    } catch (error) {
      return { alreadyExists: false, failure: failureReason(error, t, te), wantedToShare }
    }
  }

  /**
   * Reports the whole save, once the diary entry is written. Pass null when the
   * user didn't ask for an own food at all.
   */
  const reportSaved = (outcome: OwnFoodSaveOutcome | null) => {
    if (outcome?.failure) {
      notifications.warning(t('own-food.diary-only', { reason: outcome.failure }))
      return
    }
    if (outcome?.alreadyExists) {
      // Sharing applies to the food being saved, and a product that is already
      // saved isn't saved again — so say where it can be shared instead.
      notifications.success(
        t(outcome.wantedToShare ? 'own-food.already-saved-share' : 'own-food.already-saved')
      )
      return
    }
    notifications.success(t('common.saved'))
  }

  return { saveAlongsideDiary, reportSaved }
}
