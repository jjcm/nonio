import NonioComponent from './nonio-component.js'

export default class NonioPassword extends NonioComponent {

  static get formAssociated() {
    return true
  }

  constructor() {
    super()
    this._internals = this.attachInternals()
  }

  css() { return `
    :host {
      --entropy-percent: 0;
      position: relative;
      display: block;
    }

    svg {
      display: none;
      fill: none;
      stroke: var(--bg-secondary);
      stroke-width: 2px;
      stroke-dasharray: 69.1px;
      stroke-dashoffset: calc(69.1px * (1 - var(--entropy-percent)));
      transition: stroke-dashoffset 0.3s ease;
      height: 24px;
      width: 24px;
      position: absolute;
      top: 4px;
      right: 0px;
    }

    :host(:focus) {
      outline: none;
    }

    :host(:focus):after{
      content: '';
      width: 10px;
      height: 10px;
      display: block;
      background: red;
    }

    :host(:focus-within) svg {
      display: block;
    }

    path { 
      display: none;
    }

    :host([valid]) svg {
      transition: none;
      stroke: var(--text-success-secondary);
    }

    :host([valid]) path {
      display: block;
    }

    :host([valid]) ::slotted(input:focus) {
      border-bottom: 2px solid var(--text-success-secondary) !important;
    }
  `}

  html() { return `
    <svg>
      <circle cx="12" cy="12" r="11"></circle>
      <path d="M17.33 8.66998L11 15L7.5 11.5" stroke="#29E08E" stroke-width="2"/>
    </svg>
    <slot></slot>
  `}

  connectedCallback() {
    this._internals.setValidity({customError: true}, 'Not strong enough. Add complexity until the circle fills.')
    this.innerHTML = ''
    this.field = document.createElement('input')
    this.field.setAttribute('type','password')
    this.field.setAttribute('placeholder', this.getAttribute('placeholder') || 'Password')
    this.field.setAttribute('autocomplete', 'current-password')
    this.field.setAttribute('name', this.getAttribute('name') || 'password')
    this.field.addEventListener('keydown', this._onKeyDown.bind(this))
    this.field.addEventListener('keyup', this._onKeyDown.bind(this))
    this.field.addEventListener('focus', this._onFocus.bind(this))
    this.field.addEventListener('blur', this._onBlur.bind(this))
    this.addEventListener('focus', this._onFocus)
    this.addEventListener('blur', this._onBlur)
    this.appendChild(this.field)
    this.setAttribute('tabindex', 0)
    this._internals.setFormValue(this.value)
  }

  static get observedAttributes() {
    return ['placeholder']
  }

  attributeChangedCallback(name, oldValue, newValue){
    if(!this._initialRenderComplete) return

    switch(name){
      case 'placeholder':
        this.field?.setAttribute('placeholder', newValue)
        break
    }
  }

  get value() {
    return this.field.value
  }

  set value(val) {
    this.field.value = val
    this._internals.setFormValue(val)
  }

  _onFocus(e) {
    if(e.currentTarget == this) this.field.focus()
    this.setAttribute('tabindex', -1)
  }

  _onBlur(e) {
    this.setAttribute('tabindex', 0)
  }

  _onChange(e) {
    this._internals.setFormValue(this.value)
  }

  _onKeyDown() {
    setTimeout(()=>{
      this.checkValidity()
      this._internals.setFormValue(this.value)
    }, 1)
  }

  _updateValidity(message) {
    if(!message){
      this._internals.setValidity({})
    }
    else {
      this._internals.setValidity({customError: true}, message)
    }
  }

  checkMatch(){
    if(this.hasAttribute('match')){
      let matchedField = this.closest('form').querySelector(`nonio-password[name=${this.getAttribute('match')}]`)
      return matchedField.value == this.value
    }
    return true
  }

  checkEntropy(){
    const ENTROPY_REQUIREMENT = 40
    let value = this.value
    let charsets = {
      numbers: false,
      lowercase: false,
      uppercase: false,
      specials: false
    }

    for(var i = 0; i < value.length; i++){
      let char = value.charAt(i)
      charsets.numbers = charsets.numbers || char.match(/[0-9]/)
      charsets.lowercase = charsets.lowercase || char.match(/[a-z]/)
      charsets.uppercase = charsets.uppercase || char.match(/[A-Z]/)
      charsets.specials = charsets.specials || (!char.match(/[0-9]/) & !char.match(/[a-z]/) & !char.match(/[A-Z]/))
    }

    let entropyBase =
        (charsets.numbers ? 10 : 0)
      + (charsets.lowercase ? 26 : 0)
      + (charsets.uppercase ? 26 : 0)
      + (charsets.specials ? 50 : 0)
      
    let entropy = Math.log2(Math.pow(entropyBase, value.length))
    let entropyPercent = Math.min((entropy / ENTROPY_REQUIREMENT), 1)

    this.toggleAttribute('valid', entropyPercent == 1)
    this.style.setProperty('--entropy-percent', entropyPercent)
    return entropyPercent == 1
  }

  // required for form elements
  get form() { return this._internals.form }
  get name() { return this.getAttribute('name') }
  get type() { return this.localName }
  get validity() {return this._internals.validity }
  get validationMessage() {return this._internals.validationMessage }
  get willValidate() {return this._internals.willValidate }

  //checkValidity() { return this._internals.checkValidity() }
  reportValidity() {return this._internals.reportValidity() }
  checkValidity(){
    if(!this.checkEntropy()){
      this._updateValidity('Not strong enough. Add complexity until the circle fills.')
    }
    else if(!this.checkMatch()){
      this.closest('form')?.querySelector(`nonio-password[name="${this.getAttribute('match')}"]`)?._updateValidity("Passwords do not match.")
      this._updateValidity('Passwords do not match.')
    }
    else {
      this.closest('form')?.querySelector(`nonio-password[name="${this.getAttribute('match')}"]`)?._updateValidity()
      this._updateValidity()
    }
    return this._internals.checkValidity()
  }

}