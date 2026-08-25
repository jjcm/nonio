import NonioComponent from './nonio-component.js'

export default class NonioRadioButton extends NonioComponent {
  constructor() {
    super()
  }

  css() {
    return `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: relative;
        padding: 0 8px;
        text-transform: capitalize;
        cursor: pointer;
        font-weight: 500;
        font-size: 12px;
        line-height: 24px;
        color: var(--text-secondary);
        border-radius: 3px;
        user-select: none;
      }

      :host::before {
        position: absolute;
        content: '';
        left: 0;
        top: -10px;
        height: 40px;
        width: 100%;
        background: transparent;
      }

      :host(:hover) {
        color: var(--text-secondary-hover);
      }

      :host([selected]) {
        color: var(--text-brand-bold);
        background: var(--bg-secondary);
      }
    `
  }

  html() {
    return '<slot></slot>'
  }

  static get observedAttributes() {
    return ['selected']
  }

  connectedCallback() {
    this.setAttribute('role', 'radio')
    this.addEventListener('click', this._onClick)
    this.addEventListener('keydown', this._onKeyDown)
    this._syncSelection()
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._onClick)
    this.removeEventListener('keydown', this._onKeyDown)
  }

  attributeChangedCallback(name) {
    if (name === 'selected') this._syncSelection()
  }

  get value() {
    return this.getAttribute('value') || this.textContent.trim()
  }

  _syncSelection() {
    const selected = this.hasAttribute('selected')
    this.setAttribute('aria-checked', selected)
    this.setAttribute('tabindex', selected ? '0' : '-1')
  }

  _onClick = () => {
    this._notifySelect()
  }

  _onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      this._notifySelect()
    }
  }

  _notifySelect() {
    this.dispatchEvent(new CustomEvent('nonio-radio-select', {
      detail: { value: this.value },
      bubbles: true,
      composed: true
    }))
  }
}

