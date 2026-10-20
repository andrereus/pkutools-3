import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Firebase listeners are the store's only data source, so they are stubbed with
// a registry that lets a test push snapshots and observe teardown.

type Listener = (snapshot: { val: () => unknown }) => void

const listeners = new Map<string, Listener>()
const unsubscribes = new Map<string, ReturnType<typeof vi.fn>>()

vi.mock(import('firebase/database'), () => ({
  getDatabase: () => ({}),
  ref: (_db: unknown, path: string) => ({ path }),
  // A query is named by its ref's path and its constraints, so two queries on
  // one path stay apart.
  query: (dbRef: { path: string }, ...constraints: string[]) => ({
    path: [dbRef.path, ...constraints].join('|')
  }),
  orderByChild: (child: string) => `orderByChild=${child}`,
  limitToLast: (limit: number) => `limitToLast=${limit}`,
  equalTo: (value: string) => `equalTo=${value}`,
  startAt: (value: string) => `startAt=${value}`,
  endAt: (value: string) => `endAt=${value}`,
  onValue: (dbRef: { path: string }, callback: Listener) => {
    listeners.set(dbRef.path, callback)
    const unsubscribe = vi.fn()
    unsubscribes.set(dbRef.path, unsubscribe)
    return unsubscribe
  }
}))

vi.mock(import('firebase/auth'), () => ({
  getAuth: () => ({ useDeviceLanguage: vi.fn() }),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn(),
  updateProfile: vi.fn()
}))

const { useStore } = await import('../stores/index')

/** Pushes a Firebase snapshot into the listener bound to `path`. */
const emit = (path: string, data: unknown) => {
  const listener = listeners.get(path)
  if (!listener) throw new Error(`no listener bound for ${path}`)
  listener({ val: () => data })
}

beforeEach(() => {
  setActivePinia(createPinia())
  listeners.clear()
  unsubscribes.clear()
})

describe('store data binding', () => {
  it('maps a Firebase object into an array carrying its push key', () => {
    const store = useStore()
    store.user = { id: 'user-1' }
    store.initRef()

    emit('user-1/pheDiary', {
      '-Nabc': { date: '2026-07-26', phe: 300, kcal: 1800 },
      '-Ndef': { date: '2026-07-25', phe: 280, kcal: 1750 }
    })

    expect(store.pheDiary).toHaveLength(2)
    expect(store.pheDiary[0]).toMatchObject({ date: '2026-07-26', phe: 300, '.key': '-Nabc' })
    expect(store.pheDiary[1]['.key']).toBe('-Ndef')
  })

  it('empties a collection when Firebase reports no data', () => {
    const store = useStore()
    store.user = { id: 'user-1' }
    store.initRef()

    emit('user-1/ownFood', { '-Nabc': { name: 'Shake' } })
    expect(store.ownFood).toHaveLength(1)

    emit('user-1/ownFood', null)
    expect(store.ownFood).toEqual([])
  })

  it('merges stored settings over the defaults', () => {
    const store = useStore()
    store.user = { id: 'user-1' }
    store.initRef()

    emit('user-1/settings', { maxPhe: 300, labUnit: 'umoll' })

    expect(store.settings.maxPhe).toBe(300)
    expect(store.settings.labUnit).toBe('umoll')
    // Untouched keys must keep their defaults, not become undefined.
    expect(store.settings.progressStyle).toBe('circles')
    expect(store.settings.healthDataConsent).toBe(false)
    expect(store.settings.maxKcal).toBeNull()
  })

  // Everything that branches on settings (onboarding, post-sign-in routing) waits
  // on this flag; flipping it early would make those checks read local defaults.
  it('marks settings as loaded only once a settings snapshot arrives', () => {
    const store = useStore()
    store.user = { id: 'user-1' }
    store.initRef()

    expect(store.settingsLoaded).toBe(false)

    emit('user-1/pheDiary', null)
    expect(store.settingsLoaded).toBe(false)

    emit('user-1/settings', null)
    expect(store.settingsLoaded).toBe(true)
  })

  it('falls back to the defaults when nothing is stored', () => {
    const store = useStore()
    store.user = { id: 'user-1' }
    store.initRef()

    emit('user-1/settings', { maxPhe: 300 })
    emit('user-1/settings', null)

    expect(store.settings.maxPhe).toBeNull()
    expect(store.settings.labUnit).toBe('mgdl')
  })

  it('follows the posts the reader commented on, whatever their age', () => {
    const store = useStore()
    store.user = { id: 'user-1' }
    store.initRef()

    emit('user-1/communityThreads', { posts: { old: 100, older: 50 } })
    emit('communityPosts/old', { authorId: 'user-2', text: 'Old post' })
    expect(store.followedCommunityPosts).toEqual({
      old: { authorId: 'user-2', text: 'Old post', '.key': 'old' }
    })

    const olderUnsubscribe = unsubscribes.get('communityPosts/older')
    emit('user-1/communityThreads', { posts: { old: 100 } })
    expect(olderUnsubscribe).toHaveBeenCalledTimes(1)

    emit('communityPosts/old', null)
    expect(store.followedCommunityPosts).toEqual({})
  })

  it('loads the newest posts in one language, as many as asked for', () => {
    const store = useStore()
    store.user = { id: 'user-1' }
    store.initRef()
    store.setFeedQuery('de')

    const feed =
      'communityPosts|orderByChild=languageCreatedAt|startAt=de_|endAt=de_~|limitToLast=20'
    emit(feed, { p1: { text: 'Hallo', language: 'de' } })
    expect(store.communityPosts).toEqual([{ text: 'Hallo', language: 'de', '.key': 'p1' }])
    expect(store.feedLoaded).toBe(true)

    store.setFeedQuery('de', 40)
    expect(unsubscribes.get(feed)).toHaveBeenCalledTimes(1)
    expect(store.feedLoaded).toBe(false)
    expect(listeners.has(feed.replace('limitToLast=20', 'limitToLast=40'))).toBe(true)
  })

  it('follows the post the current link points to, and only that one', () => {
    const store = useStore()
    store.user = { id: 'user-1' }
    store.initRef()
    store.followLinkedPost('linked')

    emit('communityPosts/linked', { text: 'Old', language: 'de' })
    expect(store.followedCommunityPosts).toEqual({
      linked: { text: 'Old', language: 'de', '.key': 'linked' }
    })

    store.followLinkedPost('next')
    expect(unsubscribes.get('communityPosts/linked')).toHaveBeenCalledTimes(1)
    expect(listeners.has('communityPosts/next')).toBe(true)
  })

  it('ignores a link whose post ID is not a database key', () => {
    const store = useStore()
    store.user = { id: 'user-1' }
    store.initRef()
    for (const postId of ['a.b', 'a/b', 'a#b', '']) store.followLinkedPost(postId)
    expect([...listeners.keys()].filter((path) => path.startsWith('communityPosts/'))).toEqual([])
  })

  it('binds the community foods listener globally', () => {
    const store = useStore()
    store.user = { id: 'user-1' }
    store.initRef()

    emit('communityFoods', { '-Nxyz': { name: 'Rice cake', phe: 60 } })
    expect(store.communityFoods).toEqual([{ name: 'Rice cake', phe: 60, '.key': '-Nxyz' }])
  })
})

describe('store account switching', () => {
  // initRef runs both from the sign-in actions and from onAuthStateChanged, so
  // without teardown every login stacks a second set of listeners on top.
  it('unsubscribes the previous listeners before binding new ones', () => {
    const store = useStore()
    store.user = { id: 'user-1' }
    store.initRef()

    const firstRound = new Map(unsubscribes)
    expect([...firstRound.keys()].sort()).toEqual([
      'admins',
      'communityFoods',
      'communityPosts|orderByChild=authorId|equalTo=user-1',
      'communityProfiles',
      'user-1/communityReads',
      'user-1/communityThreads',
      'user-1/labValues',
      'user-1/newsSeen',
      'user-1/ownFood',
      'user-1/pheDiary',
      'user-1/settings'
    ])

    store.initRef()

    for (const [path, unsubscribe] of firstRound) {
      expect(unsubscribe, `listener for ${path} was left running`).toHaveBeenCalledTimes(1)
    }
  })

  it('drops the previous account data before the new snapshots arrive', () => {
    const store = useStore()
    store.user = { id: 'user-1' }
    store.initRef()

    emit('user-1/pheDiary', { '-Nabc': { date: '2026-07-26', phe: 300 } })
    emit('user-1/labValues', { '-Nlab': { date: '2026-07-20', phe: 240 } })
    emit('communityFoods', { '-Nfood': { name: 'Rice cake', phe: 60 } })
    emit('user-1/settings', { maxPhe: 300, healthDataConsent: true })
    expect(store.pheDiary).toHaveLength(1)

    // Second account signs in; nothing of the first may be readable in the gap
    // before its first snapshot lands.
    store.user = { id: 'user-2' }
    store.initRef()

    expect(store.pheDiary).toEqual([])
    expect(store.labValues).toEqual([])
    expect(store.ownFood).toEqual([])
    expect(store.communityFoods).toEqual([])
    expect(store.settings.maxPhe).toBeNull()
    expect(store.settings.healthDataConsent).toBe(false)
    expect(store.settingsLoaded).toBe(false)
  })

  it('binds the second account listeners under its own path', () => {
    const store = useStore()
    store.user = { id: 'user-1' }
    store.initRef()
    store.user = { id: 'user-2' }
    store.initRef()

    expect(listeners.has('user-2/pheDiary')).toBe(true)

    emit('user-2/pheDiary', { '-Nnew': { date: '2026-07-26', phe: 120 } })
    expect(store.pheDiary).toHaveLength(1)
    expect(store.pheDiary[0]?.phe).toBe(120)
  })

  it('clears health data and listeners on sign out', async () => {
    const store = useStore()
    store.user = { id: 'user-1' }
    store.initRef()
    emit('user-1/pheDiary', { '-Nabc': { date: '2026-07-26', phe: 300 } })
    emit('communityFoods', { '-Nfood': { name: 'Rice cake', phe: 60 } })
    emit('user-1/settings', { maxPhe: 300 })

    const bound = new Map(unsubscribes)
    await store.signOut()

    expect(store.user).toBeNull()
    expect(store.pheDiary).toEqual([])
    expect(store.communityFoods).toEqual([])
    expect(store.settings.maxPhe).toBeNull()
    expect(store.settingsLoaded).toBe(false)
    for (const unsubscribe of bound.values()) {
      expect(unsubscribe).toHaveBeenCalledTimes(1)
    }
    expect(store.unsubscribeFunctions).toEqual({})
  })

  it('leaves no stale unsubscribe handles behind', () => {
    const store = useStore()
    store.user = { id: 'user-1' }
    store.initRef()
    store.unsubscribeAll()

    expect(store.unsubscribeFunctions).toEqual({})
    // A second teardown must not re-invoke the already-called unsubscribes.
    const calls = [...unsubscribes.values()].map((fn) => fn.mock.calls.length)
    store.unsubscribeAll()
    expect([...unsubscribes.values()].map((fn) => fn.mock.calls.length)).toEqual(calls)
  })
})
