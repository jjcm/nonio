// Lab probe: what actually happens on homepage -> tag navigation.
// Confirms whether the destination feed is a fresh list + fresh fetch, or the
// stale homepage list being relabelled.
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', e => console.error('[pageerror]', e.message))

const reqs = []
page.on('request', r => reqs.push({ t: Date.now(), url: r.url() }))

await page.goto('http://localhost:4200/', { waitUntil: 'load' })
await page.waitForTimeout(4000)

const before = await page.evaluate(() => {
  const lists = [...document.querySelectorAll('nonio-post-list')]
  lists.forEach((l, i) => { l.__labId = 'pre' + i })
  return lists.map(l => ({ id: l.__labId, tag: l.getAttribute('tag'), rows: l.querySelectorAll('nonio-post-li, nonio-post-card').length }))
})
console.log('BEFORE lists:', JSON.stringify(before))

const mark = Date.now()
reqs.length = 0

const trace = await page.evaluate(() => new Promise(res => {
  const log = []
  const t0 = performance.now()
  const snap = () => {
    const lists = [...document.querySelectorAll('nonio-post-list')]
    return lists.map(l => ({
      id: l.__labId || 'NEW',
      tag: l.getAttribute('tag'),
      loaded: l.hasAttribute('loaded'),
      rows: l.querySelectorAll('nonio-post-li, nonio-post-card').length,
      itemsOpacity: l.shadowRoot?.querySelector('#items') ? getComputedStyle(l.shadowRoot.querySelector('#items')).opacity : null
    }))
  }
  const tick = () => {
    const t = performance.now() - t0
    log.push({ t: Math.round(t), lists: snap(), hash: location.hash })
    if (t > 2500) return res(log)
    setTimeout(tick, 40)
  }
  // click the photography tag link
  const links = []
  const walk = (root, d) => {
    root.querySelectorAll?.('nonio-link').forEach(l => links.push(l))
    ;(root.querySelectorAll?.('*') || []).forEach(el => { if (el.shadowRoot && d < 5) walk(el.shadowRoot, d + 1) })
  }
  walk(document, 0)
  const target = links.map(l => l.shadowRoot?.querySelector('a') || l.querySelector('a')).find(a => a?.getAttribute('href') === '/#photography')
  log.push({ t: 0, note: 'clicking', found: !!target })
  tick()
  target.click()
}))

console.log('\nNETWORK after click:')
reqs.filter(r => r.t >= mark).forEach(r => console.log(' +' + (r.t - mark) + 'ms', r.url))

console.log('\nTRACE (changes only):')
let prev = ''
for (const s of trace) {
  const k = JSON.stringify(s.lists) + s.hash
  if (k !== prev) { console.log(' t=' + s.t, s.hash, JSON.stringify(s.lists)); prev = k }
}

await browser.close()
