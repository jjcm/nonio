// Lab probe: screenshot each destination after a warm in-app navigation, to
// confirm the entrance-easing changes did not break the visual result.
import { chromium } from 'playwright'

const OUT = process.argv[2] || '/tmp/shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', e => console.error('[pageerror]', e.message))

await page.addInitScript(() => {
  window.__deepAll = (sel, root = document, acc = []) => {
    root.querySelectorAll?.(sel).forEach(e => acc.push(e))
    ;(root.querySelectorAll?.('*') || []).forEach(el => { if (el.shadowRoot) window.__deepAll(sel, el.shadowRoot, acc) })
    return acc
  }
  window.__go = href => {
    const a = window.__deepAll('nonio-link')
      .map(l => l.shadowRoot?.querySelector('a') || l.querySelector('a'))
      .find(x => x?.getAttribute('href') === href)
    if (!a) throw new Error('no link ' + href)
    a.click()
  }
})

await page.goto('http://localhost:4200/', { waitUntil: 'load' })
await page.waitForTimeout(3500)
await page.screenshot({ path: `${OUT}/01-homepage.png` })

for (const [name, href] of [['02-tag', '/#photography'], ['03-user', '/user/speedlab'], ['04-post', '/sl-txt-01']]) {
  await page.goto('http://localhost:4200/', { waitUntil: 'load' })
  await page.waitForTimeout(3000)
  await page.evaluate(h => window.__go(h), href)
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log(`${name}: ${page.url()}`)
}

await browser.close()
