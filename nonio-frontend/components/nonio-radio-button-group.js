import NonioComponent from './nonio-component.js'

export default class NonioRadioButtonGroup extends NonioComponent {
  constructor() {
    super()
  }

  css() {
    return `
      :host {
        display: inline-flex;
        align-items: center;
      }

      #group {
        display: inline-flex;
        align-items: center;
      }
    `
  }

  html() {
    return `
      <div id="group" role="radiogroup">
        <slot></slot>
      </div>
    `
  }

  static get observedAttributes() {
    return ['value']
  }

  connectedCallback() {
    this._onSelect = this._onSelect.bind(this)
    this._onSlotChange = this._onSlotChange.bind(this)
    this.addEventListener('nonio-radio-select', this._onSelect)
    this.select('slot')?.addEventListener('slotchange', this._onSlotChange)

    const initial = this.value || this._defaultValue()
    if (initial) this._applySelection(initial)
  }

  disconnectedCallback() {
    this.removeEventListener('nonio-radio-select', this._onSelect)
    this.select('slot')?.removeEventListener('slotchange', this._onSlotChange)
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'value' && newValue !== oldValue) this._applySelection(newValue)
  }

  _onSelect(e) {
    const value = e.detail?.value
    if (!value || value === this.value) return
    this.value = value
    this.fire('change', { value })
  }

  _onSlotChange() {
    this._applySelection(this.value || this._defaultValue())
  }

  _applySelection(value) {
    if (!value) return
    this._buttons.forEach(button => {
      button.toggleAttribute('selected', button.value === value)
    })
  }

  _defaultValue() {
    return this._buttons.find(btn => btn.hasAttribute('selected'))?.value ||
      this._buttons[0]?.value || ''
  }

  get _buttons() {
    return Array.from(this.querySelectorAll('nonio-radio-button'))
  }

  get value() {
    return this.getAttribute('value')
  }

  set value(val) {
    if (!val) {
      this.removeAttribute('value')
      return
    }
    this.setAttribute('value', val)
  }
}

