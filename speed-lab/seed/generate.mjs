#!/usr/bin/env node
// speed-lab/seed/generate.mjs
// LAB ONLY. Deterministic large seed for VPS performance measurement.
// Produces seed-big.sql + media-manifest.tsv (slug <TAB> kind <TAB> srcIdx <TAB> aspect).
//
//   node generate.mjs [--out DIR]
//
// Shape (all deterministic from a fixed PRNG seed):
//   300 users  (all password "password", bcrypt)
//   40 tags    (frontpage community 0)
//   2600 posts (~45% image, 34% text, 13% link, 8% video) over 90 days
//   ~28k comments (zipf per post, 2-level threads)
//   ~21k posts_tags_votes (zipf voters, <=300 distinct per post)
//
// Stable measurement anchors (used by harness/transitions.mjs):
//   user "speedlab" (id 9001) with many posts
//   tag  "photography" among top tags
//   post "speed-lab-measured-post" (text, 24 comments)

import fs from 'fs'
import path from 'path'

const OUT = (() => { const i = process.argv.indexOf('--out'); return i > -1 ? process.argv[i + 1] : path.dirname(new URL(import.meta.url).pathname) })()

// ---------- deterministic PRNG ----------
let s = 0xC0FFEE ^ 0x5EED
const rnd = () => {
  s |= 0; s = (s + 0x6D2B79F5) | 0
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1))
const pick = arr => arr[Math.floor(rnd() * arr.length)]
const shuffled = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

// bcrypt("password"), cost 10 - standard test vector so any seeded user can log in.
const HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'

const esc = str => "'" + String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'"
const NOW = new Date('2026-08-23T12:00:00Z').getTime()
const DAY = 86400000
const ts = ms => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')

// ---------- word banks ----------
const ADJ = ['crimson', 'amber', 'quiet', 'hollow', 'electric', 'velvet', 'broken', 'wandering', 'silver', 'restless', 'pale', 'burning', 'frozen', 'wild', 'gentle', 'lost', 'golden', 'midnight', 'coastal', 'northern', 'analog', 'sunlit', 'rainy', 'forgotten', 'endless', 'minimal', 'brutalist', 'handmade', 'overgrown', 'neon']
const NOUN = ['harbor', 'signal', 'garden', 'archive', 'meadow', 'circuit', 'lantern', 'valley', 'workshop', 'horizon', 'thicket', 'terminal', 'orchard', 'skyline', 'darkroom', 'coastline', 'notebook', 'compiler', 'synth', 'ridge', 'estuary', 'monolith', 'atlas', 'furnace', 'prairie', 'reactor', 'library', 'greenhouse', 'lighthouse', 'junction']
const VERB = ['returns', 'collapses', 'blooms', 'echoes', 'drifts', 'ignites', 'unfolds', 'settles', 'fractures', 'awakens', 'dissolves', 'lingers', 'surfaces', 'wanders', 'resonates']
const TOPIC = ['photography', 'art', 'code', 'music', 'nature', 'design', 'travel', 'film', 'games', 'science', 'food', 'diy', 'space', 'history', 'books', 'urbanism', 'gardening', 'cycling', 'hiking', 'audio', 'hardware', 'linux', 'webdev', 'ai', 'privacy', 'climate', 'architecture', 'typography', 'animation', 'woodworking', 'ceramics', 'astronomy', 'birds', 'ocean', 'mountains', 'synthwave', 'jazz', 'coffee', 'tea', 'maps']
const FIRST = ['finch', 'juno', 'mira', 'orson', 'petra', 'quill', 'rowan', 'sable', 'theo', 'una', 'vesper', 'wren', 'yara', 'zeno', 'ada', 'bram', 'cleo', 'dario', 'esme', 'flint', 'greta', 'hollis', 'iris', 'jasper', 'kira', 'lark', 'milo', 'nova', 'otis', 'pia']
const LAST = ['fields', 'harbor', 'vale', 'moss', 'stone', 'reed', 'frost', 'gale', 'birch', 'slate', 'marsh', 'fern', 'holt', 'crane', 'ash', 'dune', 'wolfe', 'pike', 'rhodes', 'sparrow']
const SENT = [
  'This took longer than I expected but the light finally cooperated.',
  'Shot on a twenty year old lens and honestly it shows in the best way.',
  'I keep coming back to this spot every autumn and it never disappoints.',
  'The trick is patience, and also getting up before sunrise.',
  'Some notes on how I built this, in case anyone wants to replicate it.',
  'There is a longer writeup coming but I wanted to share the result first.',
  'Feedback very welcome, especially on the composition.',
  'The colors are straight out of camera, no grading at all.',
  'I have been iterating on this for a few weeks now.',
  'Half the work was just cleaning up the data before anything interesting happened.',
  'You can see the seams if you look closely, but I am calling it done.',
  'Built entirely with parts I had lying around the workshop.',
  'The second attempt went much better once I stopped overthinking it.',
  'A small detail most people miss: the texture in the lower corner.',
  'This is part three of an ongoing series, links to the rest in my profile.',
  'It rained the whole week so this was shot between two downpours.',
  'The hardest part was resisting the urge to add more.',
  'Turns out the simple approach was the right one all along.',
  'I documented every step this time, ask me anything.',
  'Printed this at A2 and it holds up surprisingly well.'
]
const COMMENT_SENT = [
  'This is fantastic, the tones especially.',
  'How long did this take end to end?',
  'I tried something similar last year and gave up, respect.',
  'The framing on this is really strong.',
  'Would love to see the process behind this.',
  'Saving this for reference, thank you for sharing.',
  'What gear are you using?',
  'The detail in the shadows is impressive.',
  'This reminds me of early Flickr in the best way.',
  'Genuinely one of the better things I have seen here this week.',
  'Do you have prints available?',
  'The second image in the series is even better imo.',
  'I appreciate the writeup as much as the result.',
  'More of this please.',
  'The color palette is doing a lot of work here and it works.',
  'I disagree with the approach but the execution is clean.',
  'Came for the thumbnail, stayed for the explanation.',
  'This should be higher up.',
  'Subtle but effective.',
  'Bookmarked. This is exactly the reference I needed.'
]

const para = n => Array.from({ length: n }, () => {
  const c = ri(3, 7)
  return Array.from({ length: c }, () => pick(SENT)).join(' ')
}).join('\n\n')

// ---------- users ----------
const users = []
users.push({ id: 9001, username: 'speedlab', name: 'Speed Lab', email: 'speedlab@local.test' })
const seen = new Set(['speedlab'])
for (let i = 0; i < 299; i++) {
  let u
  do { u = pick(FIRST) + '_' + pick(LAST) + (rnd() < 0.4 ? String(ri(1, 99)) : '') } while (seen.has(u))
  seen.add(u)
  users.push({ id: 100 + i, username: u, name: u.replace(/_/g, ' '), email: u + '@local.test' })
}
users.forEach(u => { u.created = NOW - ri(30, 400) * DAY })

// ---------- tags ----------
const tags = TOPIC.map((name, i) => ({ id: 5001 + i, name, user: pick(users).id, count: 0 }))
const tagByName = Object.fromEntries(tags.map(t => [t.name, t]))

// ---------- posts ----------
const N_POSTS = 2600
const posts = []
const slugSeen = new Set()
const mkSlug = title => {
  let base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
  let slug = base, n = 2
  while (slugSeen.has(slug)) slug = base + '-' + n++
  slugSeen.add(slug)
  return slug
}
// zipf-ish score by popularity rank (assigned randomly to posts)
const ranks = shuffled(Array.from({ length: N_POSTS }, (_, i) => i + 1))

for (let i = 0; i < N_POSTS; i++) {
  const r = rnd()
  const type = r < 0.45 ? 'image' : r < 0.79 ? 'text' : r < 0.92 ? 'link' : 'video'
  const title = `${pick(ADJ)} ${pick(NOUN)} ${pick(VERB)}` + (rnd() < 0.3 ? ` ${pick(['at dawn', 'in the rain', 'after dark', 'part two', 'revisited', 'from above', 'up close', 'in winter'])}` : '')
  const t = rnd()
  // 40% last week, 30% 8-30d, 30% 31-90d
  const ageDays = t < 0.4 ? rnd() * 7 : t < 0.7 ? 7 + rnd() * 23 : 30 + rnd() * 60
  const created = NOW - ageDays * DAY - ri(0, 3600000)
  const score = Math.max(0, Math.round(260 * Math.pow(ranks[i], -0.72) + (rnd() < 0.6 ? ri(0, 4) : 0)))
  // speedlab authors ~2% of posts so /user/speedlab is a real page
  const author = rnd() < 0.02 ? users[0] : pick(users)
  const aspect = pick(['16x9', '16x9', '16x9', '4x3', '9x16'])
  const [w, h] = type === 'text' ? [0, 0] : aspect === '16x9' ? [1280, 720] : aspect === '4x3' ? [1200, 900] : [810, 1440]
  posts.push({
    id: 20000 + i,
    title: title[0].toUpperCase() + title.slice(1),
    url: mkSlug(title),
    author: author.id,
    type, score, created,
    w, h, aspect,
    content: type === 'text' ? para(ri(1, 5)) : '',
    link: type === 'link' ? `https://example-${pick(NOUN)}.org/articles/${ri(100, 999)}` : '',
    domain: type === 'link' ? `example-${pick(NOUN)}.org` : '',
    thumbnail: type === 'text' ? '' : 'x', // set to slug below
    tags: [], comments: []
  })
}
// measured anchor post: text, stable slug, exactly 24 comments (added later)
posts[0].type = 'text'
posts[0].url = 'speed-lab-measured-post'
posts[0].title = 'Speed lab measured post: stable anchor for transition timing'
posts[0].content = para(4)
posts[0].author = 9001
posts[0].score = 240
posts[0].created = NOW - 2 * DAY
posts[0].w = 0; posts[0].h = 0; posts[0].link = ''; posts[0].domain = ''
posts.forEach(p => { if (p.type !== 'text') p.thumbnail = p.url })

// ---------- tags per post ----------
for (const p of posts) {
  const n = ri(1, 4)
  const chosen = new Set()
  // bias: photography for images, code/webdev for text - keeps tag feeds coherent
  if (p.type === 'image' && rnd() < 0.5) chosen.add('photography')
  if (p.type === 'video' && rnd() < 0.4) chosen.add('film')
  while (chosen.size < n) chosen.add(pick(TOPIC))
  p.tags = [...chosen].map(name => tagByName[name])
  p.tags.forEach(t => t.count++)
}

// ---------- votes (posts_tags_votes) ----------
// p.score distinct voters; each voter votes 1..min(2,tags) tags of the post.
const voteRows = []
const tagScore = new Map() // `${post}|${tag}` -> n
for (const p of posts) {
  const nv = Math.min(p.score, users.length - 1)
  const voters = shuffled(users).slice(0, nv)
  for (const v of voters) {
    const nt = Math.min(p.tags.length, rnd() < 0.75 ? 1 : 2)
    for (const t of shuffled(p.tags).slice(0, nt)) {
      voteRows.push([p.id, t.id, v.id, ts(p.created + ri(60000, 5 * DAY))])
      const k = p.id + '|' + t.id
      tagScore.set(k, (tagScore.get(k) || 0) + 1)
    }
  }
}

// ---------- comments ----------
// zipf-ish by post score; measured post gets exactly 24.
let cid = 50000
const commentRows = [] // [id, author, post, created, content, parent, lineage, desc, up, down]
const mkComment = (p, parent, created) => {
  const up = ri(0, 12), down = rnd() < 0.15 ? ri(1, 3) : 0
  const content = Array.from({ length: ri(1, 3) }, () => pick(COMMENT_SENT)).join(' ')
  const row = { id: cid++, author: pick(users).id, post: p.id, created, content, parent: parent ? parent.id : 0, up, down, replies: 0 }
  commentRows.push(row)
  return row
}
for (const p of posts) {
  let n = p.url === 'speed-lab-measured-post' ? 24
    : Math.min(140, Math.round(p.score * (0.8 + rnd() * 1.2) + (rnd() < 0.45 ? ri(1, 5) : 0)))
  if (n <= 0) { p.commentCount = 0; continue }
  const tops = []
  let made = 0
  while (made < n) {
    const base = p.created + ri(600000, 20 * DAY)
    if (tops.length && rnd() < 0.35) {
      const parent = pick(tops)
      mkComment(p, parent, base)
      parent.replies++
    } else {
      tops.push(mkComment(p, null, base))
    }
    made++
  }
  p.commentCount = n
}

// ---------- SQL ----------
const B = []
B.push('-- speed-lab/seed/seed-big.sql (generated by generate.mjs - do not edit)')
B.push('-- LAB ONLY. Wipes and reseeds content tables. Never run in production.')
B.push('SET NAMES utf8mb4;')
B.push('SET unique_checks=0;')
B.push('SET foreign_key_checks=0;')
B.push('BEGIN;')
B.push('DELETE FROM posts_tags_votes; DELETE FROM posts_tags; DELETE FROM comment_votes; DELETE FROM comments; DELETE FROM notifications; DELETE FROM subscriptions; DELETE FROM posts; DELETE FROM tags; DELETE FROM users;')
B.push('INSERT IGNORE INTO communities (id, name, url, description, created_at, updated_at) VALUES (1, \'nonio\', \'nonio\', \'nonio\', \'2026-05-01 00:00:00\', \'2026-05-01 00:00:00\');')

const batch = (table, cols, rows, size = 400) => {
  for (let i = 0; i < rows.length; i += size) {
    B.push(`INSERT INTO ${table} (${cols}) VALUES\n` + rows.slice(i, i + size).join(',\n') + ';')
  }
}

batch('users', 'id, email, username, name, password, description, created_at, updated_at, last_login',
  users.map(u => `(${u.id}, ${esc(u.email)}, ${esc(u.username)}, ${esc(u.name)}, ${esc(HASH)}, ${esc('Seeded lab user.')}, ${esc(ts(u.created))}, ${esc(ts(u.created))}, ${esc(ts(NOW - ri(0, 20) * DAY))})`))

batch('tags', 'id, name, user_id, created_at, count, community_id',
  tags.map(t => `(${t.id}, ${esc(t.name)}, ${t.user}, '2026-05-01 00:00:00', ${t.count}, 0)`))

batch('posts', 'id, title, url, user_id, thumbnail, type, score, content, created_at, updated_at, width, height, link, domain, is_encoding, community_id, comment_count',
  posts.map(p => `(${p.id}, ${esc(p.title)}, ${esc(p.url)}, ${p.author}, ${esc(p.thumbnail)}, ${esc(p.type)}, ${p.score}, ${esc(p.content)}, ${esc(ts(p.created))}, ${esc(ts(p.created))}, ${p.w}, ${p.h}, ${esc(p.link)}, ${esc(p.domain)}, 0, 0, ${p.commentCount})`))

const ptRows = []
for (const p of posts) for (const t of p.tags) {
  ptRows.push(`(${p.id}, ${t.id}, ${tagScore.get(p.id + '|' + t.id) || 0}, ${esc(ts(p.created))})`)
}
batch('posts_tags', 'post_id, tag_id, score, created_at', ptRows)

batch('posts_tags_votes', 'post_id, tag_id, voter_id, created_at, tallied',
  voteRows.map(v => `(${v[0]}, ${v[1]}, ${v[2]}, ${esc(v[3])}, 1)`))

batch('comments', 'id, author_id, post_id, created_at, content, parent_id, lineage_score, descendent_comment_count, upvotes, downvotes, edited',
  commentRows.map(c => `(${c.id}, ${c.author}, ${c.post}, ${esc(ts(c.created))}, ${esc(c.content)}, ${c.parent}, ${c.up + c.replies}, ${c.replies}, ${c.up}, ${c.down}, 0)`))

B.push('COMMIT;')
B.push('SET unique_checks=1;')
B.push('SET foreign_key_checks=1;')

fs.writeFileSync(path.join(OUT, 'seed-big.sql'), B.join('\n'))

// media manifest: slug, kind (image|video|avatar), srcIdx, aspect
const media = posts.filter(p => p.thumbnail)
  .map(p => [p.url, p.type === 'video' ? 'video' : 'image', ri(0, 23), p.aspect].join('\t'))
for (const u of users) media.push([u.username, 'avatar', ri(0, 23), 'sq'].join('\t'))
fs.writeFileSync(path.join(OUT, 'media-manifest.tsv'), media.join('\n') + '\n')

console.log(`users=${users.length} tags=${tags.length} posts=${posts.length} posts_tags=${ptRows.length} votes=${voteRows.length} comments=${commentRows.length}`)
console.log(`media entries=${media.length}`)
console.log(`sql bytes=${fs.statSync(path.join(OUT, 'seed-big.sql')).size}`)
