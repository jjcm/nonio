// Lab probe: dump soci-post / post-list internals so the transition harness can
// target real content nodes.
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', e => console.error('[pageerror]', e.message))

await page.goto('http://localhost:4200/sl-txt-01', { waitUntil: 'load' })
await page.waitForTimeout(4000)

console.log(JSON.stringify(await page.evaluate(() => {
  const post = document.querySelector('soci-post')
  const sr = post?.shadowRoot
  const list = document.querySelector('soci-post-list')
  const dump = el => el ? {
    tag: el.tagName.toLowerCase(), id: el.id, cls: el.className,
    opacity: getComputedStyle(el).opacity, text: (el.textContent || '').trim().slice(0, 60),
    rect: (r => ({ w: Math.round(r.width), h: Math.round(r.height) }))(el.getBoundingClientRect())
  } : null
  return {
    postAttrs: post ? [...post.attributes].map(a => a.name + '=' + a.value.slice(0, 40)) : null,
    postHostOpacity: post ? getComputedStyle(post).opacity : null,
    shadowChildren: sr ? [...sr.children].map(dump) : null,
    shadowIds: sr ? [...sr.querySelectorAll('[id]')].map(dump) : null,
    postListPresent: !!list,
    listShadowIds: list?.shadowRoot ? [...list.shadowRoot.querySelectorAll('[id]')].map(e => e.id) : null,
    commentTags: [...new Set([...document.querySelectorAll('*')].filter(e => e.tagName.includes('COMMENT')).map(e => e.tagName.toLowerCase()))]
  }
}, null), null, 2))

// Also dump where post rows live on the homepage feed.
await page.goto('http://localhost:4200/', { waitUntil: 'load' })
await page.waitForTimeout(4000)
console.log('--- HOME FEED ---')
console.log(JSON.stringify(await page.evaluate(() => {
  const list = document.querySelector('soci-post-list')
  const rowsLight = [...list.querySelectorAll('soci-post-li, soci-post-card')]
  const rowsShadow = list.shadowRoot ? [...list.shadowRoot.querySelectorAll('soci-post-li, soci-post-card')] : []
  const first = rowsLight[0] || rowsShadow[0]
  return {
    listAttrs: [...list.attributes].map(a => a.name + '=' + a.value),
    lightRows: rowsLight.length,
    shadowRows: rowsShadow.length,
    firstRowParentChain: (() => {
      const chain = []
      let n = first
      while (n && chain.length < 8) { chain.push(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '')); n = n.parentElement || n.parentNode?.host }
      return chain
    })(),
    firstRowOpacity: first ? getComputedStyle(first).opacity : null
  }
}), null, 2))

await browser.close()
