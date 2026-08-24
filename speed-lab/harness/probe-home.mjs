// Lab probe: what the homepage loads, and when load fires relative to it.
import { chromium } from 'playwright'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d }
const LANE = arg('lane', 'slow4g')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', e => console.error('[pageerror]', e.message))

if (LANE === 'slow4g') {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8
  })
}

const failed = []
page.on('requestfailed', r => failed.push({ url: r.url(), error: r.failure()?.errorText }))

await page.goto('http://localhost:4200/', { waitUntil: 'load', timeout: 60000 })
await page.waitForTimeout(3000)

const info = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0]
  const list = document.querySelector('soci-post-list')
  return {
    load: Math.round(nav.loadEventEnd),
    dcl: Math.round(nav.domContentLoadedEventEnd),
    rows: list?.querySelectorAll('soci-post-li, soci-post-card').length,
    resources: performance.getEntriesByType('resource')
      .map(r => ({ n: r.name.replace(/^https?:\/\/localhost/, ''), s: Math.round(r.startTime), e: Math.round(r.responseEnd), sz: r.transferSize }))
      .sort((a, b) => b.e - a.e)
  }
})

console.log(`load=${info.load}ms dcl=${info.dcl}ms rows=${info.rows} resources=${info.resources.length}`)
console.log('\nlast 15 resources to finish (these set loadEventEnd):')
info.resources.slice(0, 15).forEach(r => console.log(`  end ${String(r.e).padStart(5)}ms  start ${String(r.s).padStart(5)}ms  ${String(r.sz).padStart(7)}B  ${r.n}`))

const total = info.resources.reduce((a, r) => a + (r.sz || 0), 0)
console.log(`\ntotal transfer: ${total} bytes over ${info.resources.length} resources`)
if (failed.length) {
  console.log('\nFAILED requests:')
  failed.forEach(f => console.log(`  ${f.error}  ${f.url}`))
}
await browser.close()
