import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
p.on('pageerror', e => errors.push(e.message))
await p.goto('http://localhost:4200/sl-txt-06', { waitUntil: 'load' })
await p.waitForTimeout(3000)
console.log('text post markdown:', await p.evaluate(() => {
  const deep = (root, sel, acc = []) => {
    acc.push(...root.querySelectorAll(sel))
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) deep(el.shadowRoot, sel, acc)
    return acc
  }
  const views = deep(document, 'soci-markdown-view')
  const rendered = views.find(v => v.innerHTML.includes('<strong>') || v.innerHTML.includes('<p>'))
  return { views: views.length, rendered: !!rendered, sample: rendered ? rendered.innerHTML.slice(0, 120) : '' }
}))
await p.screenshot({ path: '/tmp/text-post.png' })
console.log('errors:', errors.length ? errors : 'none')
await b.close()
