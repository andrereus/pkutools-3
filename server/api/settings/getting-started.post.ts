import { verifyIdToken, getAdminDatabase } from '../../utils/firebase-admin'
import { z } from 'zod'
import { handleServerError } from '../../utils/error-handler'

const GettingStartedSchema = z.object({
  completed: z.boolean()
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
    const validation = GettingStartedSchema.safeParse(body)

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
    const settingsRef = db.ref(`/${userId}/settings`)

    await settingsRef.update({
      gettingStartedCompleted: validation.data.completed
    })

    return { success: true }
  } catch (error: unknown) {
    handleServerError(error)
  }
})

