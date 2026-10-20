import { AdminCommentDeleteSchema } from '../../types/schemas'
import { defineAdminHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { removeThreadComment } from '../../utils/community-thread'

// Deletes one comment for good.
export default defineAdminHandler(async ({ event }) => {
  const { target, parentKey, commentId } = await validateBody(event, AdminCommentDeleteSchema)

  if (!(await removeThreadComment(target, parentKey, commentId))) {
    throw createError({
      statusCode: 403,
      message: 'Edit history cannot be deleted',
      data: { code: 'forbidden' }
    })
  }
  return { success: true }
})
