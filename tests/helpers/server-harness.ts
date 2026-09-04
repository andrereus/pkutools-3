import { vi } from 'vitest'

// A small stand-in for the Firebase Admin Realtime Database, plus the handful of
// Nuxt/h3 auto-imports the API routes call. Enough to drive a route end to end
// and then read back what it actually wrote.

export class HttpError extends Error {
  statusCode: number
  data?: unknown
  constructor(options: { statusCode: number; message: string; data?: unknown }) {
    super(options.message)
    this.statusCode = options.statusCode
    this.data = options.data
  }
}

/** Markers written by the local stub or the Admin SDK's ServerValue.increment. */
type Increment = { __increment: number } | { '.sv': { increment: number } }
const incrementDelta = (value: unknown): number | null => {
  if (typeof value !== 'object' || value === null) return null
  if ('__increment' in value && typeof value.__increment === 'number') return value.__increment
  if (
    '.sv' in value &&
    typeof value['.sv'] === 'object' &&
    value['.sv'] !== null &&
    'increment' in value['.sv'] &&
    typeof value['.sv'].increment === 'number'
  ) {
    return value['.sv'].increment
  }
  return null
}

export const ServerValueStub = {
  increment: (delta: number): Increment => ({ __increment: delta })
}

type Data = Record<string, unknown>

const segments = (path: string) => path.split('/').filter(Boolean)

const readPath = (root: Data, path: string): unknown =>
  segments(path).reduce<unknown>(
    (node, key) => (node == null ? undefined : (node as Data)[key]),
    root
  )

const writePath = (root: Data, path: string, value: unknown) => {
  const keys = segments(path)
  const last = keys.pop()!
  let node = root
  for (const key of keys) {
    if (typeof node[key] !== 'object' || node[key] === null) node[key] = {}
    node = node[key] as Data
  }
  // Firebase deletes a child written as null rather than storing it.
  if (value === null) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- keys are database paths
    delete node[last]
    // Realtime Database does not retain childless ancestors.
    for (let index = keys.length; index > 0; index -= 1) {
      const parent =
        index === 1 ? root : (readPath(root, keys.slice(0, index - 1).join('/')) as Data)
      const childKey = keys[index - 1]!
      const child = parent?.[childKey]
      if (
        typeof child === 'object' &&
        child !== null &&
        !Array.isArray(child) &&
        Object.keys(child as Data).length === 0
      ) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- keys are database paths
        delete parent[childKey]
      } else {
        break
      }
    }
  } else {
    node[last] = value
  }
}

const snapshotOf = (value: unknown) => ({
  // Detached copy, like the real snapshot: a route that reads a value, writes,
  // and then reads its own earlier snapshot must still see the pre-write state.
  val: () => (value === undefined ? null : structuredClone(value)),
  exists: () => value !== undefined && value !== null,
  numChildren: () =>
    typeof value === 'object' && value !== null ? Object.keys(value as Data).length : 0
})

/** A write the fake should reject, so a test can see how a route copes. */
export type WriteFailure = (operation: 'set' | 'update' | 'remove', path: string) => boolean

/**
 * Creates a fake database over a plain object. The returned `data` is the live
 * store, so a test can seed it up front and assert against it afterwards.
 *
 * `failWrite` turns a matching write into a rejection, which is how the routes
 * would see a real database outage — useful for the multi-step writes that are
 * not wrapped in a transaction.
 */
export function createFakeDatabase(initial: Data = {}, failWrite?: WriteFailure) {
  const data: Data = structuredClone(initial)
  let pushCounter = 0

  const guard = (operation: 'set' | 'update' | 'remove', path: string) => {
    if (failWrite?.(operation, path)) {
      throw new Error(`fake database: ${operation} failed at ${path}`)
    }
  }

  const makeRef = (path: string) => {
    /** Applies a query (orderByChild/equalTo/limitToFirst) over a ref's children. */
    const query = (filters: { child?: string; equals?: unknown; limit?: number }) => ({
      orderByChild: (child: string) => query({ ...filters, child }),
      equalTo: (equals: unknown) => query({ ...filters, equals }),
      limitToFirst: (limit: number) => query({ ...filters, limit }),
      once: async (_event: string) => {
        const node = readPath(data, path)
        if (typeof node !== 'object' || node === null) return snapshotOf(undefined)
        let entries = Object.entries(node as Data)
        if (filters.child !== undefined && filters.equals !== undefined) {
          entries = entries.filter(
            ([, value]) => (value as Data)[filters.child!] === filters.equals
          )
        }
        if (filters.limit !== undefined) entries = entries.slice(0, filters.limit)
        return snapshotOf(entries.length ? Object.fromEntries(entries) : undefined)
      }
    })

    return {
      ...query({}),
      key: segments(path).at(-1) ?? null,
      once: async (_event: string) => snapshotOf(readPath(data, path)),
      set: async (value: unknown) => {
        guard('set', path)
        writePath(data, path, value)
      },
      remove: async () => {
        guard('remove', path)
        writePath(data, path, null)
      },
      update: async (patch: Data) => {
        guard('update', path)
        for (const [key, value] of Object.entries(patch)) {
          const targetPath = `${path}/${key}`
          const delta = incrementDelta(value)
          if (delta !== null) {
            const current = readPath(data, targetPath)
            const base = typeof current === 'number' ? current : 0
            writePath(data, targetPath, base + delta)
          } else {
            writePath(data, targetPath, value)
          }
        }
      },
      push: () => {
        pushCounter += 1
        return makeRef(`${path}/-Nfake${pushCounter}`)
      }
    }
  }

  // `ref()` with no path is the database root, which is how a route addresses a
  // multi-location update (one write across several paths).
  return { data, db: { ref: (path = '') => makeRef(path) } }
}

/**
 * Stubs the auto-imports the routes rely on. `defineEventHandler` is reduced to
 * the identity function so a route's default export is directly callable.
 */
export function installServerGlobals() {
  vi.stubGlobal('defineEventHandler', <T>(handler: T) => handler)
  vi.stubGlobal(
    'createError',
    (options: ConstructorParameters<typeof HttpError>[0]) => new HttpError(options)
  )
  vi.stubGlobal('readBody', async (event: { body?: unknown }) => event.body)
  vi.stubGlobal(
    'getHeader',
    (event: { headers?: Record<string, string> }, name: string) => event.headers?.[name]
  )
  vi.stubGlobal(
    'getRouterParam',
    (event: { params?: Record<string, string> }, name: string) => event.params?.[name]
  )
}

/**
 * An H3Event stand-in carrying the body, headers and route params the routes
 * read. `params` is what a `[key]` route segment resolves to.
 */
export const requestEvent = (
  body: unknown,
  headers: Record<string, string> = {},
  params: Record<string, string> = {}
) => ({ body, headers, params }) as never
