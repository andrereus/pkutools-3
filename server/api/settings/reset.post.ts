import { verifyIdToken, getAdminDatabase } from '../../utils/firebase-admin'
import { z } from 'zod'
import { handleServerError } from '../../utils/error-handler'

const ResetSchema = z.enum(['diary', 'labValues', 'ownFood'], {
  errorMap: () => ({ message: 'Reset type must be diary, labValues, or ownFood' })
})

export default defineEventHandler(async (event) => {
  try {
    const authHeader = getHeader(event, 'authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError({
        statusCode: 401,
        message: 'Missing or invalid authorization header'
      })
    }

    const token = authHeader.substring(7)
    const decodedToken = await verifyIdToken(token)
    const userId = decodedToken.uid

    const body = await readBody(event)
    const validation = ResetSchema.safeParse(body.type)

    if (!validation.success) {
      const errorMessages = validation.error.issues
        .map((issue) => {
          const path = issue.path.join('.')
          return `${path ? `${path}: ` : ''}${issue.message}`
        })
        .join(', ')

      throw createError({
        statusCode: 400,
        message: `Validation failed: ${errorMessages}`,
        data: validation.error.issues
      })
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

