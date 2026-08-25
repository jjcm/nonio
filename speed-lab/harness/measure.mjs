// Speed-lab harness: cold/warm load, FCP, LCP medians for the nonio main feed.
// Usage: node measure.mjs [--url http://localhost:4200/posts] [--n 7]
//        [--throttle slow4g] [--label baseline] [--out runs.json]
//
// Each run: fresh Chromium (empty cache) -> cold nav -> settle -> metrics,
// then reload in the same page (warm) -> settle -> metrics. Medians over n.

import { chromium } from 'playwright'
import fs from 'fs'

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name)
  return i > -1 ? process.argv[i + 1] : dflt
}

const URL = arg('url', 'http://localhost:4200/')
const N = parseInt(arg('n', '7'))
const THROTTLE = arg('throttle', 'none')
const LABEL = arg('label', 'run')
const OUT = arg('out', '')
const SETTLE_MS = 2500

const median = a => {
  const s = [...a].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const initScript = () => {
  window.__lcp = []
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) {
      window.__lcp.push({
        t: e.startTime,
        size: e.size,
        url: e.url || '',
        tag: e.element ? e.element.tagName + (e.element.id ? '#' + e.element.id : '') : ''
      })
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true })

  // Total Blocking Time: sum of (longtask - 50ms). Long tasks keep reporting
  // as the feed hydrates, so this is TBT over the whole settle window.
  window.__tbt = 0
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) window.__tbt += Math.max(0, e.duration - 50)
  }).observe({ type: 'longtask', buffered: true })

  // Feed paint: first post card revealed (entrance animation done starting)
  // with its thumbnail decoded. Cards animate in from opacity 0, which keeps
  // their images out of LCP candidacy, so LCP alone misses the feed content.
  window.__feedPaint = -1
  const tick = () => {
    const item = document.querySelector('soci-post-li, soci-post-card')
    if (item && item.shadowRoot && !item.hasAttribute('unloaded')) {
      const img = item.shadowRoot.querySelector('img')
      // no-poster rows (videos without an encoded poster frame) paint a
      // placeholder tile, so there is no thumbnail decode to wait for either.
      const isText = !img || item.classList.contains('no-image') || item.classList.contains('no-poster')
      if (isText || (img.complete && img.naturalWidth > 0)) {
        window.__feedPaint = performance.now()
        return
      }
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

const collect = () => {
  const nav = performance.getEntriesByType('navigation')[0]
  const paint = performance.getEntriesByType('paint')
  const fcp = paint.find(p => p.name === 'first-contentful-paint')
  const lcp = window.__lcp[window.__lcp.length - 1]
  // When the last subresource finishes. loadEventEnd only covers requests the
  // browser knew about before the load event, so if the feed starts rendering
  // earlier its thumbnails move from after load to before it and loadEventEnd
  // grows even though the page finishes no later. allDone is immune to that.
  const res = performance.getEntriesByType('resource')
  const allDone = res.length ? Math.max(...res.map(r => r.responseEnd)) : -1
  return {
    allDone,
    load: nav ? nav.loadEventEnd : -1,
    dcl: nav ? nav.domContentLoadedEventEnd : -1,
    fcp: fcp ? fcp.startTime : -1,
    lcp: lcp ? lcp.t : -1,
    lcpTag: lcp ? lcp.tag : '',
    lcpUrl: lcp ? lcp.url : '',
    feedPaint: window.__feedPaint,
    tbt: window.__tbt,
    transfer: nav ? nav.transferSize : -1,
    reqs: res.length,
    bytes: res.reduce((a, r) => a + (r.transferSize || 0), 0)
  }
}

async function throttlePage(page) {
  if (THROTTLE !== 'slow4g') return
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8
  })
}

// QUIC bypasses CDP network throttling (Alt-Svc upgrades mid-page make
// throttled lanes meaningless), so pin measurements to h1/h2 unless a lane
// explicitly wants h3 (H3=1, only sane unthrottled). Chrome also scales its
// lazy-image prefetch margin with its own effective-connection estimate,
// which drifts under CDP throttle and bimodally flips how many below-fold
// images load; pin every margin to the 4G default so runs are comparable.
const LAZY_PIN = '--blink-settings=' + ['Unknown', 'Offline', 'Slow2G', '2G', '3G', '4G']
  .map(t => `lazyImageLoadingDistanceThresholdPx${t}=1250`).join(',')
const LAUNCH = { args: process.env.H3 === '1' ? [LAZY_PIN] : ['--disable-quic', LAZY_PIN] }

async function oneRun() {
  const browser = await chromium.launch(LAUNCH)
  const page = await browser.newPage()
  await page.addInitScript(initScript)
  await throttlePage(page)

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(SETTLE_MS)
  const cold = await page.evaluate(collect)

  await page.reload({ waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(SETTLE_MS)
  const warm = await page.evaluate(collect)

  await browser.close()
  return { cold, warm }
}

// Warm up the dev server (template compile caches etc.) outside measured runs.
await fetch(URL).then(r => r.text()).catch(() => {})

const runs = []
for (let i = 0; i < N; i++) {
  const r = await oneRun()
  runs.push(r)
  console.error(
    `run ${i + 1}/${N}: cold load ${r.cold.load.toFixed(0)}ms fcp ${r.cold.fcp.toFixed(0)}ms ` +
    `lcp ${r.cold.lcp.toFixed(0)}ms feed ${r.cold.feedPaint.toFixed(0)}ms | warm load ${r.warm.load.toFixed(0)}ms ` +
    `fcp ${r.warm.fcp.toFixed(0)}ms lcp ${r.warm.lcp.toFixed(0)}ms feed ${r.warm.feedPaint.toFixed(0)}ms`
  )
}

const result = {
  label: LABEL,
  url: URL,
  throttle: THROTTLE,
  n: N,
  timestamp: new Date().toISOString(),
  medians: {
    coldLoad: median(runs.map(r => r.cold.load)),
    warmLoad: median(runs.map(r => r.warm.load)),
    coldFcp: median(runs.map(r => r.cold.fcp)),
    coldLcp: median(runs.map(r => r.cold.lcp)),
    warmFcp: median(runs.map(r => r.warm.fcp)),
    warmLcp: median(runs.map(r => r.warm.lcp)),
    coldFeedPaint: median(runs.map(r => r.cold.feedPaint)),
    warmFeedPaint: median(runs.map(r => r.warm.feedPaint)),
    coldAllDone: median(runs.map(r => r.cold.allDone)),
    warmAllDone: median(runs.map(r => r.warm.allDone)),
    coldTbt: median(runs.map(r => r.cold.tbt)),
    warmTbt: median(runs.map(r => r.warm.tbt)),
    coldReqs: median(runs.map(r => r.cold.reqs)),
    coldBytes: median(runs.map(r => r.cold.bytes))
  },
  lcpElement: runs[0].cold.lcpTag,
  lcpUrl: runs[0].cold.lcpUrl,
  runs
}

console.log(JSON.stringify(result, null, 2))
if (OUT) fs.writeFileSync(OUT, JSON.stringify(result, null, 2))
