import SociComponent from './soci-component.js'

export default class SociTextChannelLi extends SociComponent {
  constructor() {
    super()
  }

  css(){
    return `
      :host {
        line-height: 32px;
        position: relative;
        display: block;
        overflow: hidden;
        border-radius: 4px;
      }

      :host([active]) .channel-row {
        color: var(--text-brand-bold);
        font-weight: 600;
        background: var(--bg-brand-secondary);
      }

      :host([active]) .channel-row:hover {
        background: var(--bg-brand-secondary-hover);
      }

      :host(:hover) {
        box-shadow: 0 0 0 1px inset var(--bg-secondary);
      }

      :host([active]:hover) {
        box-shadow: none;
      }

      .channel-row {
        display: block;
        padding-left: 42px;
        padding-right: 8px;
        height: 32px;
        line-height: 30px;
        text-decoration: none;
        color: var(--text);
        position: relative;
        cursor: pointer;
        box-sizing: border-box;
        border: none;
        width: 100%;
        text-align: left;
        font: inherit;
        background: transparent;
      }

      .channel-row:hover {
        background: var(--bg-hover);
      }

      .icon-wrapper {
        position: absolute;
        left: 12px;
        top: 8px;
        width: 16px;
        height: 16px;
      }

      .icon-wrapper soci-icon {
        width: 16px;
        height: 16px;
        display: block;
      }
    `
  }

  html(){
    return `
      <button type="button" class="channel-row" id="channel-row">
        <span class="icon-wrapper"><soci-icon glyph="comments" size="16"></soci-icon></span>
        <span id="channel-label"></span>
      </button>
    `
  }

  static get observedAttributes() {
    return ['channel', 'name']
  }

  attributeChangedCallback(name, oldValue, newValue){
    if (name === 'channel' || name === 'name') {
      const label = this.select('#channel-label')
      if (label) label.textContent = this.getAttribute('name') || this.getAttribute('channel') || ''
    }
  }

  connectedCallback(){
    super.connectedCallback?.()
    const row = this.select('#channel-row')
    if (row) row.addEventListener('click', (e) => this._onClick(e))
    const name = this.getAttribute('name')
    const channel = this.getAttribute('channel')
    const label = this.select('#channel-label')
    if (label) label.textContent = name || channel || ''
  }

  _onClick(e){
    e.preventDefault()
    const channel = this.getAttribute('channel')
    if (channel) this.fire('text-channel-open', { channel })
  }

  get channel() {
    return this.getAttribute('channel')
  }

  set channel(val) {
    this.setAttribute('channel', val)
  }
}
