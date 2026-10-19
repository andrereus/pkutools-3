import { AdminCommentDeleteSchema } from '../../types/schemas'
import { defineAdminHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { removeThreadComment } from '../../utils/community-post'

// Removes one comment from its thread, restorably.
export default defineAdminHandler(async ({ event, userId }) => {
  const { target, parentKey, commentId } = await validateBody(event, AdminCommentDeleteSchema)

  if (!(await removeThreadComment(target, parentKey, commentId, { removedBy: userId }))) {
    throw createError({
      statusCode: 403,
      message: 'Edit history cannot be deleted',
      data: { code: 'forbidden' }
    })
  }
  return { success: true }
})
