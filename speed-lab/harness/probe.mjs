// Lab probe: dump the shape of the loaded homepage so the transition harness
// can target real click affordances instead of guessed selectors.
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', m => console.error('[console]', m.type(), m.text()))
page.on('pageerror', e => console.error('[pageerror]', e.message))

await page.goto('http://localhost:4200/', { waitUntil: 'load' })
await page.waitForTimeout(4000)

const out = await page.evaluate(() => {
  const describe = (el, depth = 0) => {
    if (!el) return null
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      attrs: [...el.attributes].map(a => `${a.name}=${a.value}`.slice(0, 60)),
      shadow: !!el.shadowRoot
    }
  }
  const routes = [...document.querySelectorAll('nonio-route')].map(r => ({
    id: r.id, active: r.hasAttribute('active'), path: r.getAttribute('path'), def: r.hasAttribute('default')
  }))

  const list = document.querySelector('nonio-post-list')
  const rows = list?.shadowRoot ? [...list.shadowRoot.querySelectorAll('nonio-post-li, nonio-post-card')] : []
  const firstRow = rows[0]

  // Every nonio-link href on the page (pierce shadow roots one level deep from key hosts)
  const links = []
  const collect = root => {
    root.querySelectorAll?.('nonio-link').forEach(l => {
      const a = l.shadowRoot?.querySelector('a') || l.querySelector('a')
      links.push({ host: l.closest('[id]')?.id || l.parentElement?.tagName, href: a?.getAttribute('href') || l.getAttribute('href') })
    })
  }
  collect(document)
  const walk = (root, d) => {
    if (d > 4) return
    root.querySelectorAll?.('*').forEach(el => { if (el.shadowRoot) { collect(el.shadowRoot); walk(el.shadowRoot, d + 1) } })
  }
  walk(document, 0)

  const sidebar = document.querySelector('nonio-sidebar')
  const tagLis = sidebar?.shadowRoot ? [...sidebar.shadowRoot.querySelectorAll('nonio-tag-li')].map(t => t.getAttribute('tag')) : []

  return {
    routes,
    postListPresent: !!list,
    postListLoaded: list?.hasAttribute('loaded'),
    postListView: list?.getAttribute('view'),
    rowCount: rows.length,
    firstRow: describe(firstRow),
    firstRowShadowHTML: firstRow?.shadowRoot?.innerHTML.slice(0, 1500),
    tagLis,
    sidebarShadow: sidebar?.shadowRoot?.innerHTML.slice(0, 2000),
    uniqueHrefs: [...new Set(links.map(l => l.href))].slice(0, 40)
  }
})

console.log(JSON.stringify(out, null, 2))
await browser.close()
