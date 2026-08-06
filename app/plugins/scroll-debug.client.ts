/**
 * TEMPORARY on-device diagnostic for the "scroll gets stuck" bug on iOS PWA.
 * Delete this file once the cause is confirmed.
 *
 * Activation (works in an installed PWA, where there is no address bar):
 *   press and hold TWO fingers anywhere for 1.5s -> toggles the overlay
 *   the choice is remembered, so it survives navigation and relaunch
 *   on desktop, ?scrolldebug=1 / ?scrolldebug=0 also works
 *
 * While disabled this only registers three passive touch listeners for the
 * activation gesture. Passive listeners cannot call preventDefault(), so the
 * diagnostic can never itself be the reason a gesture fails to scroll.
 *
 * What it answers, for one stuck gesture:
 *  - did ANY scroll container move, or was the gesture truly swallowed
 *  - was touchmove preventDefault()-ed (headlessui's iOS lock does this)
 *  - is a scroll lock still applied to <html> with no dialog open
 *  - are there leaked inline `touch-action: none` styles left on elements
 *  - how many document-level touch listeners are live (ours are excluded)
 */

const STORAGE_KEY = 'pkutools:scrolldebug'
const HOLD_MS = 1500

type Counter = { added: number; removed: number }

export default defineNuxtPlugin(() => {
  if (import.meta.server) return

  // Listeners this plugin registers itself. The leak counter must skip these,
  // otherwise it reports its own instrumentation as a leak (it did before).
  const own = new WeakSet<object>()
  const ownAdd = <T extends EventListener>(
    target: EventTarget,
    type: string,
    fn: T,
    opts?: AddEventListenerOptions
  ) => {
    own.add(fn)
    target.addEventListener(type, fn, { passive: true, ...opts })
  }

  const params = new URLSearchParams(window.location.search)
  if (params.get('scrolldebug') === '1') localStorage.setItem(STORAGE_KEY, '1')
  if (params.get('scrolldebug') === '0') localStorage.removeItem(STORAGE_KEY)

  let enabled = localStorage.getItem(STORAGE_KEY) === '1'
  let teardown: (() => void) | null = null

  // --- activation gesture: two-finger press and hold -----------------------
  let holdTimer: ReturnType<typeof setTimeout> | null = null
  const cancelHold = () => {
    if (holdTimer) clearTimeout(holdTimer)
    holdTimer = null
  }

  ownAdd(document, 'touchstart', ((e: TouchEvent) => {
    cancelHold()
    if (e.touches.length !== 2) return
    holdTimer = setTimeout(() => {
      holdTimer = null
      enabled = !enabled
      if (enabled) localStorage.setItem(STORAGE_KEY, '1')
      else localStorage.removeItem(STORAGE_KEY)
      if (enabled) teardown = start()
      else {
        teardown?.()
        teardown = null
        flash('scroll debug OFF')
      }
    }, HOLD_MS)
  }) as EventListener)

  ownAdd(document, 'touchend', cancelHold as EventListener)
  ownAdd(document, 'touchcancel', cancelHold as EventListener)

  function flash(text: string) {
    const el = document.createElement('div')
    el.textContent = text
    el.style.cssText =
      'position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);z-index:2147483647;' +
      'background:rgba(0,0,0,.88);color:#fff;font:600 13px system-ui;padding:10px 16px;' +
      'border-radius:10px;pointer-events:none'
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 1400)
  }

  if (enabled) teardown = start()

  // --- instrumentation, only while enabled ---------------------------------
  function start() {
    flash('scroll debug ON')

    // Count document-level touch listeners, skipping our own.
    const counts: Record<string, Counter> = {
      touchmove: { added: 0, removed: 0 },
      touchstart: { added: 0, removed: 0 }
    }
    const origAdd = EventTarget.prototype.addEventListener
    const origRemove = EventTarget.prototype.removeEventListener

    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const c = counts[type]
      if (c && this === document && listener && !own.has(listener)) c.added++
      return origAdd.call(this, type, listener, options)
    }
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      const c = counts[type]
      if (c && this === document && listener && !own.has(listener)) c.removed++
      return origRemove.call(this, type, listener, options)
    }

    const box = document.createElement('div')
    box.style.cssText = [
      'position:fixed',
      'left:4px',
      'right:4px',
      'bottom:4px',
      'z-index:2147483646',
      'font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace',
      'white-space:pre-wrap',
      'background:rgba(0,0,0,.86)',
      'color:#0f0',
      'padding:6px 8px',
      'border-radius:8px',
      'pointer-events:none',
      'max-height:46vh',
      'overflow:hidden'
    ].join(';')
    document.body.appendChild(box)

    const describe = (el: Element | null) => {
      if (!el) return 'null'
      if (el === document.documentElement) return 'html'
      if (el === document.body) return 'body'
      const cls = (el.getAttribute('class') || '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .join('.')
      return cls ? `${el.tagName.toLowerCase()}.${cls}` : el.tagName.toLowerCase()
    }

    // Every scroll container between the touch target and the page, plus the
    // page itself. Checking only window.scrollY (the previous version) reports
    // a successful inner-container scroll as "stuck".
    const scrollChain = (start: Element | null) => {
      const chain: Element[] = []
      let node: Element | null = start
      while (node) {
        const cs = getComputedStyle(node)
        if (/auto|scroll/.test(cs.overflowY + cs.overflowX)) chain.push(node)
        node = node.parentElement
      }
      const page = document.scrollingElement || document.documentElement
      if (!chain.includes(page)) chain.push(page)
      return chain
    }

    let watched: { el: Element; top: number; left: number }[] = []
    let startX = 0
    let startY = 0
    let prevented = false
    let moves = 0
    let targetInfo = '(no gesture yet)'
    let lastResult = ''

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t || e.touches.length > 1) return
      startX = t.clientX
      startY = t.clientY
      prevented = false
      moves = 0

      const target = e.target as Element | null
      watched = scrollChain(target).map((el) => ({
        el,
        top: el.scrollTop,
        left: el.scrollLeft
      }))

      const inlineTA =
        target instanceof HTMLElement ? target.style.touchAction || '-' : '(SVG/non-HTML)'
      const cs = target instanceof Element ? getComputedStyle(target) : null
      targetInfo =
        `target : ${describe(target)}\n` +
        `  touch-action inline=${inlineTA} computed=${cs?.touchAction ?? '?'}\n` +
        `  scroll chain: ${watched.map((w) => describe(w.el)).join(' < ') || '(none)'}`
    }

    // Bubble phase on window fires after document-level bubble listeners, so
    // defaultPrevented here reflects headlessui's blocker if it ran.
    const onMove = (e: TouchEvent) => {
      moves++
      if (e.defaultPrevented) prevented = true
    }

    const onEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0]
      if (!t) return
      const dx = Math.round(t.clientX - startX)
      const dy = Math.round(t.clientY - startY)
      const fingerMoved = Math.max(Math.abs(dx), Math.abs(dy))

      const movedEls = watched
        .filter((w) => w.el.scrollTop !== w.top || w.el.scrollLeft !== w.left)
        .map(
          (w) =>
            `${describe(w.el)} ${Math.round(w.el.scrollTop - w.top)}/${Math.round(
              w.el.scrollLeft - w.left
            )}`
        )

      const stuck = fingerMoved > 15 && movedEls.length === 0
      lastResult =
        `gesture dx=${dx} dy=${dy} moves=${moves}\n` +
        `scrolled: ${movedEls.length ? movedEls.join(', ') : 'NOTHING'}` +
        `${stuck ? '   <-- STUCK' : ''}\n` +
        `touchmove preventDefault: ${prevented ? 'YES' : 'no'}`
      render()
    }

    ownAdd(document, 'touchstart', onStart as EventListener, { capture: true })
    ownAdd(window, 'touchmove', onMove as EventListener)
    ownAdd(document, 'touchend', onEnd as EventListener, { capture: true })

    function render() {
      const html = document.documentElement
      const inlineOverflow = html.style.overflow || '-'
      const dialogs = document.querySelectorAll('[role="dialog"]').length

      // headlessui writes these inline and removes them only if its cleanup ran.
      const leakedTA = Array.from(
        document.querySelectorAll<HTMLElement>('[style*="touch-action"]')
      ).filter((el) => el.style.touchAction === 'none').length
      const leakedOB = Array.from(
        document.querySelectorAll<HTMLElement>('[style*="overscroll-behavior"]')
      ).filter((el) => el.style.overscrollBehavior === 'contain').length

      const liveMove = counts.touchmove!.added - counts.touchmove!.removed
      const liveStart = counts.touchstart!.added - counts.touchstart!.removed

      const idle = dialogs === 0
      const lockLeak = idle && inlineOverflow === 'hidden'
      const listenerLeak = idle && liveMove > 0
      const styleLeak = idle && (leakedTA > 0 || leakedOB > 0)
      const bad = lockLeak || listenerLeak || styleLeak || prevented

      box.style.color = bad ? '#ff6b6b' : '#0f0'
      box.textContent =
        `dialogs open      : ${dialogs}\n` +
        `<html> overflow   : ${inlineOverflow}${lockLeak ? '   <-- LOCK LEAKED' : ''}\n` +
        `doc listeners     : move ${liveMove} / start ${liveStart}` +
        `${listenerLeak ? '   <-- LISTENER LEAKED' : ''}\n` +
        `inline leaks      : touch-action:none ${leakedTA}, overscroll:contain ${leakedOB}` +
        `${styleLeak ? '   <-- STYLE LEAKED' : ''}\n` +
        `${'-'.repeat(44)}\n` +
        `${lastResult || '(no gesture yet)'}\n` +
        `${'-'.repeat(44)}\n` +
        targetInfo
    }

    render()
    const timer = setInterval(render, 500)

    return () => {
      clearInterval(timer)
      box.remove()
      document.removeEventListener('touchstart', onStart as EventListener, { capture: true })
      window.removeEventListener('touchmove', onMove as EventListener)
      document.removeEventListener('touchend', onEnd as EventListener, { capture: true })
      EventTarget.prototype.addEventListener = origAdd
      EventTarget.prototype.removeEventListener = origRemove
    }
  }
})
