import { getAdminDatabase } from '../../utils/firebase-admin'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'
import { formatValidationError } from '../../utils/validation'
import { ResetSchema } from '../../types/schemas'

export default defineEventHandler(async (event) => {
  try {
    const userId = await getAuthenticatedUser(event)
    const body = await readBody(event)
    const validation = ResetSchema.safeParse(body.type)

    if (!validation.success) {
      formatValidationError(validation.error)
    }

    const db = getAdminDatabase()
    const resetType = validation.data

    let refPath: string
    switch (resetType) {
      case 'diary':
        refPath = `/${userId}/pheDiary`
        break
      case 'labValues':
        refPath = `/${userId}/labValues`
        break
      case 'ownFood':
        refPath = `/${userId}/ownFood`
        break
      default:
        throw createError({
          statusCode: 400,
          message: 'Invalid reset type'
        })
    }

    const dataRef = db.ref(refPath)
    await dataRef.remove()

    return { success: true, type: resetType }
  } catch (error: unknown) {
    handleServerError(error)
  }
})
