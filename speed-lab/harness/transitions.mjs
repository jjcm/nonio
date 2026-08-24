// speed-lab/harness/transitions.mjs
// LAB ONLY. Measures warm in-app SPA transitions on nonio, after the homepage
// has already loaded.
//
// Usage:
//   node transitions.mjs --label baseline --n 5 --throttle slow4g --out r.json
//   node transitions.mjs --routes tag,user,post --lanes slow4g,fast
//
// METRIC (stable definition, do not change between iterations)
// ------------------------------------------------------------
// Per run we load the homepage, wait until its feed is fully painted and idle,
// then take t0 = performance.now() immediately before dispatching the click on
// a real in-feed affordance (a <soci-link> anchor, so the app's own pushState
// path runs). From t0 we rAF-poll the destination and record three numbers:
//
//   fcr     first contentful render. The destination's primary content node is
//           in the DOM, has non-zero layout, and its effective opacity (product
//           of opacity up the ancestor+shadow-host chain) is > 0.01. This is the
//           first frame on which the user can see any of the destination.
//   visible the same node reaches effective opacity >= 0.9. Separates "content
//           exists" from "content has finished fading in", so entrance
//           animations cannot be mistaken for render work (or hidden by it).
//   usable  route-specific "the thing you navigated for is all there":
//             tag  -> >= 8 rows present and the first row's media decoded
//             user -> >= 8 rows present and the first row's media decoded
//             post -> post body text painted AND >= 5 comments in the tree
//
// n runs per route per lane, medians reported. A fresh browser per run; the
// homepage load inside each run warms the HTTP cache, so the measured click is
// a warm SPA transition and never a cold document load.

import { chromium } from 'playwright'
import fs from 'fs'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d }

const BASE = arg('base', 'http://localhost:4200')
const N = parseInt(arg('n', '5'))
const LABEL = arg('label', 'run')
const OUT = arg('out', '')
const ROUTES = arg('routes', 'tag,user,post').split(',')
const LANES = arg('lanes', 'slow4g,wifi').split(',')
const TAG = arg('tag', 'photography')
const USER = arg('user', 'speedlab')
const POST = arg('post', 'speed-lab-measured-post')
const HOME_SETTLE = parseInt(arg('settle', '1200'))
const BUDGET = parseInt(arg('budget', '20000'))
const TRACE = process.argv.includes('--trace')

const median = a => {
  const s = a.filter(x => typeof x === 'number' && x >= 0).sort((x, y) => x - y)
  if (!s.length) return -1
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const r1 = v => (typeof v === 'number' && v >= 0 ? Math.round(v * 10) / 10 : v)

// ---------------------------------------------------------------------------
// In-page toolkit. Installed via addInitScript so it survives the homepage load
// and is available to every evaluate() call.
// ---------------------------------------------------------------------------
const initScript = () => {
  const T = {}
  window.__T = T

  // Depth-first query that pierces open shadow roots.
  T.deep = (sel, root = document) => {
    const hit = root.querySelector?.(sel)
    if (hit) return hit
    const kids = root.querySelectorAll?.('*') || []
    for (const el of kids) {
      if (el.shadowRoot) {
        const found = T.deep(sel, el.shadowRoot)
        if (found) return found
      }
    }
    return null
  }

  T.deepAll = (sel, root = document, acc = []) => {
    root.querySelectorAll?.(sel).forEach(e => acc.push(e))
    ;(root.querySelectorAll?.('*') || []).forEach(el => {
      if (el.shadowRoot) T.deepAll(sel, el.shadowRoot, acc)
    })
    return acc
  }

  // Product of opacity along the FLATTENED tree from `el` upward. Following
  // assignedSlot matters: feed rows are light-DOM children slotted into
  // soci-post-list's shadow #items, and #items is the element the entrance
  // animation puts at opacity 0. Walking parentElement alone would report a
  // fully-hidden row as opacity 1.
  T.effOpacity = el => {
    let o = 1
    let node = el
    while (node && node !== document.documentElement) {
      if (node.nodeType === 1) {
        const cs = getComputedStyle(node)
        if (cs.display === 'none' || cs.visibility === 'hidden') return 0
        o *= parseFloat(cs.opacity)
        if (o <= 0) return 0
      }
      node = node.assignedSlot || node.parentElement || node.parentNode?.host || node.parentNode
    }
    return o
  }

  T.painted = el => {
    if (!el) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }

  // An in-feed link the app itself would follow: find the <soci-link> whose
  // href matches, then its inner <a>. Clicking the <a> runs soci-link's
  // localLink handler -> history.pushState -> router, i.e. the real path.
  T.findLink = href => {
    for (const l of T.deepAll('soci-link')) {
      const a = l.shadowRoot?.querySelector('a') || l.querySelector('a')
      const h = a?.getAttribute('href') || l.getAttribute('href')
      if (h === href) return a || l
    }
    return null
  }

  T.route = id => document.querySelector('soci-route#' + id)

  // The destination feed, identified by the attribute the page set on it rather
  // than by "a post-list exists". Homepage -> tag is a same-route navigation, so
  // the previous list and its 21 rows are still in the DOM at t0; without this
  // check the probe would score the stale homepage feed as an instant render.
  T.destList = (routeId, attr, value) => {
    const route = T.route(routeId)
    if (!route || !route.hasAttribute('active')) return null
    for (const l of T.deepAll('soci-post-list', route)) {
      if ((l.getAttribute(attr) || '') === value) return l
    }
    return null
  }

  T.rowsOf = list => (list ? T.deepAll('soci-post-li, soci-post-card', list) : [])

  T.mediaReady = row => {
    if (!row) return false
    const img = row.shadowRoot?.querySelector('#thumbnail img') ||
      row.shadowRoot?.querySelector('img') || row.querySelector('img')
    // No img, or an img the row never sourced (text rows keep an empty <img>
    // in their template): nothing to decode.
    if (!img || !img.src) return true
    return img.complete && img.naturalWidth > 0
  }

  // The post page's primary content block (title + byline + body). Gated by the
  // `url` attribute so a leftover soci-post from the inactive route template
  // cannot be mistaken for the destination.
  T.postBody = slug => {
    const route = T.route('post')
    if (!route || !route.hasAttribute('active')) return null
    const post = T.deep('soci-post', route)
    if (!post || post.getAttribute('url') !== slug) return null
    const el = post.shadowRoot?.querySelector('#details-container')
    if (!el || (el.textContent || '').trim().length < 5 || !T.painted(el)) return null
    return el
  }

  T.comments = () => T.deepAll('soci-comment').filter(c => (c.textContent || '').trim().length > 2)

  // Force a style resolution on the animated wrappers every frame.
  //
  // Without this the harness perturbs what it measures. The entrance fade only
  // arms if the browser resolves style on a freshly-created #items while it is
  // still opacity 0; on localhost the destination fetch can resolve inside the
  // same frame as the click, so whether the 350ms fade runs at all depends on
  // whether anything happened to read style first. Reading unconditionally puts
  // every run and every iteration on identical footing.
  T.pump = () => {
    let acc = 0
    for (const l of T.deepAll('soci-post-list')) {
      const items = l.shadowRoot?.querySelector('#items')
      if (items) acc += parseFloat(getComputedStyle(items).opacity)
    }
    for (const p of T.deepAll('soci-post')) acc += parseFloat(getComputedStyle(p).opacity)
    return acc
  }

  // ------------------------------------------------------------------
  // The measured navigation. Returns { t0, fcr, visible, usable, ... }
  // all relative to t0 (ms).
  // ------------------------------------------------------------------
  T.navigate = (kind, href, budget, dest) => new Promise(resolve => {
    const out = { kind, href, fcr: -1, visible: -1, usable: -1, rows: 0, comments: 0, error: null }
    T.destTag = dest.tag
    T.destUser = dest.user
    T.destSlug = dest.slug

    const feedProbe = (routeId, attr, value) => () => {
      const list = T.destList(routeId, attr, value)
      const rows = T.rowsOf(list)
      out.rows = rows.length
      const first = rows[0]
      const op = first ? T.effOpacity(first) : -1
      const seen = !!first && T.painted(first) && op > 0.01
      return {
        seen,
        shown: !!first && op >= 0.9,
        done: seen && rows.length >= 8 && T.mediaReady(first),
        op: Math.round(op * 1000) / 1000
      }
    }

    const probes = {
      tag: feedProbe('tags', 'tag', T.destTag),
      user: feedProbe('user', 'user', T.destUser),
      post: () => {
        const body = T.postBody(T.destSlug)
        out.comments = T.comments().length
        const op = body ? T.effOpacity(body) : -1
        const seen = !!body && op > 0.01
        return {
          seen,
          shown: !!body && op >= 0.9,
          done: seen && out.comments >= 5,
          op: Math.round(op * 1000) / 1000
        }
      }
    }
    const probe = probes[kind]

    const target = T.findLink(href)
    if (!target) { out.error = 'link not found: ' + href; return resolve(out) }

    const t0 = performance.now()
    out.t0 = t0

    if (dest.trace) out.trace = []

    const tick = () => {
      const now = performance.now() - t0
      let s
      try { T.pump(); s = probe() } catch (e) { out.error = String(e); return resolve(out) }
      if (out.trace) out.trace.push({ t: Math.round(now * 10) / 10, ...s, rows: out.rows, op: s.op })
      if (s.seen && out.fcr < 0) out.fcr = now
      if (s.shown && out.visible < 0) out.visible = now
      if (s.done && out.usable < 0) out.usable = now
      if (out.fcr >= 0 && out.visible >= 0 && out.usable >= 0) return resolve(out)
      if (now > budget) { out.error = out.error || 'budget exceeded'; return resolve(out) }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)

    // Click after the observer is armed but inside the same task, so no frame
    // can slip between t0 and the navigation.
    target.click()
  })

  // Homepage readiness: unfiltered feed painted, fully revealed, media decoded.
  T.homeReady = () => {
    const rows = T.rowsOf(T.destList('tags', 'tag', 'all'))
    const first = rows[0]
    return rows.length >= 8 && !!first && T.painted(first) &&
      T.effOpacity(first) >= 0.9 && T.mediaReady(first)
  }
}

// slow4g matches the throttle the earlier nonio feed-load lab used, so numbers
// stay comparable. wifi is a realistic desktop profile; it is still slow enough
// that the destination fetch cannot resolve inside the click's own frame, which
// an unthrottled localhost lane does — collapsing every route to a single frame
// and hiding both the fetch and the entrance animation.
const LANE_PROFILES = {
  slow4g: { latency: 150, down: (1.6 * 1024 * 1024) / 8, up: (750 * 1024) / 8 },
  wifi: { latency: 20, down: (20 * 1024 * 1024) / 8, up: (5 * 1024 * 1024) / 8 }
}

async function applyLane(page, lane) {
  const p = LANE_PROFILES[lane]
  if (!p) return
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: p.latency, downloadThroughput: p.down, uploadThroughput: p.up
  })
  return cdp
}

const HREF = { tag: () => `/#${TAG}`, user: () => `/user/${USER}`, post: () => `/${POST}` }

// See measure.mjs: QUIC bypasses CDP throttling, pin to h1/h2.
const LAUNCH = process.env.H3 === '1' ? {} : { args: ['--disable-quic'] }

async function oneRun(kind, lane) {
  const browser = await chromium.launch(LAUNCH)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.addInitScript(initScript)
  const errs = []
  page.on('pageerror', e => errs.push(e.message))

  // Homepage load is unthrottled: it is setup, not the measurement. Throttling
  // is applied afterwards so it only shapes the transition being measured.
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60000 })
  await page.waitForFunction(() => window.__T.homeReady(), null, { timeout: 30000 })
    .catch(() => { errs.push('home not ready') })
  await page.waitForTimeout(HOME_SETTLE)

  await applyLane(page, lane)

  const res = await page.evaluate(
    ([k, h, b, d]) => window.__T.navigate(k, h, b, d),
    [kind, HREF[kind](), BUDGET, { tag: TAG, user: USER, slug: POST, trace: TRACE }]
  )
  res.pageErrors = errs
  await browser.close()
  return res
}

const results = { label: LABEL, base: BASE, n: N, timestamp: new Date().toISOString(), lanes: {} }

for (const lane of LANES) {
  results.lanes[lane] = {}
  for (const kind of ROUTES) {
    const runs = []
    for (let i = 0; i < N; i++) {
      const r = await oneRun(kind, lane)
      runs.push(r)
      console.error(
        `[${LABEL}] ${lane}/${kind} ${i + 1}/${N}: fcr ${r1(r.fcr)} visible ${r1(r.visible)} ` +
        `usable ${r1(r.usable)} (rows ${r.rows} comments ${r.comments})` +
        (r.error ? ` ERR ${r.error}` : '') + (r.pageErrors.length ? ` PE ${r.pageErrors[0]}` : '')
      )
      if (TRACE && r.trace) {
        let prev = ''
        for (const s of r.trace) {
          const k = `${s.seen}|${s.shown}|${s.done}|${s.rows}|${s.op}`
          if (k !== prev) { console.error(`    t=${s.t} rows=${s.rows} op=${s.op} seen=${s.seen} shown=${s.shown} done=${s.done}`); prev = k }
        }
      }
    }
    results.lanes[lane][kind] = {
      fcr: r1(median(runs.map(r => r.fcr))),
      visible: r1(median(runs.map(r => r.visible))),
      usable: r1(median(runs.map(r => r.usable))),
      errors: runs.map(r => r.error).filter(Boolean),
      runs: runs.map(r => ({ fcr: r1(r.fcr), visible: r1(r.visible), usable: r1(r.usable), rows: r.rows, comments: r.comments, error: r.error }))
    }
    const m = results.lanes[lane][kind]
    console.error(`[${LABEL}] == ${lane}/${kind} MEDIAN fcr ${m.fcr} visible ${m.visible} usable ${m.usable}`)
  }
}

console.log(JSON.stringify(results, null, 2))
if (OUT) fs.writeFileSync(OUT, JSON.stringify(results, null, 2))
