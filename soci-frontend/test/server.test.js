import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PORT = 42100 + (process.pid % 100)
let server

function get(pathname, headers = {}) {
  return fetch(`http://localhost:${PORT}${pathname}`, { headers })
}

// fetch transparently gunzips, so compression tests need the raw bytes
function rawGet(pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get({ port: PORT, path: pathname, headers }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }))
    }).on('error', reject)
  })
}

before(async () => {
  if (!fs.existsSync(path.join(root, 'config.js')))
    fs.copyFileSync(path.join(root, 'config.js.example'), path.join(root, 'config.js'))

  server = spawn('node', ['index.js'], { cwd: root, env: { ...process.env, PORT } })
  await new Promise((resolve, reject) => {
    server.stdout.on('data', d => { if (d.toString().includes('listening')) resolve() })
    server.on('error', reject)
    setTimeout(() => reject(new Error('server did not start')), 5000)
  })
})

after(() => server.kill())

test('the app shell is served with an ETag and revalidates to a 304', async () => {
  const first = await get('/')
  assert.equal(first.status, 200)
  assert.match(first.headers.get('content-type'), /text\/html/)
  assert.equal(first.headers.get('cache-control'), 'no-cache')
  const etag = first.headers.get('etag')
  assert.ok(etag, 'the shell should carry an ETag')

  const revalidated = await get('/', { 'If-None-Match': etag })
  assert.equal(revalidated.status, 304)
})

test('SPA deep links serve the same shell as /', async () => {
  const shell = await (await get('/')).text()
  const deep = await get('/some/deep/route')
  assert.equal(deep.status, 200)
  assert.equal(await deep.text(), shell)
})

test('the shell is gzipped for clients that accept it', async () => {
  const res = await rawGet('/', { 'Accept-Encoding': 'gzip' })
  assert.equal(res.headers['content-encoding'], 'gzip')
  assert.equal(res.headers['vary'], 'Accept-Encoding')
  assert.match(gunzipSync(res.body).toString(), /<html/i)
})

test('static assets get a short public cache and revalidate to 304s', async () => {
  const first = await get('/soci.js')
  assert.equal(first.status, 200)
  assert.equal(first.headers.get('cache-control'), 'public, max-age=300')
  const etag = first.headers.get('etag')
  assert.ok(etag, 'static files should carry an ETag')

  const revalidated = await get('/soci.js', { 'If-None-Match': etag })
  assert.equal(revalidated.status, 304)
})

test('large text assets are gzipped, and the payload round-trips', async () => {
  const [plain, zipped] = await Promise.all([
    rawGet('/soci.css'),
    rawGet('/soci.css', { 'Accept-Encoding': 'gzip' })
  ])
  assert.equal(zipped.headers['content-encoding'], 'gzip')
  assert.equal(gunzipSync(zipped.body).toString(), plain.body.toString())
  assert.ok(zipped.body.length < plain.body.length / 3, 'the css should compress to a fraction of its size')
})

test('unknown paths fall back to the SPA shell, even asset-like ones', async () => {
  const shell = await (await get('/')).text()
  const res = await get('/no-such-file.js')
  assert.equal(res.status, 200)
  assert.equal(await res.text(), shell)
})
