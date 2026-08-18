// Lighthouse desktop column for the speed lab (companion to measure.mjs,
// which stays the primary log). Per run: fresh Chromium profile -> cold LH
// run (storage reset) -> warm LH run (disableStorageReset, reuses cache).
// Medians over n. Desktop preset = simulated 40ms RTT / 10Mbps / 1x CPU.
// Usage: node lighthouse.mjs [--url ...] [--n 5] [--label x] [--out file]

import { chromium } from 'playwright'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import fs from 'fs'

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name)
  return i > -1 ? process.argv[i + 1] : dflt
}

const URL = arg('url', 'http://localhost:4200/')
const N = parseInt(arg('n', '5'))
const LABEL = arg('label', 'run')
const OUT = arg('out', '')
const PORT = 9333

const median = a => {
  const s = [...a].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const metrics = lhr => ({
  fcp: lhr.audits['first-contentful-paint'].numericValue,
  lcp: lhr.audits['largest-contentful-paint'].numericValue
})

async function oneRun() {
  const browser = await chromium.launch({ args: ['--remote-debugging-port=' + PORT] })
  const flags = { port: PORT, output: 'json', logLevel: 'error' }
  const cold = metrics((await lighthouse(URL, flags, desktopConfig)).lhr)
  const warm = metrics((await lighthouse(URL, { ...flags, disableStorageReset: true }, desktopConfig)).lhr)
  await browser.close()
  return { cold, warm }
}

const runs = []
for (let i = 0; i < N; i++) {
  const r = await oneRun()
  runs.push(r)
  console.error(`run ${i + 1}/${N}: cold FCP ${r.cold.fcp.toFixed(0)} LCP ${r.cold.lcp.toFixed(0)} | warm FCP ${r.warm.fcp.toFixed(0)} LCP ${r.warm.lcp.toFixed(0)}`)
}

const result = {
  label: LABEL,
  url: URL,
  harness: 'lighthouse-desktop (simulated 40ms RTT / 10Mbps)',
  n: N,
  timestamp: new Date().toISOString(),
  medians: {
    coldFcp: median(runs.map(r => r.cold.fcp)),
    coldLcp: median(runs.map(r => r.cold.lcp)),
    warmFcp: median(runs.map(r => r.warm.fcp)),
    warmLcp: median(runs.map(r => r.warm.lcp))
  },
  runs
}

console.log(JSON.stringify(result, null, 2))
if (OUT) fs.writeFileSync(OUT, JSON.stringify(result, null, 2))
