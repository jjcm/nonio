import config from '../config.js'

export default class SociEmoji extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --size: 20px;
          height: 8px;
          margin-right: 4px;
          width: var(--size);
          display: inline-block;
          position: relative;
        }

        img {
          position: absolute;
          inset: 0;
          width: var(--size);
          height: var(--size);
          object-fit: contain;
          top: calc(50% - var(--size) / 2);
        }
      </style>
      <img alt="">
    `
    this._img = this.shadowRoot.querySelector('img')
  }

  static get observedAttributes() {
    return ['name']
  }

  connectedCallback() {
    this._syncFromName()
  }

  attributeChangedCallback(name) {
    if (name === 'name') this._syncFromName()
  }

  _syncFromName() {
    const emojiName = (this.getAttribute('name') || '').trim()
    if (!emojiName) {
      this._img.removeAttribute('src')
      this._img.alt = ''
      return
    }
    this._img.src = `${config.AVATAR_HOST}/emoji/${encodeURIComponent(emojiName)}.webp`
    this._img.alt = `:${emojiName}:`
  }
}
