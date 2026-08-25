import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

const sources = fs.readdirSync(root, { recursive: true })
  .filter(f => /\.(js|pug|css|styl|html)$/.test(f) && !f.includes('node_modules'))

const read = f => fs.readFileSync(path.join(root, f), 'utf8')

const registry = read('components/nonio-components.js')
const registered = [...registry.matchAll(/customElements\.define\('([\w-]+)'/g)].map(m => m[1])

test('every relative import resolves, so the renamed modules are all reachable', () => {
  const missing = []
  for(const file of sources.filter(f => f.endsWith('.js'))){
    const dir = path.dirname(path.join(root, file))
    for(const [, spec] of read(file).matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g))
      if(!fs.existsSync(path.resolve(dir, spec))) missing.push(`${file} -> ${spec}`)
  }
  assert.deepEqual(missing, [])
})

test('every custom element is registered once, under the nonio- prefix', () => {
  assert.ok(registered.length > 50, `expected the full component set, got ${registered.length}`)
  assert.deepEqual(registered.filter(tag => !tag.startsWith('nonio-')), [])
  assert.deepEqual(registered.filter((tag, i) => registered.indexOf(tag) != i), [])
})

// The only soci- token left in the frontend: index.pug reads the pre-rename
// localStorage keys once to migrate them.
const KEPT = /soci-column-/g

// Word boundaries keep "associated" and "social" out of this.
const DEPRECATED = [/\bsoci-/, /\bsoci\b/, /\bsoci(?=[A-Z])/, /\bSoci[A-Z]/, /\bSOCI-/]

test('no soci-prefixed element, custom property, or identifier survives', () => {
  const offenders = []
  for(const file of sources.filter(f => !f.endsWith('components.test.js'))){
    const text = read(file).replace(KEPT, '')
    for(const pattern of DEPRECATED)
      if(pattern.test(text)) offenders.push(`${file}: ${pattern}`)
  }
  assert.deepEqual(offenders, [])
})
