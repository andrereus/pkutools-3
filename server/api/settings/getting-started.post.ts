import { verifyIdToken, getAdminDatabase } from '../../utils/firebase-admin'
import { z } from 'zod'

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
    const firebaseError = error as { code?: string }
    if (
      firebaseError.code === 'auth/id-token-expired' ||
      firebaseError.code === 'auth/argument-error'
    ) {
      throw createError({
        statusCode: 401,
        message: 'Invalid or expired token'
      })
    }
    const httpError = error as { statusCode?: number }
    if (httpError.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    })
  }
})

