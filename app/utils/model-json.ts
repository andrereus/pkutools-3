// Reading the JSON object out of a model response. `responseMimeType:
// 'application/json'` asks for JSON but does not guarantee it: the models
// occasionally append a stray closing brace after a complete, valid object.
// Matching the widest brace span swallows that extra brace and JSON.parse then
// rejects the whole response — a failed estimate for the user, and a spent
// daily quota slot, over output that was fine.

// The first balanced object in the text. Braces inside strings do not count
// towards the depth, so a model-written explanation containing "{" cannot close
// the object early, and an escaped quote cannot end the string it sits in.
const firstBalancedObject = (text: string): string | null => {
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i++) {
    const char = text[i]

    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }

    if (char === '"') inString = true
    else if (char === '{') depth++
    else if (char === '}' && --depth === 0) return text.slice(start, i + 1)
  }

  // Never balanced — a truncated response rather than a decorated one
  return null
}

// The object a model returned, or null when the response holds nothing usable.
// Callers treat null as a failed request, so malformed and missing take the
// same path.
export const parseModelJson = (text: unknown): Record<string, unknown> | null => {
  const object = typeof text === 'string' ? firstBalancedObject(text) : null
  if (object === null) return null

  try {
    return JSON.parse(object)
  } catch {
    // Balanced braces are not valid JSON on their own, so this still fires
    return null
  }
}
