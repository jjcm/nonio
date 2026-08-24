import { getActiveTokenQuery, scanRichTextTokens } from '../lib/soci-rich-text.js'

export default class SociInput extends HTMLElement {
  static get formAssociated() {
    return true
  }

  constructor() {
    super()
    this._internals = this.attachInternals()
    this._onInput = this._onInput.bind(this)
    this._onKeyDown = this._onKeyDown.bind(this)
    this._onSuggestionMouseMove = this._onSuggestionMouseMove.bind(this)
    this._onSuggestionClick = this._onSuggestionClick.bind(this)
    this._onDocumentClick = this._onDocumentClick.bind(this)
    this._mentionResults = []
    this._emojiNames = []
    this._activeSuggestions = []
    this._activeSuggestionIndex = 0
    this._activeQuery = null
  }

  connectedCallback(){
    const placeholder = this.getAttribute('placeholder') || 'Enter comment'
    const readOnly = this.hasAttribute('readonly')

    this.innerHTML = `
      <style>
        soci-input {
          --min-height: 0px;
          --padding: 8px 12px;
          min-height: var(--min-height);
          position: relative;
          display: flex;
          flex-direction: column;
          transition: padding 0.1s ease-out, border-color 0.5s ease;
          padding-bottom: 0px;
          box-sizing: border-box;
        }

        @media (max-width: 768px) {
          soci-input {
            font-size: 16px;
          }
        }

        soci-input[subtle]{
          --padding: 0px;
          border-color: transparent !important;
        }

        .md-input {
          box-sizing: border-box;
          width: 100%;
          min-height: var(--min-height);
          transition: min-height 0.1s ease-out, padding 0.1s var(--soci-ease);
          padding: var(--padding);
          font: inherit;
          line-height: 1.42;
          color: var(--text);
          background: transparent;
          border: none;
          outline: none;
          overflow-y: auto;
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-wrap: anywhere;
        }

        .md-input[contenteditable="false"] {
          opacity: 0.7;
          cursor: default;
        }

        .md-input:empty::before {
          content: attr(data-placeholder);
          color: var(--text-secondary);
          opacity: 0.8;
          pointer-events: none;
        }

        .token {
          display: inline-flex;
          align-items: center;
          border-radius: 4px;
          vertical-align: text-bottom;
        }

        .mention-token {
          color: var(--text-brand);
          background: var(--bg-brand-secondary);
          padding: 0 3px;
          margin: -2px 0;
        }

        .emoji-token {
          line-height: 0;
          padding: 0;
        }

        .emoji-token soci-emoji {
          height: 20px;
        }

        #token-search {
          display: none;
          position: absolute;
          left: 8px;
          right: 8px;
          bottom: calc(100% + 6px);
          border: 1px solid var(--bg-secondary);
          border-radius: 6px;
          list-style: none;
          padding: 4px 0;
          margin: 0;
          z-index: 12;
          background: var(--bg);
          box-shadow: 1px 0 8px var(--shadow-light);
          max-height: 220px;
          overflow: auto;
        }

        #token-search[active] {
          display: block;
        }

        #token-search li {
          cursor: pointer;
          padding: 4px 10px;
          user-select: none;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        #token-search li[selected] {
          background: var(--bg-brand-secondary);
        }

        #token-search soci-emoji {
          height: 18px;
          flex-shrink: 0;
        }
      </style>

      <ul id="token-search"></ul>
      <div
        class="md-input"
        data-placeholder="${this._escapeHtml(placeholder)}"
        contenteditable="${readOnly ? 'false' : 'true'}"
        spellcheck="true"
      ></div>
    `

    this._editor = this.querySelector('.md-input')
    this._tokenSearch = this.querySelector('#token-search')
    this._readOnly = readOnly

    if (!readOnly) {
      this._editor.addEventListener('input', this._onInput)
      this._editor.addEventListener('keydown', this._onKeyDown)
      this._editor.addEventListener('click', () => this._updateSuggestions())
      this._tokenSearch.addEventListener('mousemove', this._onSuggestionMouseMove)
      this._tokenSearch.addEventListener('click', this._onSuggestionClick)
      document.addEventListener('click', this._onDocumentClick)
      this._loadEmojiNames()
    }

    if (this._value != null) this.value = this._value
    else this._renderFromPlainText('')
  }

  disconnectedCallback() {
    document.removeEventListener('click', this._onDocumentClick)
  }

  checkValidity() {
    return this._internals.checkValidity()
  }

  _escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
  }

  get value(){
    return this._value ?? ''
  }

  focus() {
    this._editor?.focus()
    this._setCaretOffset(this.value.length)
  }

  setSelection(val) {
    if (!this._editor) return
    let offset = this.value.length
    if (Array.isArray(val)) {
      offset = Number.isFinite(val[1]) ? val[1] : (val[0] || 0)
    } else if (val && typeof val === 'object') {
      offset = Number.isFinite(val.end) ? val.end : (val.start || 0)
    } else if (Number.isFinite(val)) {
      offset = val
    }
    this._setCaretOffset(offset)
  }

  setText(val) {
    this.value = val
  }

  insertText(val) {
    if (val == null) return
    this._insertTextAtCaret(String(val))
  }

  set value(val){
    if (val == null) return
    const v = String(val)
    this._value = v
    if (this._editor) this._renderFromPlainText(v)
    this._internals.setFormValue(v)
  }

  clear(){
    this.value = ''
  }

  _onInput() {
    const state = this._captureEditorState()
    this._value = state.plain
    const parts = scanRichTextTokens(this._value)
    if (parts.some((p) => p.type !== 'text')) {
      this._renderFromPlainText(this._value, state.caret)
    }
    this._internals.setFormValue(this._value)
    this._updateSuggestions()
    this.dispatchEvent(new CustomEvent('input', { bubbles: true, composed: true }))
  }

  _onKeyDown(e) {
    if (this._isSearchOpen()) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        this._moveSuggestionSelection(e.key === 'ArrowDown' ? 1 : -1)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        this._applyActiveSuggestion()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        this._closeSuggestions()
        return
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      document.execCommand('insertLineBreak', false)
      return
    }
  }

  _onSuggestionMouseMove(e) {
    const item = e.target.closest('li[data-index]')
    if (!item) return
    this._setSuggestionSelection(Number.parseInt(item.dataset.index || '0', 10) || 0)
  }

  _onSuggestionClick(e) {
    const item = e.target.closest('li[data-index]')
    if (!item) return
    this._setSuggestionSelection(Number.parseInt(item.dataset.index || '0', 10) || 0)
    this._applyActiveSuggestion()
  }

  _onDocumentClick(e) {
    if (this.contains(e.target)) return
    this._closeSuggestions()
  }

  _renderFromPlainText(text, caretOffset) {
    if (!this._editor) return
    const plain = typeof text === 'string' ? text : String(text || '')
    const parts = scanRichTextTokens(plain)
    const doc = this.ownerDocument
    const frag = doc.createDocumentFragment()

    parts.forEach((part) => {
      if (part.type === 'text') {
        frag.appendChild(doc.createTextNode(part.text))
        return
      }
      if (part.type === 'mention') {
        const span = doc.createElement('span')
        span.className = 'token mention-token'
        span.textContent = part.text
        span.setAttribute('data-token-text', part.text)
        span.setAttribute('contenteditable', 'false')
        frag.appendChild(span)
        return
      }
      const span = doc.createElement('span')
      span.className = 'token emoji-token'
      span.setAttribute('data-token-text', part.text)
      span.setAttribute('data-emoji-name', part.name)
      span.setAttribute('contenteditable', 'false')
      const emoji = doc.createElement('soci-emoji')
      emoji.setAttribute('name', part.name)
      span.appendChild(emoji)
      frag.appendChild(span)
    })

    this._editor.innerHTML = ''
    this._editor.appendChild(frag)
    if (!this._readOnly) this._setCaretOffset(Number.isFinite(caretOffset) ? caretOffset : plain.length)
  }

  _serializeNode(node) {
    if (!node) return ''
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || ''
    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const el = node
    if (el.hasAttribute && el.hasAttribute('data-token-text')) return el.getAttribute('data-token-text') || ''
    if (el.tagName === 'BR') return '\n'

    let out = ''
    for (const child of el.childNodes) out += this._serializeNode(child)
    return out
  }

  _captureEditorState() {
    const editor = this._editor
    if (!editor) return { plain: this._value || '', caret: (this._value || '').length }
    const selection = window.getSelection()
    const plain = this._serializeNode(editor).replace(/\u00A0/g, ' ')
    let caret = plain.length
    if (
      selection &&
      selection.rangeCount &&
      editor.contains(selection.anchorNode) &&
      editor.contains(selection.focusNode)
    ) {
      const range = selection.getRangeAt(0)
      const pre = range.cloneRange()
      pre.selectNodeContents(editor)
      pre.setEnd(range.endContainer, range.endOffset)
      caret = this._nodePlainTextLength(pre.cloneContents())
    }
    caret = Math.max(0, Math.min(caret, plain.length))
    return { plain, caret }
  }

  _nodePlainTextLength(node) {
    let offset = 0
    const walk = (current) => {
      if (!current) return
      if (current.nodeType === Node.TEXT_NODE) {
        offset += (current.nodeValue || '').length
        return
      }
      if (current.nodeType !== Node.ELEMENT_NODE && current.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return
      if (current.nodeType === Node.ELEMENT_NODE) {
        const el = current
        if (el.hasAttribute('data-token-text')) {
          offset += (el.getAttribute('data-token-text') || '').length
          return
        }
        if (el.tagName === 'BR') {
          offset += 1
          return
        }
      }
      for (const child of current.childNodes) {
        walk(child)
      }
    }
    walk(node)
    return offset
  }

  _getCaretOffsetFromMarker(marker) {
    let offset = 0
    const walk = (node) => {
      if (!node || node === marker) return true
      if (node.nodeType === Node.TEXT_NODE) {
        offset += (node.nodeValue || '').length
        return false
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return false
      const el = node
      if (el.hasAttribute('data-token-text')) {
        offset += (el.getAttribute('data-token-text') || '').length
        return false
      }
      if (el.tagName === 'BR') {
        offset += 1
        return false
      }
      for (const child of el.childNodes) {
        if (walk(child)) return true
      }
      return false
    }
    walk(this._editor)
    return offset
  }

  _setCaretOffset(offset) {
    if (!this._editor) return
    const target = Math.max(0, Math.min(Number(offset) || 0, this.value.length))
    const range = document.createRange()
    const selection = window.getSelection()
    let cursor = 0
    let placed = false

    for (const node of this._editor.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const len = (node.nodeValue || '').length
        if (target <= cursor + len) {
          range.setStart(node, target - cursor)
          range.collapse(true)
          placed = true
          break
        }
        cursor += len
        continue
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tokenText = node.getAttribute?.('data-token-text')
        if (tokenText != null) {
          const len = tokenText.length
          if (target <= cursor + len) {
            if (target === cursor) range.setStartBefore(node)
            else range.setStartAfter(node)
            range.collapse(true)
            placed = true
            break
          }
          cursor += len
          continue
        }
      }
    }

    if (!placed) {
      range.selectNodeContents(this._editor)
      range.collapse(false)
    }
    selection.removeAllRanges()
    selection.addRange(range)
  }

  _insertTextAtCaret(insertText) {
    const state = this._captureEditorState()
    const start = state.caret
    const next = state.plain.slice(0, start) + insertText + state.plain.slice(start)
    const nextCaret = start + insertText.length
    this._value = next
    this._renderFromPlainText(next, nextCaret)
    this._internals.setFormValue(next)
    this._updateSuggestions()
    this.dispatchEvent(new CustomEvent('input', { bubbles: true, composed: true }))
  }

  async _loadEmojiNames() {
    const community = window.soci?.routeContext?.community || ''
    const sets = await window.api?.emoji?.sets?.(community).catch(() => null)
    if (!sets) return
    const custom = []
      .concat(sets.community || [])
      .concat(sets.personal || [])
      .concat(sets.subscribed || [])
      .map((item) => item?.name)
      .filter((name) => typeof name === 'string' && name.length >= 2)
    this._emojiNames = [...new Set(custom)]
  }

  async _updateSuggestions() {
    if (!this._editor || this._readOnly) return
    const state = this._captureEditorState()
    const active = getActiveTokenQuery(state.plain, state.caret)
    this._activeQuery = active
    if (!active) {
      this._closeSuggestions()
      return
    }

    if (active.type === 'mention') {
      const query = active.query || ''
      if (query.length < 1) {
        this._closeSuggestions()
        return
      }
      const res = await window.api?.getData?.(`users/search?q=${encodeURIComponent(query)}`).catch(() => null)
      const current = this._activeQuery
      if (!current || current.type !== 'mention' || current.query !== query) return
      const users = Array.isArray(res?.users) ? res.users : []
      this._mentionResults = users
        .map((item) => (typeof item === 'string' ? item : item?.username))
        .filter((name) => typeof name === 'string' && name.toLowerCase().startsWith(query.toLowerCase()))
        .slice(0, 8)
      this._renderSuggestions('mention', this._mentionResults)
      return
    }

    if (!this._emojiNames.length) await this._loadEmojiNames()
    const query = (active.query || '').toLowerCase()
    if (query.length < 2) {
      this._closeSuggestions()
      return
    }
    const list = this._emojiNames
      .filter((name) => name.startsWith(query))
      .slice(0, 8)
    this._renderSuggestions('emoji', list)
  }

  _renderSuggestions(type, values) {
    if (!this._tokenSearch) return
    if (!values?.length) {
      this._closeSuggestions()
      return
    }
    this._activeSuggestions = values.map((value) => ({ type, value }))
    this._activeSuggestionIndex = 0
    this._tokenSearch.innerHTML = this._activeSuggestions.map((item, idx) => {
      if (item.type === 'emoji') {
        return `
          <li data-index="${idx}" ${idx === 0 ? 'selected' : ''}>
            <soci-emoji name="${item.value}"></soci-emoji>
            <span>:${item.value}:</span>
          </li>
        `
      }
      return `<li data-index="${idx}" ${idx === 0 ? 'selected' : ''}><span>@${item.value}</span></li>`
    }).join('')
    this._tokenSearch.toggleAttribute('active', true)
  }

  _isSearchOpen() {
    return !!this._tokenSearch?.hasAttribute('active')
  }

  _closeSuggestions() {
    this._activeSuggestions = []
    this._activeSuggestionIndex = 0
    this._tokenSearch?.removeAttribute('active')
    if (this._tokenSearch) this._tokenSearch.innerHTML = ''
  }

  _setSuggestionSelection(index) {
    if (!this._activeSuggestions.length) return
    const max = this._activeSuggestions.length - 1
    this._activeSuggestionIndex = Math.max(0, Math.min(index, max))
    this._tokenSearch?.querySelectorAll('li[data-index]').forEach((li) => {
      li.toggleAttribute('selected', Number.parseInt(li.dataset.index || '-1', 10) === this._activeSuggestionIndex)
    })
  }

  _moveSuggestionSelection(direction) {
    if (!this._activeSuggestions.length) return
    const max = this._activeSuggestions.length - 1
    let next = this._activeSuggestionIndex + direction
    if (next < 0) next = max
    if (next > max) next = 0
    this._setSuggestionSelection(next)
  }

  _applyActiveSuggestion() {
    const suggestion = this._activeSuggestions[this._activeSuggestionIndex]
    if (!suggestion || !this._activeQuery) return
    const state = this._captureEditorState()
    const tokenText = suggestion.type === 'emoji' ? `:${suggestion.value}:` : `@${suggestion.value}`
    const next = state.plain.slice(0, this._activeQuery.start) + tokenText + state.plain.slice(this._activeQuery.end)
    const caret = this._activeQuery.start + tokenText.length
    this._value = next
    this._renderFromPlainText(next, caret)
    this._internals.setFormValue(next)
    this._closeSuggestions()
    this.dispatchEvent(new CustomEvent('input', { bubbles: true, composed: true }))
    this._editor.focus()
  }
}