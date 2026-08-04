// Stored records can predate request validation and contain form numbers as
// strings. Compare them with the same deliberately narrow coercion the schemas
// use: numeric strings are accepted, while blanks, booleans and arrays do not
// become plausible zeroes through Number().
export const storedNumberEquals = (stored: unknown, current: number): boolean => {
  if (typeof stored === 'number') return stored === current
  return typeof stored === 'string' && stored.trim() !== '' && Number(stored) === current
}

// Database records can predate request validation, so totals must not rely on
// JavaScript's `+` operator seeing a number. A legacy "150" is 150; malformed
// shapes are ignored rather than being coerced into a plausible value.
export const storedNumberOrZero = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string' || value.trim() === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
