// An admin can hide a food or a post. It stays where it is, seen only by its
// owner and by admins, marked as hidden, until it is shown again or deleted.

export const isHiddenByAdmin = (record: { hiddenAt?: unknown } | null | undefined): boolean =>
  typeof record?.hiddenAt === 'number' && record.hiddenAt > 0

export const isVisibleTo = (
  record: { hiddenAt?: unknown } | null | undefined,
  ownerId: unknown,
  reader: { id: string | null; isAdmin: boolean }
): boolean =>
  !isHiddenByAdmin(record) || reader.isAdmin || (reader.id !== null && ownerId === reader.id)
