// EXPERIMENTAL lab tool — record a Slow 4G cold+warm screencast of one variant.
//
// Frames come from CDP Page.screencastFrame, which stamps every frame with a
// wall-clock time. performance.timeOrigin gives the navigation start of each
// document on the same clock, so each frame's offset from navigation start is
// exact rather than inferred from the container timeline.
//
// Per variant: open a neutral interstitial, navigate (COLD), settle, return to
// the interstitial, navigate again with a primed cache (WARM).
//
// Usage: node record.mjs <label> <outDir> [url]

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [label, outDir, url = 'http://127.0.0.1:4200/'] = process.argv.slice(2);
if (!label || !outDir) throw new Error('usage: record.mjs <label> <outDir> [url]');

const VIEWPORT = { width: 1280, height: 800 };
const SLOW_4G = { offline: false, downloadThroughput: (1.6 * 1000 * 1000) / 8, uploadThroughput: (750 * 1000) / 8, latency: 150 };
const BLANK = 'data:text/html,<body style="margin:0;background:%23ffffff"></body>';
const SETTLE = 6000;

const framesDir = join(outDir, `${label}-frames`);
mkdirSync(framesDir, { recursive: true });

const browser = await chromium.launch({ args: ['--force-device-scale-factor=1', '--hide-scrollbars'] });
const context = await browser.newContext({ viewport: VIEWPORT });
await context.addInitScript(() => {
  window.__lcp = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; })
    .observe({ type: 'largest-contentful-paint', buffered: true });
});

const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', SLOW_4G);

const frames = [];
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const name = `f${String(frames.length).padStart(5, '0')}.jpg`;
  frames.push({ name, epochMs: metadata.timestamp * 1000 });
  writeFileSync(join(framesDir, name), Buffer.from(data, 'base64'));
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});

const collect = () => page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const paint = (n) => { const e = performance.getEntriesByName(n)[0]; return e ? Math.round(e.startTime) : null; };
  return {
    timeOrigin: performance.timeOrigin,
    firstPaint: paint('first-paint'),
    fcp: paint('first-contentful-paint'),
    lcp: Math.round(window.__lcp) || null,
    load: Math.round(nav.loadEventEnd || 0),
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
    requests: performance.getEntriesByType('resource').length,
    transferBytes: performance.getEntriesByType('resource').reduce((a, r) => a + (r.transferSize || 0), 0)
      + (nav.transferSize || 0),
    posts: document.querySelectorAll('soci-post-li, soci-post-card').length,
  };
});

await page.goto(BLANK);
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: 1280, maxHeight: 800, everyNthFrame: 1 });
await page.waitForTimeout(1500);

const runs = {};
for (const lane of ['cold', 'warm']) {
  await page.goto(url, { waitUntil: 'load', timeout: 180000 });
  await page.waitForTimeout(SETTLE);
  runs[lane] = await collect();
  await page.goto(BLANK);
  await page.waitForTimeout(1500);
}

await cdp.send('Page.stopScreencast');
await page.waitForTimeout(300);
await context.close();
await browser.close();

writeFileSync(join(outDir, `${label}.json`), JSON.stringify({
  label, url, viewport: VIEWPORT, throttle: SLOW_4G, settleMs: SETTLE, runs, frames,
}, null, 2));
console.log(label, JSON.stringify({
  frames: frames.length,
  cold: (({ fcp, lcp, load, posts }) => ({ fcp, lcp, load, posts }))(runs.cold),
  warm: (({ fcp, lcp, load, posts }) => ({ fcp, lcp, load, posts }))(runs.warm),
}));
