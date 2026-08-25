import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

// The CDNs ingest and serve webp only - a .heic source in a <picture> is a
// guaranteed 410 from image.non.io and avatar.non.io.
test('nothing links HEIC images', () => {
  const offenders = []
  for (const dir of ['components', 'pages', 'lib']) {
    for (const file of fs.readdirSync(path.join(root, dir), { recursive: true })) {
      if (!/\.(js|pug|html|css)$/.test(file)) continue
      const source = fs.readFileSync(path.join(root, dir, file), 'utf8')
      if (/heic|heif/i.test(source)) offenders.push(`${dir}/${file}`)
    }
  }
  assert.deepEqual(offenders, [])
})
