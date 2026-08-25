// Layout and hit-testing regressions, which only a real engine can catch:
// reserving the post media box across the thumbnail -> full media swap, and
// keeping the modal submit buttons clickable.
//
// Skipped when no Chrome is installed, so `npm test` still runs everywhere.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { deflateSync } from 'node:zlib'
import fs from 'node:fs'
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
      const thumb = () => served.thumb
        ? req.respond({ contentType: 'image/png', body: png(...served.thumb) })
        : req.respond({ status: 404 })
      if (poster) return thumb()
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
  async function mount(tag, attrs, thumb, full) {
    held = [] // requests from a torn-down element are nobody's to release
    holdFull = true
    served = { thumb, full }
    const url = `fixture-${++fixtures}`
    const reserved = await page.evaluate((tag, attrs, url, width) => {
      document.querySelector('#harness')?.remove()
      const harness = document.createElement('div')
      harness.id = 'harness'
      harness.style.cssText = `width:${width}px;position:absolute;top:0;left:0`
      harness.innerHTML = `<${tag} ${attrs} url="${url}"></${tag}>`
      document.body.appendChild(harness)
      return window.__box(harness.firstElementChild)
    }, tag, attrs, url, BOX)
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

    test('without stored dimensions the video poster locks the box', async () => {
      // 4:3 poster, so a 16:9 fallback would give 800x450 rather than 800x600.
      await mount('soci-video', '', [200, 150], [1000, 750])
      await page.waitForFunction("document.querySelector('soci-video').hasAttribute('ratio')")
      assert.deepEqual(await box('soci-video'), { width: 800, height: 600 })
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
