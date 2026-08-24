import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// api.js is written for the browser; give it the globals it expects
let token = null
const calls = []
globalThis.window = {}
globalThis.localStorage = { getItem: () => token }
globalThis.fetch = (url, options = {}) => {
  calls.push({ url, options })
  return Promise.resolve({ json: () => Promise.resolve({ ok: true }) })
}

const { default: api } = await import('../api.js')
const { default: config } = await import('../config.js')

beforeEach(() => { calls.length = 0; token = null })

test('requests carry no Authorization header when signed out', () => {
  const headers = api.headers()
  assert.equal(headers['Authorization'], undefined)
  assert.equal(headers['Content-Type'], 'application/json')
})

test('requests carry the bearer token when signed in', () => {
  token = 'token123'
  assert.equal(api.headers()['Authorization'], 'Bearer token123')
})

test('getData hits the API host and tolerates leading slashes', async () => {
  await api.getData('/posts?sort=top')
  await api.getData('posts?sort=top')
  assert.equal(calls[0].url, `${config.API_HOST}/posts?sort=top`)
  assert.equal(calls[1].url, calls[0].url)
})

test('postData sends JSON bodies to the API host', async () => {
  await api.user.login({ email: 'a@b.c', password: 'hunter2' })
  assert.equal(calls[0].url, `${config.API_HOST}/user/login`)
  assert.equal(calls[0].options.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: 'a@b.c', password: 'hunter2' })
})

test('websocket urls derive ws:// from the API host and escape params', () => {
  const url = api.voice.presenceWsUrl('c&d', 't k')
  assert.ok(url.startsWith(config.API_HOST.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://')))
  assert.match(url, /community=c%26d/)
  assert.match(url, /token=t%20k/)

  const channel = api.channelMessages.wsUrl('comm', 'general', 'tok')
  assert.match(channel, /^wss?:\/\//)
  assert.match(channel, /channel=general/)

  const notifications = api.notifications.wsUrl('t/k')
  assert.match(notifications, /^wss?:\/\/.+\/notifications\/ws\?token=t%2Fk$/)
})

test('channel message listing builds paging params only when given', async () => {
  await api.channelMessages.list('comm', 'general')
  assert.ok(!calls[0].url.includes('before='))
  await api.channelMessages.list('comm', 'general', 99, 50)
  assert.match(calls[1].url, /before=99/)
  assert.match(calls[1].url, /limit=50/)
})
