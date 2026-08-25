import config from '../config.js'
import { decorateRichTextElement } from '../lib/nonio-rich-text.js'

export default class NonioMarkdownView extends HTMLElement {
  constructor() {
    super()
  }

  static get observedAttributes() {
    return ['markdown']
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // If someone sets attribute value directly, treat it as markdown content.
    // (Bindings that set via property `el.value = ...` will hit the setter below.)
    if (name === 'markdown') this.render(newValue)
  }

  async _getMarkdown() {
    if (window.markdown && window.markdown.ready) {
      return await window.markdown.ready
    }
    throw new Error('markdown-wasm not loaded')
  }

  async render(markdownText) {
    this._raw = markdownText ?? ''
    this.innerHTML = ''

    if (!this._raw) {
      this.style.display = 'none'
      return
    }
    this.style.display = ''

    try {
      let md = this._raw
      if (typeof md !== 'string') md = String(md)

      const markdown = await this._getMarkdown()
      const html = markdown.parse(md, {
        // Security: do not allow raw HTML blocks/spans.
        parseFlags: markdown.ParseFlags.DEFAULT | markdown.ParseFlags.NO_HTML,
        allowJSURIs: false,
      })
      this.innerHTML = html
      decorateRichTextElement(this, {
        avatarHost: config.AVATAR_HOST,
      })
    } catch (e) {
      nonio?.log?.('Error: Malformed markdown', e, 'error')
      this.innerHTML = "<error style='color: var(--text-danger);'>Error: Malformed content</error>"
    }
  }

  set value(val) {
    this.render(val)
  }

  get value() {
    return this._raw || ''
  }
}


