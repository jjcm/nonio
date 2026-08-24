// Lab probe: CPU profile of the client work between a navigation's API response
// landing and the destination being visible.
// Usage: node profile-nav.mjs --href '/#photography' [--lane slow4g]
import { chromium } from 'playwright'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d }
const HREF = arg('href', '/#photography')
const LANE = arg('lane', 'slow4g')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', e => console.error('[pageerror]', e.message))

await page.addInitScript(() => {
  window.__deepAll = (sel, root = document, acc = []) => {
    root.querySelectorAll?.(sel).forEach(e => acc.push(e))
    ;(root.querySelectorAll?.('*') || []).forEach(el => { if (el.shadowRoot) window.__deepAll(sel, el.shadowRoot, acc) })
    return acc
  }
})

await page.goto('http://localhost:4200/', { waitUntil: 'load' })
await page.waitForTimeout(4000)

const cdp = await page.context().newCDPSession(page)
await cdp.send('Network.enable')
if (LANE === 'slow4g') {
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8
  })
}
await cdp.send('Profiler.enable')
await cdp.send('Profiler.setSamplingInterval', { interval: 100 })
await cdp.send('Profiler.start')

await page.evaluate(h => {
  const target = window.__deepAll('soci-link')
    .map(l => l.shadowRoot?.querySelector('a') || l.querySelector('a'))
    .find(a => a?.getAttribute('href') === h)
  target.click()
}, HREF)
await page.waitForTimeout(2500)

const { profile } = await cdp.send('Profiler.stop')

// Self time per function, then roll up by file.
const byId = new Map(profile.nodes.map(n => [n.id, n]))
const self = new Map()
const total = profile.samples.length
for (const id of profile.samples) {
  const n = byId.get(id)
  if (!n) continue
  const f = n.callFrame
  const key = `${f.functionName || '(anon)'} @ ${(f.url || '').replace(/^https?:\/\/[^/]+/, '')}:${f.lineNumber}`
  self.set(key, (self.get(key) || 0) + 1)
}
const usPerSample = profile.endTime - profile.startTime
const msPer = (usPerSample / total) / 1000

console.log(`CPU profile during navigation to ${HREF} (lane=${LANE})`)
console.log(`total samples ${total}, wall ${(usPerSample / 1000).toFixed(0)}ms\n`)
console.log('top self-time frames:')
;[...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
  .forEach(([k, c]) => console.log(`  ${(c * msPer).toFixed(1).padStart(7)}ms  ${k}`))

const byFile = new Map()
for (const [k, c] of self) {
  const file = (k.split(' @ ')[1] || '?').split(':')[0]
  byFile.set(file, (byFile.get(file) || 0) + c)
}
console.log('\nby file:')
;[...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
  .forEach(([k, c]) => console.log(`  ${(c * msPer).toFixed(1).padStart(7)}ms  ${k}`))

await browser.close()
