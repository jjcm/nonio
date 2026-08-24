// End-to-end probe for websocket notifications: registers two users, signs
// user A into the browser, has user B reply to A's post over the API, and
// asserts the badge updates from the websocket push alone (no unread-count
// polling while the socket is open), including the mark-read count drop.
// Usage: node probe-notifications-ws.mjs [frontend-base] [api-base]

import { chromium } from 'playwright'

const BASE = process.argv[2] || 'http://localhost:4200'
const API = process.argv[3] || 'http://localhost:4201'

let failures = 0
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

const api = async (path, body, token) => {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  })
  return res.json()
}

const stamp = Date.now().toString(36)
const a = await api('/user/register', { email: `wsa-${stamp}@example.com`, username: `wsa${stamp}`, password: 'password' })
const b = await api('/user/register', { email: `wsb-${stamp}@example.com`, username: `wsb${stamp}`, password: 'password' })
check(!!a.accessToken && !!b.accessToken, 'registered two users over the API')

const post = await api('/post/create', { title: 'ws probe post', url: `ws-probe-${stamp}`, content: 'body', type: 'blog' }, a.accessToken)
check(!!post.url, 'user A created a post')

const browser = await chromium.launch()
const page = await browser.newPage()

const wsFrames = []
let wsSocket = null
page.on('websocket', ws => {
  if (!ws.url().includes('/notifications/ws')) return
  wsSocket = ws
  ws.on('framereceived', f => { try { wsFrames.push(JSON.parse(f.payload)) } catch {} })
})
const pollRequests = []
page.on('request', r => { if (r.url().includes('/notifications/unread-count')) pollRequests.push(Date.now()) })

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate(({ accessToken, refreshToken, username }) => {
  localStorage.setItem('accessToken', accessToken)
  localStorage.setItem('refreshToken', refreshToken)
  localStorage.setItem('username', username)
}, { ...a, username: `wsa${stamp}` })
await page.reload({ waitUntil: 'domcontentloaded' })

const badge = page.locator('soci-notification-badge').first()
await page.waitForFunction(() => document.querySelector('soci-notification-badge') && window.soci?.notificationCount !== undefined, null, { timeout: 15000 })
check(wsSocket !== null, 'badge opened the notifications websocket')
check(wsFrames.some(f => f.type === 'notification.count' && f.count === 0), 'connect snapshot pushed count 0')
check(await badge.getAttribute('count') === null, 'badge shows no count while read')

const pollsBefore = pollRequests.length
await api('/comment/create', { post: post.url, content: 'hello from B' }, b.accessToken)
await page.waitForFunction(() => document.querySelector('soci-notification-badge')?.getAttribute('count') === '1', null, { timeout: 10000 })
check(true, 'badge showed 1 after B replied (pushed, not polled)')
check(wsFrames.some(f => f.type === 'notification.count' && f.count === 1), 'websocket carried the count=1 push')

// Mark it read over the API; the push keeps this tab in sync
const notifications = await (await fetch(API + '/notifications', { headers: { Authorization: `Bearer ${a.accessToken}` } })).json()
await api('/notification/mark-read', { id: notifications.notifications[0].id }, a.accessToken)
await page.waitForFunction(() => !document.querySelector('soci-notification-badge')?.hasAttribute('count'), null, { timeout: 10000 })
check(true, 'badge dropped to 0 after mark-read in another client')
check(pollRequests.length === pollsBefore, `no unread-count polling while the socket was open (${pollRequests.length} polls total)`)

await browser.close()
console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed')
process.exit(failures ? 1 : 0)
