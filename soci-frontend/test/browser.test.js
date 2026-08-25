// Layout and hit-testing regressions, which only a real engine can catch:
// reserving the post media box across the thumbnail -> full media swap, and
// keeping the modal submit buttons clickable.
//
// Skipped when no Chrome is installed, so `npm test` still runs everywhere.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { deflateSync } from 'node:zlib'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PORT = 42200 + (process.pid % 100)
const VIEWPORT = { width: 1000, height: 900 }
const BOX = 800 // width of the harness container the media is mounted into

const CHROME = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  '/usr/local/bin/google-chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find(p => p && fs.existsSync(p))

let puppeteer
try {
  puppeteer = (await import('puppeteer-core')).default
} catch {
  puppeteer = null
}

// false, not null: node's runner skips on any `skip` other than undefined.
const reason = !CHROME ? 'no Chrome installed' : !puppeteer ? 'puppeteer-core not installed' : false

// -- a real bitmap of a given size, so the browser has an intrinsic ratio to
// -- disagree with us about ------------------------------------------------
const CRC = Int32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  let crc = ~0
  for (const byte of body) crc = CRC[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const tail = Buffer.alloc(4)
  tail.writeInt32BE(~crc)
  return Buffer.concat([len, body, tail])
}

// -- and a real video of a given size, for the ratio the box must end up on ---
const FFMPEG = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg'].find(p => fs.existsSync(p))
const clips = {}

function mp4(width, height) {
  const key = `${width}x${height}`
  if (!clips[key]) {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'soci-')), 'clip.mp4')
    spawnSync(FFMPEG, [
      '-v', 'error', '-f', 'lavfi', '-i', `color=c=gray:s=${key}:d=1:r=5`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file
    ])
    clips[key] = fs.readFileSync(file)
  }
  return clips[key]
}

function png(width, height) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // 8-bit greyscale, which needs one byte per pixel and no palette
  // One filter byte per row, then all-black pixels, which deflates to nothing.
  const raw = Buffer.alloc((width + 1) * height)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

describe('browser', { skip: reason }, () => {
  let server, browser, page

  // The full image is held back so the thumbnail is provably on screen alone for
  // a while; tests release it when they want the swap to happen. Releasing has
  // to latch rather than just drain what is queued, because the browser may not
  // have got round to asking for the full image yet.
  let held = []
  let holdFull = true
  let served = {}
  let requested = []
  const releaseFull = () => {
    holdFull = false
    const queued = held
    held = []
    queued.forEach(respond => respond())
  }

  before(async () => {
    if (!fs.existsSync(path.join(root, 'config.js')))
      fs.copyFileSync(path.join(root, 'config.js.example'), path.join(root, 'config.js'))

    server = spawn('node', ['index.js'], { cwd: root, env: { ...process.env, PORT } })
    await new Promise((resolve, reject) => {
      server.stdout.on('data', d => { if (d.toString().includes('listening')) resolve() })
      server.on('error', reject)
      setTimeout(() => reject(new Error('server did not start')), 10000)
    })

    browser = await puppeteer.launch({
      executablePath: CHROME,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    })
    page = await browser.newPage()
    await page.setViewport(VIEWPORT)
    await page.setCacheEnabled(false)
    await page.setRequestInterception(true)
    page.on('request', req => {
      const url = req.url()
      const image = url.match(/^http:\/\/localhost:4203\/(thumbnail\/)?fixture-\d+\.webp$/)
      const poster = url.match(/^http:\/\/localhost:4204\/thumbnail\/fixture-\d+\.webp$/)
      const clip = url.match(/^http:\/\/localhost:4204\/fixture-\d+(-\d+p)?\.mp4$/)
      const thumb = () => served.thumb
        ? req.respond({ contentType: 'image/png', body: png(...served.thumb) })
        : req.respond({ status: 404 })
      if (poster) return thumb()
      if (clip) {
        requested.push(clip[1] || 'source')
        const size = served[clip[1] ? 'rendition' : 'source']
        return size
          ? req.respond({ contentType: 'video/mp4', headers: { 'Accept-Ranges': 'none' }, body: mp4(...size) })
          : req.respond({ status: 404 })
      }
      if (image) {
        if (image[1]) return thumb()
        const respond = () => req.respond({ contentType: 'image/png', body: png(...served.full) })
        if (!holdFull) return respond()
        return new Promise(resolve => held.push(() => { respond(); resolve() }))
      }
      // The API is not running under test; failing fast beats a 30s timeout.
      if (url.startsWith('http://localhost:4201')) return req.abort()
      req.continue()
    })
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction("customElements.get('soci-image') && customElements.get('soci-video')")
  })

  after(async () => {
    await browser?.close()
    server?.kill()
  })

  // Mount one media element in a fixed-width container and report the box it
  // reserved before any of its media was fetched. Each mount gets its own url so
  // one fixture's bitmap cannot be served to the next out of the cache.
  let fixtures = 0
  async function mount(tag, attrs, thumb, full, { source, rendition, width = BOX } = {}) {
    held = [] // requests from a torn-down element are nobody's to release
    holdFull = true
    served = { thumb, full, source, rendition }
    requested = []
    const url = `fixture-${++fixtures}`
    const reserved = await page.evaluate((tag, attrs, url, width) => {
      document.querySelector('#harness')?.remove()
      const harness = document.createElement('div')
      harness.id = 'harness'
      harness.style.cssText = `width:${width}px;position:absolute;top:0;left:0`
      harness.innerHTML = `<${tag} ${attrs} url="${url}"></${tag}>`
      document.body.appendChild(harness)
      return window.__box(harness.firstElementChild)
    }, tag, attrs, url, width)
    return { reserved, url }
  }

  const box = el => page.evaluate(sel => window.__box(document.querySelector(sel)), el)

  before(async () => {
    // Rounded, because sub-pixel jitter is not a layout shift.
    await page.evaluate(() => {
      window.__box = el => {
        const frame = el.shadowRoot.querySelector('#frame')
        const r = frame.getBoundingClientRect()
        return { width: Math.round(r.width), height: Math.round(r.height) }
      }
      window.__hostBox = el => {
        const r = el.getBoundingClientRect()
        return { width: Math.round(r.width), height: Math.round(r.height) }
      }
      window.__childBoxes = el => [...el.shadowRoot.querySelectorAll('#frame > *')].map(c => {
        const r = c.getBoundingClientRect()
        return { width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left) }
      })
    })
  })

  describe('post media reserves its box up front', () => {
    test('stored dimensions reserve the box before any bitmap arrives', async () => {
      const { reserved } = await mount('soci-image', 'width="1920" height="1080"', [256, 144], [1920, 1080])
      // 16:9 inside an 800px container, and nothing has been fetched yet.
      assert.deepEqual(reserved, { width: 800, height: 450 })

      await page.waitForFunction("document.querySelector('soci-image').shadowRoot.querySelector('#thumb').complete")
      assert.deepEqual(await box('soci-image'), reserved, 'the thumbnail must not resize the box')

      releaseFull()
      await page.waitForFunction("document.querySelector('soci-image').shadowRoot.querySelector('#image').complete")
      assert.deepEqual(await box('soci-image'), reserved, 'the full image must not resize the box')
    })

    test('a portrait ratio is bounded by the height, not letterboxed into a wide box', async () => {
      const { reserved } = await mount('soci-image', 'width="1080" height="1920"', [144, 256], [1080, 1920])
      // 100vh - 100px is 800px tall here, so 9:16 gives a 450px wide box. A box
      // sized from the container width instead would be 800x1422.
      assert.deepEqual(reserved, { width: 450, height: 800 })

      releaseFull()
      await page.waitForFunction("document.querySelector('soci-image').shadowRoot.querySelector('#image').complete")
      assert.deepEqual(await box('soci-image'), reserved)
    })

    test('without stored dimensions the thumbnail locks the box, and the swap does not move it', async () => {
      // 4:3, so a hardcoded 16:9 fallback would reserve 800x450 instead.
      await mount('soci-image', '', [200, 150], [1000, 750])
      await page.waitForFunction("document.querySelector('soci-image').hasAttribute('ratio')")
      const locked = await box('soci-image')
      assert.deepEqual(locked, { width: 800, height: 600 }, 'the box should take the thumbnail ratio')

      releaseFull()
      await page.waitForFunction("document.querySelector('soci-image').shadowRoot.querySelector('#image').complete")
      assert.deepEqual(await box('soci-image'), locked, 'the full image must not resize the box')
    })

    test('no ratio is invented when neither dimensions nor a thumbnail exist', async () => {
      await mount('soci-image', '', null, [1000, 750])
      await page.waitForFunction("document.querySelector('soci-image').shadowRoot.querySelector('#thumb').complete")
      assert.equal(
        await page.evaluate(() => document.querySelector('soci-image').hasAttribute('ratio')),
        false,
        'a guessed ratio would reserve the wrong box'
      )

      // The full image is then the only thing left to measure.
      releaseFull()
      await page.waitForFunction("document.querySelector('soci-image').hasAttribute('ratio')")
      assert.deepEqual(await box('soci-image'), { width: 800, height: 600 })
    })

    test('the thumbnail and the full image fill exactly the same box', async () => {
      await mount('soci-image', 'width="1920" height="1080"', [256, 144], [1920, 1080])
      releaseFull()
      await page.waitForFunction("document.querySelector('soci-image').shadowRoot.querySelector('#image').complete")
      const [thumb, full] = await page.evaluate(() => window.__childBoxes(document.querySelector('soci-image')))
      assert.deepEqual(thumb, full, 'stacked sources must share one box')
      assert.equal(
        await page.evaluate(() => getComputedStyle(document.querySelector('soci-image').shadowRoot.querySelector('#image')).objectFit),
        'contain'
      )
    })

    test('video reserves its box and shows a poster while the video loads', async () => {
      const { reserved, url } = await mount('soci-video', 'width="1920" height="1080"', [256, 144], [1920, 1080])
      assert.deepEqual(reserved, { width: 800, height: 450 })
      assert.equal(
        await page.evaluate(() => document.querySelector('soci-video').shadowRoot.querySelector('video').poster),
        `http://localhost:4204/thumbnail/${url}.webp`,
        'the poster should come from the video CDN, not the image CDN'
      )
    })

    test('feed list tiles keep their fixed thumbnail box', async () => {
      const tile = await page.evaluate(() => {
        document.querySelector('#harness')?.remove()
        const harness = document.createElement('div')
        harness.id = 'harness'
        harness.innerHTML = '<soci-post-li post-title="t" url="fixture" type="image"></soci-post-li>'
        document.body.appendChild(harness)
        const img = harness.firstElementChild.shadowRoot.querySelector('#thumbnail img')
        const s = getComputedStyle(img)
        return { width: s.width, height: s.height, fit: s.objectFit, loading: img.loading }
      })
      assert.deepEqual(tile, { width: '96px', height: '72px', fit: 'cover', loading: 'lazy' })
    })
  })

  // The post detail player has to be the shape of the file that is playing, and
  // has to be playing the file the encoder actually produced. Getting either
  // wrong shows up as a picture that is letterboxed, squashed, or both.
  describe('the video player takes the shape of its file', { skip: reason || (FFMPEG ? false : 'no ffmpeg installed') }, () => {
    const settled = url => page.waitForFunction(
      u => document.querySelector('soci-video').shadowRoot.querySelector(`video[src$="${u}"]`)?.readyState > 0,
      {}, url
    )

    test('a portrait video is the box, not a letterboxed strip inside a wider slab', async () => {
      // 9:16 against a 800px tall bound is 450x800. The container is 800 wide,
      // so a box taken from the width alone would be 800x1422.
      const { reserved } = await mount('soci-video', 'width="720" height="1280"', null, null, { source: [720, 1280] })
      assert.deepEqual(reserved, { width: 450, height: 800 })
      assert.deepEqual(
        await page.evaluate(() => window.__hostBox(document.querySelector('soci-video'))),
        reserved,
        'the host must be the box; a full width host paints black either side of the picture'
      )
    })

    // Waits until the browser has the poster, so "no ratio yet" means the poster
    // was declined rather than merely late.
    const posterLoaded = () => page.waitForFunction(async () => {
      const poster = document.querySelector('soci-video').shadowRoot.querySelector('video').poster
      await new Promise(done => Object.assign(new Image(), { onload: done, onerror: done, src: poster }))
      return true
    })

    test('the poster crop is never used to reserve the box', async () => {
      // A video thumbnail is a crop of a frame rather than a scaled copy of one,
      // so its ratio is not the video's: avo-coffeeshop's is 615x545 for a
      // 720x1280 video. With no stored dimensions and no file to measure, the
      // box has to stay unreserved rather than take the crop's 4:3.
      await mount('soci-video', '', [200, 150], null)
      await posterLoaded()
      assert.equal(
        await page.evaluate(() => document.querySelector('soci-video').hasAttribute('ratio')),
        false
      )
    })

    test('without stored dimensions the file itself locks the box', async () => {
      const { url } = await mount('soci-video', '', [200, 150], null, { source: [720, 1280] })
      await settled(`${url}.mp4`)
      await page.waitForFunction("document.querySelector('soci-video').hasAttribute('ratio')")
      assert.deepEqual(await box('soci-video'), { width: 450, height: 800 })
    })

    test('stored dimensions reserve the box, then give way to the file', async () => {
      // Stale post metadata: 854x480 stored against a 720x1280 file. Small
      // enough that 480p is the source, so the ladder stays out of it.
      const { reserved, url } = await mount('soci-video', 'width="854" height="480"', null, null, { source: [720, 1280] })
      assert.deepEqual(reserved, { width: 800, height: 450 }, 'reserved from the stored ratio, before any request')
      await settled(`${url}.mp4`)
      await page.waitForFunction(() => Math.abs(document.querySelector('soci-video').mediaRatio - 720 / 1280) < 0.01)
      assert.deepEqual(await box('soci-video'), { width: 450, height: 800 })
    })

    test('the video fills the box without being stretched to it', async () => {
      const { url } = await mount('soci-video', 'width="720" height="1280"', null, null, { source: [720, 1280] })
      await settled(`${url}.mp4`)
      const [video] = await page.evaluate(() => window.__childBoxes(document.querySelector('soci-video')))
      assert.deepEqual({ width: video.width, height: video.height }, await box('soci-video'))
      assert.equal(
        await page.evaluate(() => getComputedStyle(document.querySelector('soci-video').shadowRoot.querySelector('video')).objectFit),
        'contain'
      )
    })

    test('a portrait video is not dropped to the shortest rung of the ladder', async () => {
      // The rungs are keyed on the larger source dimension, so they have to be
      // compared against the larger rendered one. This box is 450x800: wide
      // enough for the source at 800 tall, and picked against its 450px width
      // it would fetch a 480p rendition it does not need.
      await mount('soci-video', 'width="720" height="1280"', null, null, { source: [720, 1280] })
      await page.waitForFunction("document.querySelector('soci-video').resolution")
      assert.deepEqual(requested, ['source'])
    })

    test('a rendition that is not the shape of the source is dropped for the source', async () => {
      // avo-coffeeshop's -480p, which is 1518x854 for a 720x1280 video: the
      // frames in it are squashed, and no amount of object-fit can unsquash
      // them. A 200px container puts the ladder on that rung to begin with.
      const { url } = await mount('soci-video', 'width="720" height="1280"', null, null,
        { source: [720, 1280], rendition: [1518, 854], width: 200 })
      await page.waitForFunction("document.querySelector('soci-video').resolution == '720p'")
      await settled(`${url}.mp4`)
      assert.deepEqual(requested, ['-480p', 'source'], 'the bad rendition should be tried once, then abandoned')
      assert.deepEqual(await box('soci-video'), { width: 200, height: 356 }, 'the box keeps the source ratio')
      assert.equal(
        await page.evaluate(() => document.querySelector('soci-video').shadowRoot.querySelectorAll('soci-option[value="480p"]').length),
        0,
        'a rendition known to be broken should not be offered again'
      )
    })
  })

  describe('modal submit buttons', () => {
    const open = async name => {
      await page.evaluate(n => { window.sociModals.closeAll(); return window.sociModals.open(n) }, name)
      await page.waitForFunction("document.querySelector('soci-modal[active]')")
    }

    // The bug: soci-button floats itself, so inside .modal-form it left the
    // form's flow and .modal-footer painted over it, swallowing the click.
    const topmostAtCentre = sel => page.evaluate(s => {
      const btn = document.querySelector(s)
      const r = btn.getBoundingClientRect()
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return btn === top || btn.contains(top)
    }, sel)

    test('the login button receives clicks at its own centre', async () => {
      await open('login')
      assert.ok(await topmostAtCentre('#login-btn'), 'something is painted over the login button')
    })

    test('the login button sits inside its form, clear of the footer', async () => {
      await open('login')
      const { formBottom, btnBottom, footerTop } = await page.evaluate(() => {
        const modal = document.querySelector('soci-login-modal')
        return {
          formBottom: modal.querySelector('form').getBoundingClientRect().bottom,
          btnBottom: modal.querySelector('#login-btn').getBoundingClientRect().bottom,
          footerTop: modal.querySelector('.modal-footer').getBoundingClientRect().top
        }
      })
      assert.ok(btnBottom <= formBottom, 'the button escaped the form box')
      assert.ok(formBottom <= footerTop, 'the form overlaps the footer')
    })

    test('the create account button receives clicks at its own centre', async () => {
      await open('createAccount')
      assert.ok(await topmostAtCentre('#register-btn'))
    })

    test('a left-click submits the login form with the entered credentials', async () => {
      await open('login')
      const submitted = await page.evaluate(async () => {
        const modal = document.querySelector('soci-login-modal')
        let payload = null
        window.api.user.login = async data => { payload = data; return {} }
        modal.querySelector('input[type="email"]').value = 'someone@example.com'
        modal.querySelector('soci-password').value = 'correct horse'
        const r = modal.querySelector('#login-btn').getBoundingClientRect()
        document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
          .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
        await new Promise(res => setTimeout(res, 50))
        return payload
      })
      assert.deepEqual(submitted, { email: 'someone@example.com', password: 'correct horse' })
    })
  })

  describe('password entropy', () => {
    const validity = (modal, name, value, useAutofill) => page.evaluate((modal, name, value, useAutofill) => {
      const pw = document.querySelector(`${modal} soci-password[name="${name}"]`)
      // Autofill assigns the inner input directly: no keystroke, no setter.
      if (useAutofill) pw.field.value = value
      else pw.value = value
      pw.checkValidity()
      return {
        valid: pw.validity.valid,
        message: pw.validationMessage,
        inForm: new FormData(pw.closest('form')).get(name)
      }
    }, modal, name, value, useAutofill)

    test('login accepts a password that predates the entropy requirement', async () => {
      await page.evaluate(() => { window.sociModals.closeAll(); return window.sociModals.open('login') })
      await page.waitForFunction("document.querySelector('soci-login-modal soci-password')")
      const weak = await validity('soci-login-modal', 'password', 'hunter2')
      assert.equal(weak.valid, true, 'login must not gate on password strength')
      assert.equal(weak.message, '')
    })

    test('login hides the entropy meter, even while the field has focus', async () => {
      assert.equal(
        await page.evaluate(() => {
          const pw = document.querySelector('soci-login-modal soci-password')
          pw.field.focus()
          return getComputedStyle(pw.shadowRoot.querySelector('svg')).display
        }),
        'none'
      )
    })

    test('a password the browser autofilled still reaches the form', async () => {
      const filled = await validity('soci-login-modal', 'password', 'autofilled-secret', true)
      assert.equal(filled.inForm, 'autofilled-secret', 'autofill never fires a keystroke')
    })

    test('registration still requires 40 bits of entropy', async () => {
      await page.evaluate(() => { window.sociModals.closeAll(); return window.sociModals.open('createAccount') })
      await page.waitForFunction("document.querySelector('soci-create-account-modal soci-password')")
      const weak = await validity('soci-create-account-modal', 'password', 'hunter2')
      assert.equal(weak.valid, false)
      assert.match(weak.message, /Not strong enough/)

      const strong = await validity('soci-create-account-modal', 'password', 'Tr0ub4dor&3xample!')
      assert.equal(strong.valid, true)
      assert.equal(strong.inForm, 'Tr0ub4dor&3xample!')
    })

    test('registration still requires the confirmation to match', async () => {
      await validity('soci-create-account-modal', 'password', 'Tr0ub4dor&3xample!')
      const mismatch = await validity('soci-create-account-modal', 'confirmPassword', 'Tr0ub4dor&3xampl3!')
      assert.equal(mismatch.valid, false)
      assert.match(mismatch.message, /do not match/)
    })
  })
})
