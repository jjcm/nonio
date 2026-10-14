import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The lazy loader's registry and packs are static data; these tests keep the
// split component graph honest: every element used anywhere must be defined
// either eagerly (core shell) or through the loader, packs must only name
// real registry entries, and the core must never statically import a module
// the registry lazy-loads.

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = f => fs.readFileSync(path.join(root, f), 'utf8')

const { REGISTRY, PACKS, MODAL_PACKS } = await import('../components/soci-loader.js')

const componentsSrc = read('components/soci-components.js')
const coreDefines = [...componentsSrc.matchAll(/customElements\.define\('([^']+)'/g)].map(m => m[1])
const known = new Set([...coreDefines, ...Object.keys(REGISTRY)])

function* walk(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(rel)
    else if (/\.(js|pug|html)$/.test(entry.name)) yield rel
  }
}

const scanFiles = ['index.pug', 'sidebar.pug', 'soci.js', ...walk('pages'), ...walk('components'), ...walk('lib')]

// pug comments (`//`) comment out their whole indented block
function stripPugComments(src) {
  const out = []
  let commentIndent = -1
  for (const line of src.split('\n')) {
    const indent = line.match(/^\s*/)[0].length
    const trimmed = line.trim()
    if (commentIndent >= 0 && (trimmed === '' || indent > commentIndent)) continue
    commentIndent = -1
    if (trimmed.startsWith('//')) { commentIndent = indent; continue }
    out.push(line)
  }
  return out.join('\n')
}

function usedTags(src) {
  const tags = new Set()
  // <soci-x ...> in html strings, createElement('soci-x'), and pug tag lines
  for (const m of src.matchAll(/<(soci-[a-z][a-z-]*)/g)) tags.add(m[1])
  for (const m of src.matchAll(/createElement\(['"`](soci-[a-z][a-z-]*)/g)) tags.add(m[1])
  for (const m of src.matchAll(/^\s*(soci-[a-z][a-z-]*)[(.#\s]/gm)) tags.add(m[1])
  return tags
}

test('every element referenced in templates and scripts is core-defined or registered', () => {
  const missing = new Map()
  for (const f of scanFiles) {
    const src = f.endsWith('.pug') ? stripPugComments(read(f)) : read(f)
    for (const tag of usedTags(src)) {
      if (tag === 'soci-route' || known.has(tag)) continue
      if (!missing.has(tag)) missing.set(tag, [])
      missing.get(tag).push(f)
    }
  }
  assert.deepEqual([...missing], [], `unregistered elements: ${JSON.stringify([...missing])}`)
})

test('every registry path resolves to a real module', () => {
  for (const [name, rel] of Object.entries(REGISTRY)) {
    const file = path.join(root, 'components', rel)
    assert.ok(fs.existsSync(file), `${name} -> ${rel} does not exist`)
  }
})

test('packs only name known elements', () => {
  for (const [route, names] of Object.entries(PACKS)) {
    for (const name of names) {
      assert.ok(REGISTRY[name] || coreDefines.includes(name), `pack ${route} names unknown element ${name}`)
    }
  }
  for (const [modal, names] of Object.entries(MODAL_PACKS)) {
    for (const name of names) {
      assert.ok(REGISTRY[name] || coreDefines.includes(name), `modal pack ${modal} names unknown element ${name}`)
    }
  }
})

test('every route in the shell has a pack entry', () => {
  const routeIds = [...read('index.pug').matchAll(/soci-route#([\w-]+)/g)].map(m => m[1])
  assert.ok(routeIds.length > 10, 'route extraction should find the shell routes')
  for (const id of routeIds) {
    assert.ok(id in PACKS, `route #${id} has no PACKS entry (add one, [] if it only uses core elements)`)
  }
})

test('the eager core never statically imports a lazily registered module', () => {
  const staticImports = [...componentsSrc.matchAll(/^import\s[^'"]*['"]([^'"]+)['"]/gm)].map(m => m[1])
  const lazyPaths = new Set(Object.values(REGISTRY).map(p => p.replace(/^\.\//, '')))
  for (const imp of staticImports) {
    assert.ok(!lazyPaths.has(imp.replace(/^\.\//, '')), `core statically imports lazy module ${imp}`)
  }
})

test('no element is both core-defined and lazily registered', () => {
  for (const name of coreDefines) {
    assert.ok(!(name in REGISTRY), `${name} is defined eagerly and present in the lazy registry`)
  }
})
