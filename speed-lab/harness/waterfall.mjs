import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const reqs = []
page.on('response', async r => {
  try {
    const req = r.request()
    const body = await r.body().catch(() => Buffer.alloc(0))
    reqs.push({ url: req.url(), status: r.status(), type: req.resourceType(), size: body.length, cc: r.headers()['cache-control'] || '-', etag: r.headers()['etag'] ? 'y' : '-' })
  } catch {}
})
await page.goto('http://localhost:4200/', { waitUntil: 'load' })
await page.waitForTimeout(3000)
const cold = [...reqs]; reqs.length = 0
await page.reload({ waitUntil: 'load' })
await page.waitForTimeout(3000)
const warm = [...reqs]
const sum = a => a.reduce((s, r) => s + r.size, 0)
const byHost = a => { const m = {}; for (const r of a) { const h = new URL(r.url).host; m[h] = m[h] || { n: 0, bytes: 0 }; m[h].n++; m[h].bytes += r.size } return m }
console.log('COLD:', cold.length, 'requests,', sum(cold), 'bytes'); console.log(byHost(cold))
console.log('WARM:', warm.length, 'requests,', sum(warm), 'bytes'); console.log(byHost(warm))
console.log('\ncold detail (top 25 by size):')
for (const r of cold.sort((a, b) => b.size - a.size).slice(0, 25)) console.log(String(r.size).padStart(8), r.status, r.type.padEnd(10), r.cc.padEnd(10), r.url.replace('http://localhost', ''))
await browser.close()
