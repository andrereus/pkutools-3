// Stored records can predate request validation and contain form numbers as
// strings. Compare them with the same deliberately narrow coercion the schemas
// use: numeric strings are accepted, while blanks, booleans and arrays do not
// become plausible zeroes through Number().
export const storedNumberEquals = (stored: unknown, current: number): boolean => {
  if (typeof stored === 'number') return stored === current
  return typeof stored === 'string' && stored.trim() !== '' && Number(stored) === current
}
