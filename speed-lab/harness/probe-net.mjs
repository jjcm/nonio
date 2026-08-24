// Lab probe: network waterfall for a single warm in-app navigation.
// Usage: node probe-net.mjs --href /sl-txt-01 [--lane slow4g]
import { chromium } from 'playwright'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d }
const HREF = arg('href', '/sl-txt-01')
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

if (LANE !== 'none') {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8
  })
}

const events = []
const t0 = Date.now()
page.on('request', r => events.push({ t: Date.now() - t0, kind: 'start', url: r.url() }))
page.on('response', r => events.push({ t: Date.now() - t0, kind: 'end  ', url: r.url(), status: r.status() }))

await page.evaluate(h => {
  const target = window.__deepAll('soci-link')
    .map(l => l.shadowRoot?.querySelector('a') || l.querySelector('a'))
    .find(a => a?.getAttribute('href') === h)
  if (!target) throw new Error('no link ' + h)
  target.click()
}, HREF)

await page.waitForTimeout(3500)

console.log(`waterfall for ${HREF} (lane=${LANE}), t=0 at click:`)
for (const e of events) {
  const u = e.url.replace('http://localhost:', ':')
  console.log(`  ${String(e.t).padStart(5)}ms ${e.kind} ${e.status || ''} ${u}`)
}
await browser.close()
