import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
p.on('pageerror', e => errors.push('pageerror: ' + e.message))
p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

await p.goto('http://localhost:4200/', { waitUntil: 'load' })
await p.waitForTimeout(2500)
console.log('feed items:', await p.evaluate(() => document.querySelectorAll('soci-post-li, soci-post-card').length))

// deep-link straight to an image post (deferred soci-post/soci-image path)
await p.goto('http://localhost:4200/sl-img-03', { waitUntil: 'load' })
await p.waitForTimeout(3000)
console.log('post page:', await p.evaluate(() => {
  const post = document.querySelector('soci-post')
  const defined = !!customElements.get('soci-post')
  const img = post && post.shadowRoot ? post.shadowRoot.querySelector('img') : null
  return { defined, hasPost: !!post, imgLoaded: !!(img && img.complete && img.naturalWidth > 0), title: document.title }
}))
await p.screenshot({ path: '/tmp/post-detail.png' })

// video post
await p.goto('http://localhost:4200/sl-vid-01', { waitUntil: 'load' })
await p.waitForTimeout(3000)
console.log('video page:', await p.evaluate(() => {
  const post = document.querySelector('soci-post')
  const v = post && post.shadowRoot ? post.shadowRoot.querySelector('video') : document.querySelector('video')
  const vid = v || (document.querySelector('soci-video') && document.querySelector('soci-video').shadowRoot.querySelector('video'))
  return { videoDefined: !!customElements.get('soci-video'), hasVideoEl: !!vid, src: vid ? vid.currentSrc || vid.src : '', ready: vid ? vid.readyState : -1 }
}))
await p.screenshot({ path: '/tmp/post-video.png' })

// login modal via sidebar (client-side nav back to feed first)
await p.goto('http://localhost:4200/', { waitUntil: 'load' })
await p.waitForTimeout(2000)
await p.evaluate(() => { const sb = document.querySelector('soci-sidebar'); sb.shadowRoot.querySelector('#login')?.click() })
await p.waitForTimeout(1500)
console.log('login modal:', await p.evaluate(() => {
  const m = document.querySelector('soci-modal#login-modal, soci-modal[data-modal="login"]')
  return { present: !!m, defined: !!customElements.get('soci-modal'), visible: m ? getComputedStyle(m).display !== 'none' : false }
}))
await p.screenshot({ path: '/tmp/login-modal.png' })

console.log('errors:', errors.length ? errors : 'none')
await b.close()
