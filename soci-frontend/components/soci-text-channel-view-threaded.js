import SociComponent from './soci-component.js'
import config from '../config.js'

export default class SociTextChannelViewThreaded extends SociComponent {
  constructor() {
    super()
    this._mainLastRenderedMessage = null
    this._threadLastRenderedMessage = null
    this._mainMessagesByID = new Map()
    this._threadMessagesByID = new Map()
    this._threadParent = null
    this._emojiSets = null
    this._pickerTargetMessageID = null
    this._activeComposer = 'main'
    this._pendingAttachments = { main: [], thread: [] }
    this._nextPendingAttachmentID = 1
    this._channelSocket = null
    this._channelSocketCommunity = null
    this._channelSocketChannel = null
    this._channelSocketReconnectTimer = null
    this._channelSocketReconnectAttempt = 0
    this._locallySentMessageIDs = new Set()
    this._localSendMarkerTimers = new Map()
  }

  css(){
    return `
      :host {
        display: block;
        height: 100%;
        width: 100%;
        background: var(--bg-bold);
      }
      #layout {
        display: flex;
        height: 100%;
        min-height: 0;
      }
      #main {
        flex: 1;
        min-width: 0;
        position: relative;
      }
      #main-scroll, #thread-scroll {
        height: 100%;
        overflow: auto;
        padding: 12px 0 80px;
        box-sizing: border-box;
        scrollbar-width: auto;
        scrollbar-color: var(--text-secondary) var(--bg-bold);
      }
      #main-scroll::-webkit-scrollbar, #thread-scroll::-webkit-scrollbar {
        width: 12px;
      }
      #main-scroll::-webkit-scrollbar-track, #thread-scroll::-webkit-scrollbar-track {
        background: var(--bg-bold);
      }
      #main-scroll::-webkit-scrollbar-thumb, #thread-scroll::-webkit-scrollbar-thumb {
        border-radius: 7px;
        border: 3px solid var(--bg-bold);
      }
      #thread {
        width: 360px;
        border-left: 1px solid var(--bg-secondary);
        background: var(--bg);
        position: relative;
        display: none;
      }
      :host([thread-open]) #thread {
        display: flex;
        flex-direction: column;
      }
      #thread-header {
        background: var(--bg);
        border-bottom: 1px solid var(--bg-secondary);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
      }
      .icon-btn {
        border: 0;
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 8px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .icon-btn:hover {
        color: var(--text);
        background: var(--bg-secondary);
      }
      .compose {
        position: absolute;
        left: 16px;
        right: 16px;
        bottom: 12px;
        border: 1px solid var(--bg-secondary);
        border-radius: 4px;
        background: var(--bg);
        box-shadow: 0 1px 2px var(--shadow);
        z-index: 2;
      }
      .compose-row {
        display: flex;
        align-items: flex-end;
        gap: 8px;
      }
      soci-input {
        flex: 1;
        --min-height: 38px;
      }
      .compose-row soci-input {
        border: 0;
        border-radius: 0;
        background: transparent;
        margin: 0;
      }
      .reactions {
        display: flex;
        gap: 6px;
        margin-top: 8px;
        flex-wrap: wrap;
      }
      .reaction {
        border: 1px solid var(--bg-secondary);
        border-radius: 999px;
        padding: 2px 8px;
        background: var(--bg);
        color: var(--text-secondary);
        font-size: 12px;
        display: inline-flex;
        gap: 6px;
        align-items: center;
        cursor: pointer;
      }
      .reaction:hover {
        background: var(--bg-secondary);
      }
      .reaction[reacted] {
        border-color: var(--bg-brand);
        color: var(--text-brand);
        background: var(--bg-brand-secondary);
      }
      .reaction soci-emoji {
        width: 14px;
        height: 14px;
      }
      #emoji-picker {
        display: none;
        position: absolute;
        right: 18px;
        bottom: 62px;
        z-index: 4;
        width: 280px;
        max-height: 300px;
        overflow: auto;
        background: var(--bg);
        border: 1px solid var(--bg-secondary);
        border-radius: 6px;
        box-shadow: 0 3px 12px var(--shadow);
        padding: 8px;
      }
      #emoji-picker[open] {
        display: block;
      }
      .emoji-section {
        margin-bottom: 8px;
      }
      .emoji-label {
        font-size: 11px;
        color: var(--text-secondary);
        margin-bottom: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 600;
      }
      .emoji-grid {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 6px;
      }
      .emoji-btn {
        border: 1px solid transparent;
        border-radius: 4px;
        background: transparent;
        min-height: 28px;
        cursor: pointer;
        padding: 0;
      }
      .emoji-btn:hover {
        background: var(--bg-secondary);
        border-color: var(--bg-secondary);
      }
      #thread-emoji-btn, #emoji-btn {
        display: none;
      }
      #attach-btn {
        position: absolute;
        top: 3px;
        right: 3px;
      }
      #thread-attach-btn {
        position: absolute;
        top: 3px;
        right: 3px;
      }
      .attach-preview {
        display: none;
        padding: 0 10px 8px;
      }
      .attach-preview-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .attach-preview img {
        height: 80px;
        max-width: 140px;
        object-fit: contain;
      }
      .attach-thumb {
        position: relative;
        border-radius: 4px;
        display: inline-flex;
        overflow: hidden;
        background: var(--bg-bold);
      }
      .attach-thumb img {
        display: block;
      }
      .attach-thumb-remove {
        position: absolute;
        top: 2px;
        right: 2px;
        border: 0;
        border-radius: 999px;
        width: 18px;
        height: 18px;
        background: rgba(0, 0, 0, 0.65);
        color: #fff;
        cursor: pointer;
        line-height: 1;
        padding: 0;
        font-size: 12px;
      }
      .attach-thumb-status {
        position: absolute;
        left: 4px;
        bottom: 4px;
        border-radius: 3px;
        padding: 2px 5px;
        font-size: 10px;
        background: rgba(0, 0, 0, 0.65);
        color: #fff;
      }
      :host([drag-over]) #layout {
        outline: 2px dashed var(--bg-brand);
        outline-offset: -4px;
      }
      @media (max-width: 900px) {
        :host([thread-open]) #main {
          display: none;
        }
        #thread {
          width: 100%;
          border-left: 0;
        }
      }
    `
  }

  html(){
    return `
      <div id="layout">
        <div id="main">
          <div id="main-scroll">
            <slot></slot>
          </div>
          <div id="main-compose" class="compose">
            <div class="compose-row">
              <soci-input id="message-input" placeholder="Message..."></soci-input>
              <button id="emoji-btn" class="icon-btn" type="button" title="Emoji">😊</button>
              <button id="attach-btn" class="icon-btn" type="button" title="Attach image">
                <soci-icon glyph="filterImages" size="16"></soci-icon>
              </button>
              <input id="file-input" type="file" accept="image/*" multiple style="display:none">
            </div>
            <div id="attach-preview" class="attach-preview">
              <div class="attach-preview-list" id="attach-preview-list"></div>
            </div>
          </div>
          <div id="emoji-picker"></div>
        </div>
        <div id="thread">
          <div id="thread-header">
            <button id="thread-back" class="icon-btn" type="button" title="Back">←</button>
            <div id="thread-title">Thread</div>
          </div>
          <div id="thread-scroll">
            <slot name="thread-replies"></slot>
          </div>
          <div class="compose" style="left:10px;right:10px;">
            <div class="compose-row">
              <soci-input id="thread-input" placeholder="Reply in thread..."></soci-input>
              <button id="thread-emoji-btn" class="icon-btn" type="button" title="Emoji">😊</button>
              <button id="thread-attach-btn" class="icon-btn" type="button" title="Attach image">
                <soci-icon glyph="filterImages" size="16"></soci-icon>
              </button>
              <input id="thread-file-input" type="file" accept="image/*" multiple style="display:none">
            </div>
            <div id="thread-attach-preview" class="attach-preview">
              <div class="attach-preview-list" id="thread-attach-preview-list"></div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  static get observedAttributes() {
    return ['community', 'channel']
  }

  get community() {
    return this.getAttribute('community')
  }

  get channel() {
    return this.getAttribute('channel')
  }

  attributeChangedCallback(name) {
    if ((name === 'community' || name === 'channel') && this.community && this.channel) {
      this._loadMessages()
      this._loadEmojiSets()
      this._startChannelMessagesSocket()
    }
  }

  connectedCallback() {
    super.connectedCallback?.()
    
    const input = this.select('#message-input')
    const threadInput = this.select('#thread-input')
    const attachBtn = this.select('#attach-btn')
    const fileInput = this.select('#file-input')
    const threadAttachBtn = this.select('#thread-attach-btn')
    const threadFileInput = this.select('#thread-file-input')
    const emojiBtn = this.select('#emoji-btn')
    const threadEmojiBtn = this.select('#thread-emoji-btn')
    const threadBack = this.select('#thread-back')

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          if (input.querySelector('#token-search[active]')) return
          e.preventDefault()
          this._sendMessage()
        }
      }, true)
      input.addEventListener('focus', () => { this._activeComposer = 'main' })
    }

    if (threadInput) {
      threadInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          if (threadInput.querySelector('#token-search[active]')) return
          e.preventDefault()
          this._sendThreadReply()
        }
      }, true)
      threadInput.addEventListener('focus', () => { this._activeComposer = 'thread' })
    }

    if (attachBtn && fileInput) {
      attachBtn.addEventListener('click', () => fileInput.click())
      fileInput.addEventListener('change', () => this._onComposerFileInputChange('main'))
    }
    if (threadAttachBtn && threadFileInput) {
      threadAttachBtn.addEventListener('click', () => threadFileInput.click())
      threadFileInput.addEventListener('change', () => this._onComposerFileInputChange('thread'))
    }

    if (emojiBtn) emojiBtn.addEventListener('click', () => this._openEmojiPicker())
    if (threadEmojiBtn) threadEmojiBtn.addEventListener('click', () => this._openEmojiPicker())
    if (threadBack) threadBack.addEventListener('click', () => this._closeThread())

    // Listeners for both Light DOM (bubbling to host) and Shadow DOM (captured at shadowRoot)
    const handleThreadOpen = (e) => this._openThread(e.detail?.messageID)
    const handleReact = (e) => this._openEmojiPicker(e.detail?.messageID)
    const handleContext = (e) => this._onEmojiContext(e)
    const handleImageOpen = (e) => this._onMessageImageOpen(e)
    const handlePaste = (e) => this._onPasteImages(e)
    const handleDragOver = (e) => this._onDragOver(e)
    const handleDragLeave = (e) => this._onDragLeave(e)
    const handleDrop = (e) => this._onDropImages(e)
    const handleClick = (e) => {
      const picker = this.select('#emoji-picker')
      const path = e.composedPath?.() || []
      const fromMessageReactAction = path.some(node => node?.id === 'react-action')
      if (picker && picker.hasAttribute('open') && 
          !fromMessageReactAction &&
          !e.target.closest('#emoji-picker') && 
          !e.target.closest('#emoji-btn') && 
          !e.target.closest('#thread-emoji-btn')) {
        this._closeEmojiPicker()
      }
    }

    this.addEventListener('message-reply', handleThreadOpen)
    this.shadowRoot.addEventListener('message-reply', handleThreadOpen)
    
    this.addEventListener('message-react', handleReact)
    this.shadowRoot.addEventListener('message-react', handleReact)

    this.addEventListener('contextmenu', handleContext)
    this.shadowRoot.addEventListener('contextmenu', handleContext)
    this.addEventListener('message-image-open', handleImageOpen)
    this.shadowRoot.addEventListener('message-image-open', handleImageOpen)
    // Bind host-only for native clipboard/drag events to avoid double-handling.
    this.addEventListener('paste', handlePaste)
    this.addEventListener('dragover', handleDragOver)
    this.addEventListener('dragleave', handleDragLeave)
    this.addEventListener('drop', handleDrop)
    
    this.addEventListener('click', handleClick)
    this.shadowRoot.addEventListener('click', handleClick)

    if (this.community && this.channel) {
      this._loadMessages()
      this._loadEmojiSets()
      this._startChannelMessagesSocket()
    }
  }

  disconnectedCallback() {
    this._stopChannelMessagesSocket()
    this._clearLocalSendMarkers()
    this._clearPendingAttachments('main')
    this._clearPendingAttachments('thread')
  }

  async _onComposerFileInputChange(composer) {
    const fileInput = composer === 'thread'
      ? this.select('#thread-file-input')
      : this.select('#file-input')
    if (!fileInput?.files?.length) return
    await this._queueComposerFiles(composer, Array.from(fileInput.files))
    fileInput.value = ''
  }

  async _queueComposerFiles(composer, files) {
    if (!this.authToken || !Array.isArray(files) || !files.length) return
    const imageFiles = files.filter((file) => file?.type?.startsWith?.('image/'))
    if (!imageFiles.length) return
    const additions = imageFiles.map((file) => ({
      id: this._nextPendingAttachmentID++,
      previewUrl: URL.createObjectURL(file),
      uploadedUrl: '',
      uploading: true,
      error: false
    }))
    this._setPendingAttachments(composer, [...this._getPendingAttachments(composer), ...additions])
    additions.forEach((attachment, index) => {
      this._uploadImageFile(imageFiles[index]).then((url) => {
        this._markPendingAttachmentUploaded(composer, attachment.id, url)
      })
    })
  }

  async _uploadImageFile(file) {
    if (!file || !this.authToken) return ''
    const fd = new FormData()
    fd.append('files', file)
    fd.append('url', '')
    return await new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', config.IMAGE_HOST + '/upload')
      xhr.setRequestHeader('Authorization', 'Bearer ' + this.authToken)
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve((xhr.responseText || '').trim().replace(/\.webp$/i, ''))
          return
        }
        resolve('')
      }
      xhr.onerror = () => resolve('')
      xhr.send(fd)
    })
  }

  async _loadMessages() {
    if (!this.community || !this.channel || !this.authToken) return
    
    const res = await window.api.channelMessages.list(this.community, this.channel).catch(() => null)
    const messages = res?.messages || []
    
    // Clear light DOM children (messages)
    this.innerHTML = ''
    this._mainLastRenderedMessage = null
    this._mainMessagesByID.clear()
    
    this._sortMessagesByDateAsc(messages).forEach(msg => {
      this._appendMainMessage(msg)
    })
    
    this._scrollToBottom(this.select('#main-scroll'))
    
    const threadID = this._threadParent?.id || this._getThreadParam()
    if (threadID) this._openThread(threadID)
  }

  _renderMessage(msg, compact = false) {
    const normalized = this._normalizeMessage(msg)
    if (!normalized) return document.createElement('div')
    const row = document.createElement('soci-message-row')
    row.dataset.messageId = String(normalized.id || '')
    row.setAttribute('user', normalized.user || '')
    row.setAttribute('time', String(normalized.date || 'now'))
    row.setAttribute('reply-count', String(normalized.replyCount || 0))
    if (Array.isArray(normalized.replyUsers) && normalized.replyUsers.length) {
      row.setAttribute('reply-users', JSON.stringify(normalized.replyUsers.slice(0, 5)))
    }
    
    if (normalized.parentID) row.setAttribute('parent-id', String(normalized.parentID))
    if (normalized.imageUrl) row.setAttribute('image-url', normalized.imageUrl)
    if (Array.isArray(normalized.imageUrls) && normalized.imageUrls.length) {
      row.setAttribute('image-urls', JSON.stringify(normalized.imageUrls))
    }
    
    if (compact) row.setCompact?.(true)
    
    const md = document.createElement('soci-markdown-view')
    if (normalized.content) {
      md.render(normalized.content).catch(() => {})
    } else {
      md.style.display = 'none'
    }
    row.appendChild(md)
    
    const reactions = this._renderReactions(normalized)
    reactions.slot = 'reactions'
    row.appendChild(reactions)
    
    return row
  }

  _isCompactMessage(prev, next) {
    if (!prev || !next) return false
    if (prev.user !== next.user) return false
    return (next.date - prev.date) <= 5 * 60 * 1000
  }

  _appendMainMessage(msg) {
    if (!msg?.id) return
    const normalized = this._normalizeMessage(msg)
    if (!normalized?.id) return
    if (this._mainMessagesByID.has(normalized.id)) {
      const existing = this._mainMessagesByID.get(normalized.id) || {}
      const merged = { ...existing, ...normalized }
      this._mainMessagesByID.set(normalized.id, merged)
      this._syncRenderedMessageRow(merged)
      return
    }
    const compact = this._isCompactMessage(this._mainLastRenderedMessage, normalized)
    this.appendChild(this._renderMessage(normalized, compact))
    this._mainLastRenderedMessage = normalized
    this._mainMessagesByID.set(normalized.id, normalized)
  }

  _appendThreadMessage(msg) {
    if (!msg?.id) return
    const normalized = this._normalizeMessage(msg)
    if (!normalized?.id) return
    if (this._threadMessagesByID.has(normalized.id)) {
      const existing = this._threadMessagesByID.get(normalized.id) || {}
      const merged = { ...existing, ...normalized }
      this._threadMessagesByID.set(normalized.id, merged)
      this._syncRenderedMessageRow(merged)
      return
    }
    const compact = this._isCompactMessage(this._threadLastRenderedMessage, normalized)
    const row = this._renderMessage(normalized, compact)
    row.slot = 'thread-replies'
    this.appendChild(row)
    this._threadLastRenderedMessage = normalized
    this._threadMessagesByID.set(normalized.id, normalized)
  }

  _renderReactions(msg) {
    const wrap = document.createElement('div')
    wrap.className = 'reactions'
    
    const reactions = msg.reactions || []
    reactions.forEach(r => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'reaction'
      if (r.reacted) btn.setAttribute('reacted', '')
      
      btn.appendChild(this._emojiNode(r.emoji))
      
      const count = document.createElement('span')
      count.textContent = String(r.count || 0)
      btn.appendChild(count)
      
      btn.addEventListener('click', () => this._toggleReaction(msg.id, r.emoji))
      wrap.appendChild(btn)
    })
    return wrap
  }

  _emojiNode(emoji) {
    // Check if it's a custom emoji token :name:
    const m = emoji?.match(/^:([a-z0-9_]+):$/)
    if (m) {
      const name = m[1]
      const customEmoji = document.createElement('soci-emoji')
      customEmoji.className = 'chip-emoji'
      customEmoji.dataset.emojiName = name
      customEmoji.setAttribute('name', name)
      return customEmoji
    }
    
    // Fallback to text (unicode emoji)
    const span = document.createElement('span')
    span.textContent = emoji
    return span
  }

  async _sendMessage() {
    const input = this.select('#message-input')
    const content = (input?.value || '').trim()
    const imageUrls = this._getPendingImageUrls('main')
    
    if (!content && !imageUrls.length) return
    if (this._hasBlockingPendingAttachments('main')) return
    
    const res = await window.api.channelMessages.send({
      community: this.community,
      channel: this.channel,
      content,
      imageUrl: imageUrls[0] || '',
      imageUrls
    }).catch(() => null)
    
    if (!res?.id) return
    
    input.value = ''
    const sentImageUrls = [...imageUrls]
    this._clearPendingAttachments('main')

    const mainScroll = this.select('#main-scroll')
    const shouldScroll = this._isScrollNearBottom(mainScroll)
    this._markLocallySentMessage(res.id)
    const sent = this._normalizeMessage({
      id: res.id,
      user: this._resolveMessageUser(res, window.soci?.username || ''),
      date: this._resolveMessageDate(res),
      content,
      imageUrl: sentImageUrls[0] || '',
      imageUrls: sentImageUrls,
      reactions: [],
      replyCount: 0
    })
    if (!sent?.id) return
    if (this._mainMessagesByID.has(sent.id)) {
      const existing = this._mainMessagesByID.get(sent.id) || {}
      this._mainMessagesByID.set(sent.id, { ...existing, ...sent })
      this._syncRenderedMessageRow(this._mainMessagesByID.get(sent.id))
      return
    }
    this._appendMainMessage(sent)
    if (shouldScroll) this._scrollToBottom(mainScroll)
  }

  async _openThread(messageID) {
    const res = await window.api.channelMessages.thread(this.community, this.channel, messageID).catch(() => null)
    if (!res) return
    
    const parent = this._resolveThreadParent(messageID, res.parent)
    this._threadParent = parent
    this._setThreadParam(messageID)
    this.setAttribute('thread-open', '')
    this.select('#thread-title').textContent = parent?.user
      ? `Thread with ${parent.user}`
      : 'Thread'
      
    this.querySelectorAll('[slot="thread-replies"]').forEach((el) => el.remove())
    this._setMainReplyUsersFromThread(messageID, res.messages || [])
    
    // Render parent first, then replies oldest -> newest.
    const orderedReplies = this._sortMessagesByDateAsc(res.messages || [])
    const messages = [parent, ...orderedReplies].filter(Boolean)
    
    this._threadLastRenderedMessage = null
    this._threadMessagesByID.clear()
    messages.forEach(msg => this._appendThreadMessage(msg))
    
    this._scrollToBottom(this.select('#thread-scroll'))
    this._focusThreadInput()
  }

  _closeThread() {
    this.removeAttribute('thread-open')
    this._threadParent = null
    this._threadLastRenderedMessage = null
    this._threadMessagesByID.clear()
    this._setThreadParam()
    this.querySelectorAll('[slot="thread-replies"]').forEach((el) => el.remove())
  }

  async _sendThreadReply() {
    if (!this._threadParent?.id) return
    
    const input = this.select('#thread-input')
    const content = (input?.value || '').trim()
    const imageUrls = this._getPendingImageUrls('thread')
    
    if (!content && !imageUrls.length) return
    if (this._hasBlockingPendingAttachments('thread')) return
    
    const res = await window.api.channelMessages.sendThreadReply({
      community: this.community,
      channel: this.channel,
      parentID: this._threadParent.id,
      content,
      imageUrl: imageUrls[0] || '',
      imageUrls
    }).catch(() => null)
    
    if (!res?.id) return
    
    input.value = ''
    this._clearPendingAttachments('thread')
    const replyUser = this._resolveMessageUser(res, window.soci?.username || '')
    const threadScroll = this.select('#thread-scroll')
    const shouldScroll = this._isScrollNearBottom(threadScroll)
    this._markLocallySentMessage(res.id)
    const sent = this._normalizeMessage({
      id: res.id,
      parentID: this._threadParent.id,
      user: replyUser,
      date: this._resolveMessageDate(res),
      content,
      imageUrl: imageUrls[0] || '',
      imageUrls,
      reactions: [],
      replyCount: 0
    })
    if (!sent?.id) return
    if (this._threadMessagesByID.has(sent.id)) {
      const existing = this._threadMessagesByID.get(sent.id) || {}
      this._threadMessagesByID.set(sent.id, { ...existing, ...sent })
      this._syncRenderedMessageRow(this._threadMessagesByID.get(sent.id))
      return
    }
    this._appendThreadMessage(sent)
    if (shouldScroll) this._scrollToBottom(threadScroll)
    this._incrementMainReplyCount(this._threadParent.id)
    this._bumpMainReplyUsers(this._threadParent.id, replyUser)
  }

  async _toggleReaction(messageID, emoji) {
    const res = await window.api.channelMessages.react(messageID, emoji).catch(() => null)
    if (!res || typeof res.reacted !== 'boolean') return

    const syncMessage = (msg) => {
      if (!msg) return
      const reactions = Array.isArray(msg.reactions) ? [...msg.reactions] : []
      const idx = reactions.findIndex((r) => r.emoji === emoji)
      if (res.reacted) {
        if (idx >= 0) {
          const count = Number.parseInt(String(reactions[idx].count || 0), 10) || 0
          // Keep websocket-updated counts authoritative when already present.
          reactions[idx] = { ...reactions[idx], reacted: true, count: Math.max(1, count) }
        } else {
          reactions.push({ emoji, count: 1, reacted: true })
        }
      } else if (idx >= 0) {
        const count = Number.parseInt(String(reactions[idx].count || 0), 10) || 0
        const nextCount = reactions[idx].reacted ? Math.max(0, count - 1) : count
        if (nextCount === 0) reactions.splice(idx, 1)
        else reactions[idx] = { ...reactions[idx], reacted: false, count: nextCount }
      }
      msg.reactions = reactions
    }

    const mainMsg = this._mainMessagesByID.get(messageID)
    syncMessage(mainMsg)
    if (mainMsg) this._mainMessagesByID.set(messageID, mainMsg)

    const threadMsg = this._threadMessagesByID.get(messageID)
    syncMessage(threadMsg)
    if (threadMsg) this._threadMessagesByID.set(messageID, threadMsg)

    this._replaceRenderedReactions(messageID)
  }

  async _loadEmojiSets() {
    const sets = await window.api.emoji.sets(this.community).catch(() => null)
    if (!sets) return
    this._emojiSets = sets
    this._renderPicker()
  }

  _renderPicker() {
    const picker = this.select('#emoji-picker')
    if (!picker || !this._emojiSets) return
    
    const renderSection = (title, items, isCustom) => {
      if (!items?.length) return ''
      const buttons = items.map(item => {
        // If custom, item is an Emoji object { name, ... }
        // If default, item is { Emoji: "❤️", Name: "heart" }
        // Note: The API returns `name` for custom emojis and `Name`/`Emoji` for defaults.
        
        if (isCustom) {
          return `
            <button class="emoji-btn" data-emoji=":${item.name}:" title=":${item.name}:">
              <soci-emoji class="chip-emoji" name="${item.name}"></soci-emoji>
            </button>
          `
        } else {
          return `
            <button class="emoji-btn" data-emoji="${item.emoji}" title="${item.name}">
              ${item.emoji}
            </button>
          `
        }
      }).join('')
      
      return `
        <div class="emoji-section">
          <div class="emoji-label">${title}</div>
          <div class="emoji-grid">${buttons}</div>
        </div>
      `
    }
    
    picker.innerHTML = [
      renderSection('Default', this._emojiSets.defaults, false),
      renderSection('Community', this._emojiSets.community, true),
      renderSection('Personal', this._emojiSets.personal, true),
      renderSection('Subscribed', this._emojiSets.subscribed, true)
    ].join('')
    
    picker.querySelectorAll('[data-emoji]').forEach(btn => {
      btn.addEventListener('click', () => this._chooseEmoji(btn.dataset.emoji))
    })
  }

  _openEmojiPicker(messageID = null) {
    this._pickerTargetMessageID = messageID || null
    this.select('#emoji-picker')?.setAttribute('open', '')
  }

  _closeEmojiPicker() {
    this._pickerTargetMessageID = null
    this.select('#emoji-picker')?.removeAttribute('open')
  }

  _chooseEmoji(emoji) {
    if (this._pickerTargetMessageID) {
      this._toggleReaction(this._pickerTargetMessageID, emoji)
      this._closeEmojiPicker()
      return
    }
    
    const input = this._activeComposer === 'thread' 
      ? this.select('#thread-input') 
      : this.select('#message-input')
      
    if (!input) return
    
    if (typeof input.insertText === 'function') input.insertText(emoji)
    else input.value = `${input.value || ''}${emoji}`
    input.focus()
    
    this._closeEmojiPicker()
  }

  _onEmojiContext(e) {
    const path = e.composedPath?.() || []
    const emojiNode = path.find((node) => node?.tagName === 'SOCI-EMOJI')
      || e.target?.closest?.('soci-emoji')
    const name = emojiNode?.getAttribute?.('name') || e.target?.dataset?.emojiName
    if (!name) return
    
    e.preventDefault()
    window.api.emoji.subscribe(null, name).then(() => this._loadEmojiSets()).catch(() => {})
  }

  _incrementMainReplyCount(messageID) {
    const existing = this._mainMessagesByID.get(messageID)
    if (!existing) return
    const next = (existing.replyCount || 0) + 1
    existing.replyCount = next
    this._mainMessagesByID.set(messageID, existing)
    const row = this.querySelector(`soci-message-row[data-message-id="${messageID}"]`)
    if (row) row.setAttribute('reply-count', String(next))
  }

  _setMainReplyUsers(messageID, users) {
    if (!messageID) return
    const nextUsers = Array.isArray(users) ? users.filter((name) => typeof name === 'string' && name.trim()).slice(0, 5) : []
    const existing = this._mainMessagesByID.get(messageID)
    if (existing) {
      existing.replyUsers = nextUsers
      this._mainMessagesByID.set(messageID, existing)
    }
    const row = this.querySelector(`soci-message-row[data-message-id="${messageID}"]`)
    if (!row) return
    if (nextUsers.length) row.setAttribute('reply-users', JSON.stringify(nextUsers))
    else row.removeAttribute('reply-users')
  }

  _setMainReplyUsersFromThread(messageID, replies) {
    if (!messageID || !Array.isArray(replies) || !replies.length) return
    const counts = new Map()
    replies.forEach((reply) => {
      const user = reply?.user
      if (!user) return
      counts.set(user, (counts.get(user) || 0) + 1)
    })
    const users = [...counts.entries()]
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([name]) => name)
    this._setMainReplyUsers(messageID, users)
  }

  _bumpMainReplyUsers(messageID, userName) {
    if (!messageID || !userName) return
    const existing = this._mainMessagesByID.get(messageID)
    const users = Array.isArray(existing?.replyUsers) ? [...existing.replyUsers] : []
    const withoutUser = users.filter((name) => name !== userName)
    this._setMainReplyUsers(messageID, [userName, ...withoutUser])
  }

  _replaceRenderedReactions(messageID) {
    const msg = this._threadMessagesByID.get(messageID) || this._mainMessagesByID.get(messageID)
    if (!msg) return
    this.querySelectorAll(`soci-message-row[data-message-id="${messageID}"]`).forEach((row) => {
      const hadVisibleReactions = row.querySelectorAll('[slot="reactions"] .reaction').length > 0
      row.querySelectorAll('[slot="reactions"]').forEach((el) => el.remove())
      const reactions = this._renderReactions(msg)
      reactions.slot = 'reactions'
      row.appendChild(reactions)
      if (hadVisibleReactions && reactions.querySelectorAll('.reaction').length === 0) {
        const parent = row.parentNode
        if (!parent) return
        const next = row.nextSibling
        row.classList.add('no-animation')
        row.remove()
        if (next) parent.insertBefore(row, next)
        else parent.appendChild(row)
      }
    })
  }

  _getThreadParam() {
    const params = new URLSearchParams(window.location.search)
    const val = Number.parseInt(params.get('thread') || '', 10)
    return Number.isFinite(val) && val > 0 ? val : null
  }

  _setThreadParam(messageID = null) {
    const url = new URL(window.location.href)
    if (messageID) url.searchParams.set('thread', String(messageID))
    else url.searchParams.delete('thread')
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState(window.history.state, '', next)
  }
  
  _scrollToBottom(scrollEl) {
    if (!scrollEl) return
    requestAnimationFrame(() => {
      scrollEl.scrollTop = scrollEl.scrollHeight
    })
  }

  _focusThreadInput() {
    requestAnimationFrame(() => {
      const input = this.select('#thread-input')
      if (!input) return
      input.focus({ preventScroll: true })
      this._activeComposer = 'thread'
    })
  }

  _attachComposerAutoResize(input) {
    return input
  }

  _resizeComposer(input) {
    return input
  }

  _normalizeMessage(msg) {
    if (!msg || typeof msg !== 'object') return null
    const normalized = { ...msg }
    normalized.id = this._normalizeMessageID(normalized.id)
    normalized.parentID = this._normalizeMessageID(normalized.parentID)
    normalized.user = this._resolveMessageUser(normalized, '')
    normalized.date = this._resolveMessageDate(normalized)
    normalized.imageUrls = this._collectImageUrls(normalized.imageUrls, normalized.imageUrl)
    normalized.imageUrl = normalized.imageUrls[0] || ''
    if (!Array.isArray(normalized.reactions)) normalized.reactions = []
    return normalized
  }

  _normalizeMessageID(id) {
    if (id === null || id === undefined) return id
    const parsed = Number.parseInt(String(id).trim(), 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
    return id
  }

  _resolveMessageUser(msg, fallback = '') {
    const candidates = [
      msg?.user,
      msg?.username,
      msg?.author,
      msg?.authorName,
      fallback
    ]
    for (const candidate of candidates) {
      const value = typeof candidate === 'string' ? candidate.trim() : ''
      if (!value || value === 'nil' || value === '<nil>' || value === 'null') continue
      return value
    }
    return ''
  }

  _resolveMessageDate(msg) {
    const dateCandidates = [msg?.date, msg?.createdAt, msg?.created_at]
    for (const candidate of dateCandidates) {
      if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
        return candidate < 1e12 ? candidate * 1000 : candidate
      }
      const raw = String(candidate || '').trim()
      if (!raw) continue
      if (/^\d+$/.test(raw)) {
        const asInt = Number.parseInt(raw, 10)
        if (Number.isFinite(asInt) && asInt > 0) return raw.length <= 10 ? asInt * 1000 : asInt
      }
      const asTime = Date.parse(raw)
      if (Number.isFinite(asTime) && asTime > 0) return asTime
    }
    return Date.now()
  }

  _collectImageUrls(imageUrls, imageUrl) {
    const out = []
    if (Array.isArray(imageUrls)) {
      imageUrls.forEach((entry) => {
        const value = typeof entry === 'string' ? entry.trim() : ''
        if (value) out.push(value)
      })
    }
    if (typeof imageUrl === 'string') {
      const trimmed = imageUrl.trim()
      if (trimmed) {
        if (trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed)
            if (Array.isArray(parsed)) {
              parsed.forEach((entry) => {
                const value = typeof entry === 'string' ? entry.trim() : ''
                if (value) out.push(value)
              })
            }
          } catch {}
        } else if (trimmed.includes(',')) {
          trimmed.split(',').forEach((entry) => {
            const value = entry.trim()
            if (value) out.push(value)
          })
        } else {
          out.push(trimmed)
        }
      }
    }
    return [...new Set(out)]
  }

  _getPendingAttachments(composer) {
    return composer === 'thread'
      ? [...(this._pendingAttachments.thread || [])]
      : [...(this._pendingAttachments.main || [])]
  }

  _setPendingAttachments(composer, attachments) {
    const next = Array.isArray(attachments) ? attachments : []
    if (composer === 'thread') this._pendingAttachments.thread = next
    else this._pendingAttachments.main = next
    this._renderAttachPreview(composer)
  }

  _getPendingImageUrls(composer) {
    return this._getPendingAttachments(composer)
      .filter((item) => !item.uploading && !item.error && item.uploadedUrl)
      .map((item) => item.uploadedUrl)
  }

  _hasBlockingPendingAttachments(composer) {
    return this._getPendingAttachments(composer).some((item) => item.uploading || item.error)
  }

  _markPendingAttachmentUploaded(composer, attachmentID, uploadedUrl) {
    const list = this._getPendingAttachments(composer)
    const idx = list.findIndex((item) => item.id === attachmentID)
    if (idx < 0) return
    const ok = typeof uploadedUrl === 'string' && uploadedUrl.trim()
    list[idx] = {
      ...list[idx],
      uploadedUrl: ok ? uploadedUrl.trim() : '',
      uploading: false,
      error: !ok
    }
    this._setPendingAttachments(composer, list)
  }

  _removePendingAttachment(composer, attachmentID) {
    const list = this._getPendingAttachments(composer)
    const idx = list.findIndex((item) => item.id === attachmentID)
    if (idx < 0) return
    const [removed] = list.splice(idx, 1)
    if (removed?.previewUrl?.startsWith?.('blob:')) URL.revokeObjectURL(removed.previewUrl)
    this._setPendingAttachments(composer, list)
  }

  _clearPendingAttachments(composer) {
    this._getPendingAttachments(composer).forEach((item) => {
      if (item?.previewUrl?.startsWith?.('blob:')) URL.revokeObjectURL(item.previewUrl)
    })
    this._setPendingAttachments(composer, [])
  }

  _renderAttachPreview(composer) {
    const preview = composer === 'thread'
      ? this.select('#thread-attach-preview')
      : this.select('#attach-preview')
    const list = composer === 'thread'
      ? this.select('#thread-attach-preview-list')
      : this.select('#attach-preview-list')
    if (!preview || !list) return
    const attachments = this._getPendingAttachments(composer)
    list.innerHTML = ''
    if (!attachments.length) {
      preview.style.display = 'none'
      return
    }
    attachments.forEach((attachment, index) => {
      const thumb = document.createElement('div')
      thumb.className = 'attach-thumb'
      const img = document.createElement('img')
      img.alt = `Attachment ${index + 1}`
      img.src = attachment.previewUrl || this._toImageSrc(attachment.uploadedUrl)
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'attach-thumb-remove'
      remove.textContent = 'x'
      remove.addEventListener('click', () => this._removePendingAttachment(composer, attachment.id))
      thumb.appendChild(img)
      thumb.appendChild(remove)
      if (attachment.uploading || attachment.error) {
        const status = document.createElement('div')
        status.className = 'attach-thumb-status'
        status.textContent = attachment.uploading ? 'Uploading...' : 'Upload failed'
        thumb.appendChild(status)
      }
      list.appendChild(thumb)
    })
    preview.style.display = 'block'
  }

  _toImageSrc(imageUrl) {
    if (!imageUrl) return ''
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl
    if (imageUrl.endsWith('.webp')) return `${config.IMAGE_HOST}/${imageUrl}`
    return `${config.IMAGE_HOST}/${imageUrl}.webp`
  }

  _onPasteImages(e) {
    if (!this._isOnTextChannelRoute()) return
    const items = Array.from(e.clipboardData?.items || [])
    const files = items
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean)
    if (!files.length) return
    e.preventDefault()
    e.stopPropagation()
    this._queueComposerFiles(this._activeComposer === 'thread' ? 'thread' : 'main', files)
  }

  _hasDraggedImages(dataTransfer) {
    if (!dataTransfer) return false
    const types = Array.from(dataTransfer.types || [])
    if (types.includes('Files')) return true
    return Array.from(dataTransfer.items || []).some((item) => item.kind === 'file' && item.type.startsWith('image/'))
  }

  _onDragOver(e) {
    if (!this._hasDraggedImages(e.dataTransfer)) return
    e.preventDefault()
    this.setAttribute('drag-over', '')
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  _onDragLeave() {
    this.removeAttribute('drag-over')
  }

  _onDropImages(e) {
    if (!this._isOnTextChannelRoute()) return
    if (!this._hasDraggedImages(e.dataTransfer)) return
    e.preventDefault()
    this.removeAttribute('drag-over')
    const files = Array.from(e.dataTransfer?.files || []).filter((file) => file?.type?.startsWith?.('image/'))
    if (!files.length) return
    this._queueComposerFiles(this._activeComposer === 'thread' ? 'thread' : 'main', files)
  }

  _isOnTextChannelRoute() {
    return /^\/@[\w-]+:[^/]+$/.test(window.location.pathname || '')
  }

  _onMessageImageOpen(e) {
    const imageUrls = Array.isArray(e.detail?.imageURLs) ? e.detail.imageURLs : []
    if (!imageUrls.length) return
    this._openImageViewer(imageUrls, e.detail?.index || 0)
  }

  async _openImageViewer(imageUrls, index = 0) {
    const modal = await window.sociModals?.open?.('imageViewer')
    if (!modal) return
    const viewer = modal.querySelector('soci-image-viewer-modal')
    if (!viewer) return
    viewer.setImages?.(imageUrls, index)
  }

  _resolveThreadParent(messageID, parent) {
    const fromMain = this._mainMessagesByID.get(messageID) || this._mainMessagesByID.get(parent?.id)
    if (!fromMain) return this._normalizeMessage(parent)
    return this._normalizeMessage({ ...parent, ...fromMain })
  }

  _startChannelMessagesSocket() {
    this._stopChannelMessagesSocket()
    if (!this.authToken || !this.community || !this.channel) return

    const community = this.community
    const channel = this.channel
    const socket = new WebSocket(window.api.channelMessages.wsUrl(community, channel, this.authToken))
    this._channelSocket = socket
    this._channelSocketCommunity = community
    this._channelSocketChannel = channel

    socket.addEventListener('open', () => {
      if (this._channelSocket !== socket) return
      this._channelSocketReconnectAttempt = 0
    })

    socket.addEventListener('message', (event) => {
      if (this._channelSocket !== socket) return
      this._handleChannelSocketMessage(event.data, community, channel)
    })

    socket.addEventListener('close', () => {
      if (this._channelSocket !== socket) return
      this._channelSocket = null
      this._channelSocketCommunity = null
      this._channelSocketChannel = null
      this._scheduleChannelSocketReconnect(community, channel)
    })

    socket.addEventListener('error', () => {
      try {
        socket.close()
      } catch (_) {}
    })
  }

  _stopChannelMessagesSocket() {
    if (this._channelSocketReconnectTimer) clearTimeout(this._channelSocketReconnectTimer)
    this._channelSocketReconnectTimer = null
    this._channelSocketReconnectAttempt = 0
    this._channelSocketCommunity = null
    this._channelSocketChannel = null
    const socket = this._channelSocket
    this._channelSocket = null
    if (!socket) return
    try {
      socket.close()
    } catch (_) {}
  }

  _scheduleChannelSocketReconnect(community, channel) {
    if (this._channelSocketReconnectTimer) clearTimeout(this._channelSocketReconnectTimer)
    if (!this.authToken || this.community !== community || this.channel !== channel) return

    const attempt = Math.min(this._channelSocketReconnectAttempt + 1, 6)
    this._channelSocketReconnectAttempt = attempt
    const delay = Math.min(1000 * (2 ** (attempt - 1)), 30000)
    this._channelSocketReconnectTimer = setTimeout(() => {
      this._channelSocketReconnectTimer = null
      if (!this.authToken || this.community !== community || this.channel !== channel) return
      this._startChannelMessagesSocket()
    }, delay)
  }

  _handleChannelSocketMessage(rawData, expectedCommunity, expectedChannel) {
    try {
      const msg = JSON.parse(rawData)
      if (msg?.community !== expectedCommunity || msg?.channel !== expectedChannel) return
      if (this.community !== expectedCommunity || this.channel !== expectedChannel) return

      if (msg?.type === 'channel.message.created') {
        const created = this._normalizeMessage(msg.message)
        if (!created?.id) return
        if (this._consumeLocallySentMessage(created.id)) return
        if (this._mainMessagesByID.has(created.id) || this._threadMessagesByID.has(created.id)) return

        if (created.parentID) {
          this._incrementMainReplyCount(created.parentID)
          this._bumpMainReplyUsers(created.parentID, created.user || '')
          if (this._threadParent?.id === created.parentID) {
            const threadScroll = this.select('#thread-scroll')
            const shouldScroll = this._isScrollNearBottom(threadScroll)
            this._appendThreadMessage(created)
            if (shouldScroll) this._scrollToBottom(threadScroll)
          }
          return
        }

        const mainScroll = this.select('#main-scroll')
        const shouldScroll = this._isScrollNearBottom(mainScroll)
        this._appendMainMessage(created)
        if (shouldScroll) this._scrollToBottom(mainScroll)
        return
      }

      if (msg?.type === 'channel.message.reaction') {
        const messageID = Number.parseInt(String(msg.messageID || ''), 10)
        const count = Number.parseInt(String(msg.count || 0), 10)
        const emoji = typeof msg.emoji === 'string' ? msg.emoji : ''
        if (!Number.isFinite(messageID) || messageID <= 0 || !emoji) return
        this._setReactionCountForMessage(messageID, emoji, Math.max(0, count))
      }
    } catch (err) {
      console.warn('Channel message ws parse failed:', err)
    }
  }

  _markLocallySentMessage(messageID) {
    const key = this._localMessageKey(messageID)
    if (!key) return
    this._locallySentMessageIDs.add(key)
    const existingTimer = this._localSendMarkerTimers.get(key)
    if (existingTimer) clearTimeout(existingTimer)
    const timer = setTimeout(() => {
      this._locallySentMessageIDs.delete(key)
      this._localSendMarkerTimers.delete(key)
    }, 30000)
    this._localSendMarkerTimers.set(key, timer)
  }

  _consumeLocallySentMessage(messageID) {
    const key = this._localMessageKey(messageID)
    if (!key || !this._locallySentMessageIDs.has(key)) return false
    this._locallySentMessageIDs.delete(key)
    const timer = this._localSendMarkerTimers.get(key)
    if (timer) clearTimeout(timer)
    this._localSendMarkerTimers.delete(key)
    return true
  }

  _localMessageKey(messageID) {
    const normalized = this._normalizeMessageID(messageID)
    if (!normalized) return ''
    return String(normalized)
  }

  _clearLocalSendMarkers() {
    this._localSendMarkerTimers.forEach((timer) => clearTimeout(timer))
    this._localSendMarkerTimers.clear()
    this._locallySentMessageIDs.clear()
  }

  _syncRenderedMessageRow(message) {
    if (!message?.id) return
    const rows = Array.from(this.querySelectorAll(`soci-message-row[data-message-id="${message.id}"]`))
    if (!rows.length) return
    rows.slice(1).forEach((row) => row.remove())
    const row = rows[0]
    row.setAttribute('user', message.user || '')
    row.setAttribute('time', String(this._resolveMessageDate(message)))
    row.setAttribute('reply-count', String(message.replyCount || 0))
    if (message.parentID) row.setAttribute('parent-id', String(message.parentID))
    else row.removeAttribute('parent-id')
    if (message.imageUrl) row.setAttribute('image-url', message.imageUrl)
    else row.removeAttribute('image-url')
    if (Array.isArray(message.imageUrls) && message.imageUrls.length) {
      row.setAttribute('image-urls', JSON.stringify(message.imageUrls))
    } else {
      row.removeAttribute('image-urls')
    }
    const md = row.querySelector('soci-markdown-view')
    if (md) {
      if (message.content) {
        md.style.display = ''
        md.render(message.content).catch(() => {})
      } else {
        md.style.display = 'none'
      }
    }
    this._replaceRenderedReactions(message.id)
  }

  _setReactionCountForMessage(messageID, emoji, count) {
    const apply = (msg) => {
      if (!msg) return
      const reactions = Array.isArray(msg.reactions) ? [...msg.reactions] : []
      const idx = reactions.findIndex((entry) => entry.emoji === emoji)
      if (count <= 0) {
        if (idx >= 0) reactions.splice(idx, 1)
        msg.reactions = reactions
        return
      }
      if (idx >= 0) {
        reactions[idx] = { ...reactions[idx], count }
      } else {
        reactions.push({ emoji, count, reacted: false })
      }
      msg.reactions = reactions
    }

    const mainMsg = this._mainMessagesByID.get(messageID)
    apply(mainMsg)
    if (mainMsg) this._mainMessagesByID.set(messageID, mainMsg)

    const threadMsg = this._threadMessagesByID.get(messageID)
    apply(threadMsg)
    if (threadMsg) this._threadMessagesByID.set(messageID, threadMsg)

    if (mainMsg || threadMsg) this._replaceRenderedReactions(messageID)
  }

  _isScrollNearBottom(scrollEl) {
    if (!scrollEl) return false
    const remaining = scrollEl.scrollHeight - scrollEl.clientHeight - scrollEl.scrollTop
    return remaining <= 80
  }

  _sortMessagesByDateAsc(messages) {
    if (!Array.isArray(messages) || !messages.length) return []
    return [...messages].sort((a, b) => {
      const dateDelta = this._messageDateValue(a) - this._messageDateValue(b)
      if (dateDelta !== 0) return dateDelta
      const aID = this._messageIDValue(a)
      const bID = this._messageIDValue(b)
      if (aID < bID) return -1
      if (aID > bID) return 1
      return 0
    })
  }

  _messageDateValue(msg) {
    return this._resolveMessageDate(msg)
  }

  _messageIDValue(msg) {
    const value = msg?.id
    const numeric = Number.parseInt(String(value || ''), 10)
    if (Number.isFinite(numeric)) return numeric
    return String(value || '')
  }
}
