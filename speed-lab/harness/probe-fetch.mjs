// Lab probe: attribute every API request made during one in-app navigation to
// the code path that issued it.
// Usage: node probe-fetch.mjs --href /user/speedlab
import { chromium } from 'playwright'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d }
const HREF = arg('href', '/user/speedlab')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', e => console.error('[pageerror]', e.message))

await page.addInitScript(() => {
  window.__deepAll = (sel, root = document, acc = []) => {
    root.querySelectorAll?.(sel).forEach(e => acc.push(e))
    ;(root.querySelectorAll?.('*') || []).forEach(el => { if (el.shadowRoot) window.__deepAll(sel, el.shadowRoot, acc) })
    return acc
  }
  window.__calls = []
  window.__recording = false
  const orig = window.fetch
  window.fetch = function (...args) {
    if (window.__recording) {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url
      if (url && url.includes(':4201')) {
        window.__calls.push({
          t: Math.round(performance.now() - window.__t0),
          url: url.replace(/^https?:\/\/[^/]+/, ''),
          stack: new Error().stack.split('\n').slice(1, 7).map(s => s.trim().replace(/https?:\/\/localhost:4200/g, ''))
        })
      }
    }
    return orig.apply(this, args)
  }
})

await page.goto('http://localhost:4200/', { waitUntil: 'load' })
await page.waitForTimeout(4000)

const calls = await page.evaluate(async h => {
  window.__t0 = performance.now()
  window.__recording = true
  const target = window.__deepAll('soci-link')
    .map(l => l.shadowRoot?.querySelector('a') || l.querySelector('a'))
    .find(a => a?.getAttribute('href') === h)
  if (!target) throw new Error('no link ' + h)
  target.click()
  await new Promise(r => setTimeout(r, 2500))
  return window.__calls
}, HREF)

console.log(`API calls during navigation to ${HREF}:\n`)
for (const c of calls) {
  console.log(`+${c.t}ms  ${c.url}`)
  c.stack.forEach(s => console.log(`        ${s}`))
  console.log()
}
await browser.close()
