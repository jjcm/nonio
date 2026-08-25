import NonioComponent from './nonio-component.js'

export default class NonioVoiceChannelLi extends NonioComponent {
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

      .icon-wrapper nonio-icon {
        width: 16px;
        height: 16px;
        display: block;
      }

      #participants {
        display: block;
        padding: 8px 8px 8px 42px;
        min-height: 0;
      }

      #participants ::slotted(nonio-user) {
        display: block;
        margin-bottom: 6px;
        --font-size: 14px;
        --font-weight: 500;
        --avatar-size: 24px;
        --line-height: 24px;
        --spacing: 8px;
        color: var(--text-secondary);
      }

      #participants ::slotted(nonio-user:last-child) {
        margin-bottom: 0;
      }

      :host(:not([active]):not([has-participants])) #participants {
        display: none;
      }
    `
  }

  html(){
    return `
      <button type="button" class="channel-row" id="channel-row">
        <span class="icon-wrapper"><nonio-icon glyph="volume" size="16"></nonio-icon></span>
        <span id="channel-label"></span>
      </button>
      <div id="participants">
        <slot></slot>
      </div>
    `
  }

  static get observedAttributes() {
    return ['channel']
  }

  attributeChangedCallback(name, oldValue, newValue){
    if (name === 'channel' && newValue) {
      const label = this.select('#channel-label')
      if (label) label.textContent = this._channelLabel(newValue)
    }
  }

  _channelLabel(channel) {
    if (!channel) return ''
    const n = channel.replace(/^voice-/, '')
    return 'Voice ' + (n ? n.charAt(0).toUpperCase() + n.slice(1) : channel)
  }

  connectedCallback(){
    super.connectedCallback?.()
    const row = this.select('#channel-row')
    if (row) row.addEventListener('click', (e) => this._onClick(e))
  }

  _onClick(e){
    e.preventDefault()
    const channel = this.getAttribute('channel')
    if (channel) this.fire('voice-join', { channel })
  }

  get channel() {
    return this.getAttribute('channel')
  }

  set channel(val) {
    this.setAttribute('channel', val)
  }
}
