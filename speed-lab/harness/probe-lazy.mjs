// Verifies the lazy component graph: which /components|/lib modules load in
// each phase (first paint vs idle warmup vs route enter), and that no phase
// pulls modules it shouldn't. Throttled so the phases can't race each other.
// Usage: node probe-lazy.mjs [base-url]

import { chromium } from 'playwright'

const BASE = process.argv[2] || 'http://localhost:4200'
const POST_LINK_MODULES = ['soci-post.js', 'soci-comment.js', 'soci-comment-list.js']
const FEED_MODULES = ['soci-post-list.js', 'soci-post-li.js', 'grid-lanes-polyfill.js']
const HEAVY_LAZY = ['soci-text-channel-view-threaded.js', 'soci-avatar-uploader.js', 'soci-video-uploader.js', 'soci-ledger.js', 'soci-input.js', ...POST_LINK_MODULES]

let failures = 0
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}
const names = reqs => reqs.map(u => u.split('/').pop().split('?')[0])

async function phase(page, throttle = true) {
  if (throttle) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 40, downloadThroughput: 3_000_000 / 8, uploadThroughput: 1_000_000 / 8
    })
  }
  const js = []
  const errors = []
  page.on('request', r => { const u = r.url(); if (/\/(components|lib)\/.*\.js/.test(u)) js.push(u) })
  page.on('pageerror', e => errors.push(String(e)))
  // Script errors only: 4xx console noise (e.g. anonymous /emojis/sets 401)
  // predates the lazy graph and fires identically on master.
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
  return { js, errors }
}

const browser = await chromium.launch()

{ // Phase 1+2: cold home -> feed paint, then idle warmup
  const page = await browser.newPage()
  const { js, errors } = await phase(page)
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('soci-post-li', { state: 'attached', timeout: 30000 })
  const atPaint = names(js)

  check(FEED_MODULES.every(m => atPaint.includes(m)), `feed pack requested by feed paint (${atPaint.length} modules)`)
  const leaked = HEAVY_LAZY.filter(m => atPaint.includes(m))
  check(leaked.length === 0, `no off-route modules before feed paint${leaked.length ? ': ' + leaked : ''}`)

  await page.waitForLoadState('load')
  await page.waitForTimeout(6000)
  const afterIdle = names(js)
  check(POST_LINK_MODULES.every(m => afterIdle.includes(m)), `idle warmup fetched the deferred graph (${afterIdle.length} modules)`)

  // Route enter still works end to end after warmup
  await page.locator('soci-post-li #metadata-link').first().click()
  await page.waitForSelector('soci-post[url]', { state: 'attached', timeout: 15000 })
  await page.waitForSelector('soci-comment', { state: 'attached', timeout: 15000 })
  check(true, 'feed -> post transition renders post and comments')
  check(errors.length === 0, `no console/page errors on home${errors.length ? ': ' + errors[0] : ''}`)
  await page.close()
}

{ // Phase 3: cold post deep link must not pull the feed pack before paint
  const page = await browser.newPage()
  const { js, errors } = await phase(page)
  await page.goto(BASE + '/speed-lab-measured-post', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('soci-comment', { state: 'attached', timeout: 30000 })
  const atPaint = names(js)

  check(POST_LINK_MODULES.every(m => atPaint.includes(m)), `post pack requested by post paint (${atPaint.length} modules)`)
  const leaked = FEED_MODULES.filter(m => atPaint.includes(m))
  check(leaked.length === 0, `no feed modules before post paint${leaked.length ? ': ' + leaked : ''}`)
  check(errors.length === 0, `no console/page errors on deep link${errors.length ? ': ' + errors[0] : ''}`)
  await page.close()
}

await browser.close()
console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed')
process.exit(failures ? 1 : 0)
