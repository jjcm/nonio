import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
await p.goto('http://localhost:4200/sl-vid-01', { waitUntil: 'load' })
await p.waitForTimeout(3000)
console.log('video:', await p.evaluate(() => {
  const deep = (root, sel) => {
    const found = root.querySelector(sel)
    if (found) return found
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) { const f = deep(el.shadowRoot, sel); if (f) return f }
    return null
  }
  const v = deep(document, 'video')
  return { found: !!v, src: v ? v.src : '', readyState: v ? v.readyState : -1 }
}))
await p.goto('http://localhost:4200/', { waitUntil: 'load' })
await p.waitForTimeout(2000)
// footer login button
await p.locator('soci-button.login, [class*=login]').first().click({ timeout: 5000 }).catch(async () => {
  await p.getByText('login', { exact: true }).first().click({ timeout: 5000 })
})
await p.waitForTimeout(1500)
console.log('modal:', await p.evaluate(() => {
  const m = document.querySelector('soci-modal')
  return { present: !!m, open: m ? m.hasAttribute('open') || getComputedStyle(m).display !== 'none' : false }
}))
await p.screenshot({ path: '/tmp/login-modal2.png' })
await b.close()
