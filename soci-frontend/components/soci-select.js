import SociComponent from './soci-component.js'

export class SociSelect extends SociComponent {
  constructor() {
    super()
  }

  css(){ return `
    :host {
      --height: 30px;
      position: relative;
      display: block;
    }

    selected {
      display: block;
      cursor: pointer;
      height: var(--height);
      border-radius: inherit;
    }

    dropdown {
      display: none;
      position: absolute;
      min-width: 100px;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      cursor: pointer;
      background: var(--bg-secondary);
      border-radius: 4px;
      color: var(--text);
      overflow: hidden;
      padding: 4px 0;
      box-shadow: 0px 1px 1px var(--shadow), 0px 2px 10px color-mix(in srgb, var(--shadow) 40%, transparent);
      z-index: 1;
    }

    :host([open]) dropdown {
      display: block;
    }

    :host([dropdown-horizontal-position="right"]) dropdown {
      left: auto;
      right: 0;
    }

    :host([dropdown-vertical-position="top"]) dropdown {
      top: auto;
      bottom: calc(var(--height) + 4px);
    }
    @media (prefers-color-scheme: light) {
      dropdown {
        background: var(--bg);
      }
    }

  `}

  html(){ return `
    <selected @click=openDropdown>
      <slot name="selected"></slot>
    </selected>
    <dropdown @click=closeDropdown>
      <slot></slot>
    </dropdown>
  `}

  static get observedAttributes() {
    return ['default']
  }

  connectedCallback(){
    this._blurClose = this._blurClose.bind(this)
  }

  attributeChangedCallback(name, oldValue, newValue){
    let svg = this.select('svg')
    if(name == 'glyph') svg.innerHTML = icons[newValue]
  }

  get value() {
    let option = this.querySelector('soci-option[slot="selected"]')
    return option.getAttribute('value') || option.innerHTML
  }

  openDropdown() {
    if(this.hasAttribute('open')) return
    this.toggleAttribute('open', true)
    setTimeout(()=>{
      document.addEventListener('click', this._blurClose)
    }, 1)
  }

  closeDropdown() {
    this.removeAttribute('open')
  }

  _blurClose(e){
    this.closeDropdown()
    document.removeEventListener('click', this._blurClose)
  }
}

export class SociOption extends SociComponent {
  constructor() {
    super()
  }

  css(){ return `
    :host {
      --padding: 12px;
      --shadow: ;
      height: var(--height, 30px);
      line-height: var(--height, 30px);
      position: relative;
      user-select: none;
      cursor: pointer;
      color: var(--text);
      padding: 0 var(--padding);
      display: flex;
      align-items: center;
      box-sizing: border-box;
      font-weight: 500;
      font-size: 12px;
      text-transform: capitalize;
      gap: 8px;
      text-shadow: var(--shadow);
    }

    :host(:not([slot="selected"]):hover) {
      background: var(--bg-secondary-hover);
    }

    :host([slot="selected"])::after {
      content: '';
      margin-left: auto;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-top: 4px solid currentColor;
      flex-shrink: 0;
    }

    :host([slot="selected"])::before {
      content: '';
      position: absolute;
      inset: 0;
      background: currentColor;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.1s ease;
    }

    :host([slot="selected"]:hover)::before {
      opacity: 0.08;
      border-radius: inherit;
    }

    :host([slot="selected"]) ::slotted(img) {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      border-radius: inherit;
      object-fit: cover;
      z-index: -1;
    }

    ::slotted(img) {
      width: 18px;
      height: 18px;
      border-radius: 4px;
      object-fit: cover;
    }
    ::slotted(soci-user) {
      --padding: 0;
    }
    @media (prefers-color-scheme: light) {
      :host(:not([slot="selected"]):hover) {
        background: var(--bg-hover);
      }
    }
  `}

  html(){ return '<slot></slot>'}

  connectedCallback(){
    this.addEventListener('click', this.select)
  }

  select() {
    // Clicking the already-selected option should not re-select/navigate.
    // This prevents consumers (like the sidebar community selector) from
    // reacting to "open dropdown" clicks as if the selection changed.
    if(this.getAttribute('slot') == 'selected') return

    let options = Array.from(this.parentNode.children)
    options.forEach(option => {
      option.removeAttribute('slot')
    })

    this.setAttribute('slot', 'selected')
    this.fire('selected')
  }
}
