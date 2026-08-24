import SociComponent from './soci-component.js'
import config from '../config.js'

export default class SociMessageRow extends SociComponent {
  constructor() {
    super()
  }

  css() {
    return `
      :host {
        display: block;
        max-width: 100%;
        animation: message-row-load 0.2s var(--soci-ease, ease-out) both;
        padding: 4px 16px 4px 52px;
        position: relative;
      }
      :host(.no-animation) {
        animation: none;
      }
      :host(:hover) {
        background: var(--bg-bold-hover);
      }
      #hover-time {
        position: absolute;
        left: 8px;
        top: 4px;
        width: 38px;
        font-size: 11px;
        color: var(--text-tertiary);
        opacity: 0;
        pointer-events: none;
        text-align: center;
        display: none;
      }
      :host(:hover) #hover-time {
        opacity: 1;
      }

      #row {
        max-width: 100%;
        position: relative;
        padding: 20px 0 0 0;
      }

      #meta {
        position: absolute;
        left: -32px;
        top: 0;
        flex-shrink: 0;
        display: flex;
        gap: 8px;
        align-items: center;
      }
      #overlay {
        position: absolute;
        top: -10px;
        right: 0;
        display: flex;
        gap: 4px;
        opacity: 0;
        pointer-events: none;
        background: var(--bg);
        border: 1px solid var(--bg-secondary);
        border-radius: 4px;
        padding: 2px;
      }
      :host(:hover) #overlay {
        opacity: 1;
        pointer-events: auto;
      }
      .action {
        border: 0;
        background: transparent;
        color: var(--text-secondary);
        font-size: 12px;
        line-height: 1;
        padding: 4px 6px;
        border-radius: 3px;
        cursor: pointer;
      }
      .action:hover {
        background: var(--bg-secondary);
        color: var(--text);
      }
      #reply-action[hidden] {
        display: none;
      }

      soci-user {
        --font-size: 14px;
        --avatar-size: 24px;
        --font-weight: 600;
      }

      .message-body {
        flex: 1;
        min-width: 0;
      }
      
      slot[name="reactions"] {
        display: block;
        padding-top: 2px;
      }

      ::slotted(soci-markdown-view) {
        display: block;
        font-size: 14px;
        line-height: 1.5;
      }

      .message-image {
        margin-top: 8px;
        max-width: 100%;
        max-height: 200px;
        border-radius: 4px;
        cursor: zoom-in;
      }
      #images {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 0px;
        margin-bottom: 4px;
      }
      #images[hidden] {
        display: none;
      }
      #reply-count {
        margin: 4px 0 4px -4px;
        font-size: 12px;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 4px 8px 4px 4px;
        border-radius: 4px;
        width: fit-content;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      :host([slot="thread-replies"]) #reply-count {
        display: none;
      }
      #reply-avatars {
        display: inline-flex;
        align-items: center;
        padding-left: 2px;
      }
      #reply-avatars[hidden] {
        display: none;
      }
      #reply-avatars img {
        width: 18px;
        height: 18px;
        border-radius: 999px;
        border: 2px solid var(--bg);
        background: var(--bg-secondary);
        object-fit: cover;
        margin-left: -7px;
      }
      #reply-avatars img:first-child {
        margin-left: 0;
      }
      #reply-count:hover {
        color: var(--text);
        background: var(--bg-secondary);
      }
      #reply-count[hidden] {
        display: none;
      }

      #time {
        font-size: 12px;
        color: var(--text-tertiary);
      }

      :host([compact]) {
        padding-top: 0px;
        #meta {
          display: none;
        }
        #row {
          padding-top: 0;
        }
        #overlay {
          top: -8px;
        }
        #hover-time {
          display: block;
        }
      }

      @keyframes message-row-load {
        from {
          transform: translateY(4px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `
  }

  html() {
    return `
      <div id="row">
        <div id="overlay">
          <button id="react-action" class="action" type="button" title="Add reaction">😊</button>
          <button id="reply-action" class="action" type="button" title="Reply in thread">Reply</button>
        </div>
        <div id="meta">
          <soci-user id="user"></soci-user>
          <div id="time"><span id="meta-time"></span><suffix id="meta-suffix"> ago</suffix></div>
        </div>
        <div class="message-body">
          <slot></slot>
          <div id="images" hidden></div>
          <slot name="reactions"></slot>
          <div id="reply-count" hidden>
            <div id="reply-avatars" hidden></div>
            <span id="reply-count-text"></span>
          </div>
        </div>
      </div>
      <div id="hover-time"></div>
    `
  }

  static get observedAttributes() {
    return ['user', 'time', 'image-url', 'image-urls', 'parent-id', 'reply-count', 'reply-users']
  }

  setCompact(compact) {
    this.toggleAttribute('compact', !!compact)
  }

  connectedCallback() {
    this._syncTime()
    this._syncImage()
    this._syncReplyVisibility()
    this._syncReplyCount()
    const react = this.select('#react-action')
    const reply = this.select('#reply-action')
    const replyCount = this.select('#reply-count')
    const images = this.select('#images')
    if (react) react.addEventListener('click', () => this._emitAction('message-react'))
    if (reply) reply.addEventListener('click', () => this._emitAction('message-reply'))
    if (replyCount) replyCount.addEventListener('click', () => this._emitAction('message-reply'))
    if (images) {
      images.addEventListener('click', (e) => {
        const thumb = e.target.closest('img[data-index]')
        if (!thumb) return
        const imageURLs = this._getImageURLs()
        if (!imageURLs.length) return
        const index = Number.parseInt(thumb.dataset.index || '0', 10)
        this.fire('message-image-open', {
          messageID: Number.parseInt(this.dataset.messageId || '', 10) || 0,
          imageURLs,
          index: Number.isFinite(index) ? Math.max(0, Math.min(index, imageURLs.length - 1)) : 0
        })
      })
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name === 'user') this.select('#user').setAttribute('name', newValue)
    if (name === 'time') this._syncTime()
    if (name === 'image-url') this._syncImage()
    if (name === 'image-urls') this._syncImage()
    if (name === 'parent-id') this._syncReplyVisibility()
    if (name === 'reply-count') this._syncReplyCount()
    if (name === 'reply-users') this._syncReplyCount()
  }

  _syncTime() {
    const meta = this.select('#meta-time')
    const suffix = this.select('#meta-suffix')
    const hoverTime = this.select('#hover-time')
    const time = this.getAttribute('time')
    if (!meta) return
    const ts = Number.parseInt(time || '', 10)
    if (hoverTime && Number.isFinite(ts) && ts > 0) hoverTime.textContent = this._formatClock(ts)
    else if (hoverTime) hoverTime.textContent = ''
    if (!time || time === 'now') {
      meta.textContent = 'just now'
      if (suffix) suffix.style.display = 'none'
      return
    }
    if (suffix) suffix.style.display = ''
    this.updateTime = this.updateTime.bind(this)
    this.updateTime(time, meta)
  }

  _formatClock(ts) {
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) return ''
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }

  _syncImage() {
    const images = this.select('#images')
    if (!images) return
    const imageURLs = this._getImageURLs()
    images.innerHTML = ''
    if (!imageURLs.length) {
      images.hidden = true
      return
    }
    imageURLs.forEach((imageUrl, index) => {
      const img = document.createElement('img')
      img.className = 'message-image'
      img.alt = `Attachment ${index + 1}`
      img.loading = 'lazy'
      img.decoding = 'async'
      img.dataset.index = String(index)
      img.src = this._toImageSrc(imageUrl)
      images.appendChild(img)
    })
    images.hidden = false
  }

  _getImageURLs() {
    const list = []
    const imageUrlsRaw = this.getAttribute('image-urls') || ''
    if (imageUrlsRaw) {
      try {
        const parsed = JSON.parse(imageUrlsRaw)
        if (Array.isArray(parsed)) {
          parsed.forEach((entry) => {
            const value = typeof entry === 'string' ? entry.trim() : ''
            if (value) list.push(value)
          })
        }
      } catch {}
    }
    const single = (this.getAttribute('image-url') || '').trim()
    if (single && !list.includes(single)) list.unshift(single)
    return [...new Set(list)]
  }

  _toImageSrc(imageUrl) {
    if (!imageUrl) return ''
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl
    if (imageUrl.endsWith('.webp')) return `${config.IMAGE_HOST}/${imageUrl}`
    return `${config.IMAGE_HOST}/${imageUrl}.webp`
  }

  _syncReplyVisibility() {
    const reply = this.select('#reply-action')
    if (!reply) return
    reply.hidden = this.hasAttribute('parent-id')
  }

  _syncReplyCount() {
    const replyCountEl = this.select('#reply-count')
    const replyCountTextEl = this.select('#reply-count-text')
    const replyAvatarsEl = this.select('#reply-avatars')
    if (!replyCountEl) return
    if (this.hasAttribute('parent-id')) {
      replyCountEl.hidden = true
      if (replyCountTextEl) replyCountTextEl.textContent = ''
      if (replyAvatarsEl) replyAvatarsEl.innerHTML = ''
      return
    }
    const count = Number.parseInt(this.getAttribute('reply-count') || '0', 10)
    if (!Number.isFinite(count) || count <= 0) {
      replyCountEl.hidden = true
      if (replyCountTextEl) replyCountTextEl.textContent = ''
      if (replyAvatarsEl) replyAvatarsEl.innerHTML = ''
      return
    }
    replyCountEl.hidden = false
    if (replyCountTextEl) replyCountTextEl.textContent = `${count} ${count === 1 ? 'reply' : 'replies'}`
    this._syncReplyAvatars()
  }

  _syncReplyAvatars() {
    const replyAvatarsEl = this.select('#reply-avatars')
    if (!replyAvatarsEl) return
    const users = this._parseReplyUsers().slice(0, 5)
    replyAvatarsEl.innerHTML = ''
    if (!users.length) {
      replyAvatarsEl.hidden = true
      return
    }
    users.forEach((userName) => {
      const img = document.createElement('img')
      img.alt = userName
      img.loading = 'lazy'
      img.decoding = 'async'
      img.src = `${config.AVATAR_HOST}/thumbnail/${encodeURIComponent(userName)}.webp`
      img.addEventListener('error', () => {
        img.src = `${config.AVATAR_HOST}/thumbnail/default.png`
      }, { once: true })
      replyAvatarsEl.appendChild(img)
    })
    replyAvatarsEl.hidden = false
  }

  _parseReplyUsers() {
    const raw = this.getAttribute('reply-users')
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter((name) => typeof name === 'string' && name.trim())
    } catch {
      return raw.split(',').map((name) => name.trim()).filter(Boolean)
    }
  }

  _emitAction(name) {
    const messageID = Number.parseInt(this.dataset.messageId || '', 10)
    this.fire(name, { messageID })
  }
}
