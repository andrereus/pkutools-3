interface DiaryItemLocator {
  itemId?: string
  logIndex?: number
}

// Stable ids take precedence whenever the caller supplies one. In particular,
// an unknown id must not fall back to a possibly stale array index and mutate a
// different food. Index lookup remains only for legacy clients/items.
export const resolveDiaryItemIndex = (
  log: Array<{ itemId?: string }>,
  { itemId, logIndex }: DiaryItemLocator
): number => {
  if (itemId !== undefined) {
    const matches: number[] = []
    for (const [index, item] of log.entries()) {
      if (item.itemId === itemId) matches.push(index)
    }

    if (matches.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Diary food item not found',
        data: { code: 'diary-item-not-found' }
      })
    }
    if (matches.length > 1) {
      throw createError({
        statusCode: 409,
        message: 'Diary food item id is not unique',
        data: { code: 'duplicate-diary-item-id' }
      })
    }
    return matches[0]!
  }

  if (logIndex === undefined || logIndex >= log.length) {
    throw createError({
      statusCode: 400,
      message: 'Invalid log item index'
    })
  }
  return logIndex
}
