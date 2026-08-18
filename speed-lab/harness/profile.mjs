import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const cdp = await page.context().newCDPSession(page)
await cdp.send('Network.enable')
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
await page.addInitScript(() => {
  window.__fcp = -1
  new PerformanceObserver(l => { const e = l.getEntries().find(p => p.name === 'first-contentful-paint'); if (e) window.__fcp = e.startTime }).observe({ type: 'paint', buffered: true })
})
await page.goto('http://localhost:4200/', { waitUntil: 'load', timeout: 60000 })
await page.waitForTimeout(3000)
const data = await page.evaluate(() => ({
  fcp: window.__fcp,
  res: performance.getEntriesByType('resource').map(r => ({
    name: r.name.replace('http://localhost', ''),
    start: Math.round(r.startTime), end: Math.round(r.responseEnd),
    size: r.transferSize
  })).sort((a, b) => a.end - b.end)
}))
console.log('FCP:', data.fcp.toFixed(0))
console.log('resources finishing BEFORE FCP:')
for (const r of data.res.filter(r => r.end <= data.fcp)) console.log(String(r.start).padStart(6), '->', String(r.end).padStart(6), String(r.size).padStart(7), r.name)
console.log('first 5 after FCP:')
for (const r of data.res.filter(r => r.end > data.fcp).slice(0, 5)) console.log(String(r.start).padStart(6), '->', String(r.end).padStart(6), String(r.size).padStart(7), r.name)
await browser.close()
