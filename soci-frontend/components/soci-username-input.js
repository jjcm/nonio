import SociComponent from './soci-component.js'
import config from '../config.js'

export default class SociUsernameInput extends SociComponent {
  static get formAssociated() {
    return true
  }

  constructor() {
    super()
    this._internals = this.attachInternals()
  }

  css() { return `
    :host {
      position: relative;
      display: block;
    }

    input:-webkit-autofill,
    input:-webkit-autofill:focus,
    input:-webkit-autofill:hover,
    input {
      color: var(--text);
      background: var(--bg);
      border: 0;
      border-bottom: 2px solid var(--bg-secondary);
      height: 38px;
      font-size: 14px;
      width: 100%;
      margin: 0 0 8px;
    }

    :host input:focus {
      outline: 0;
      border-bottom: 2px solid var(--bg-brand);
    }

    :host(:focus-within) soci-icon {
      display: block;
    }

    soci-icon {
      position: absolute;
      right: 0;
      top: 4px;
      display: none;
    }

    :host([available="false"]) input:focus {
      border-bottom: 2px solid var(--bg-danger);
    }

    :host([available="false"]) soci-icon {
      display: block;
      color: var(--bg-danger);
    }

    :host([available="true"]) input:focus {
      border-bottom: 2px solid var(--bg-success);
    }

    :host([available="true"]) soci-icon {
      color: var(--bg-success);
    }

    error {
      display: block;
      height: 0;
      transition: all 0.2s ease-out;
      line-height: 20px;
      font-size: 11px;
      color: var(--text-danger);
      position: relative;
      overflow: hidden;
    }

    :host([available="false"]) error {
      height: 40px;
    }
  `}

  html() { return `
    <input id="${Math.random()}" type="text" autocomplete="your mom" placeholder="Username" spellcheck="false"/>
    <soci-icon></soci-icon>
    <error></error>
  `}

  connectedCallback() {
    this._input = this.select('input')
    this._statusIcon = this.select('soci-icon')

    this._keyDownTimer = null
    this._error = null

    this._input.addEventListener('keydown', this._onKeyDown.bind(this))
    this._input.addEventListener('change', this._onChange.bind(this))
    this.addEventListener('focus', this._onFocus)
    this.addEventListener('blur', this._onBlur)

    this._internals.setValidity({customError: true}, 'Username is required, Captain Nemo.')
  }

  checkValidity() {
    return this._internals.checkValidity()
  }

  get value() {
    return this._input.value
  }

  set value(val) {
    console.log('set value', val)
    this._input.value = val
    this._internals.setFormValue(val)
  }

  _onFocus(e) {
    if(e.currentTarget == this) this._input.focus()
    this.setAttribute('tabindex', -1)
    console.log('focus')
  }

  _onBlur(e) {
    this.setAttribute('tabindex', 0)
  }

  _onChange(e) {
    console.log('onChange', e)
    this._internals.setFormValue(this.value)
    console.log('change', this.value)
  }

  _onKeyDown() {
    if (this._lastInputValue === this._input.value) return

    this._lastInputValue = this._input.value

    this.removeAttribute('available')
    this._statusIcon.glyph = ''
    clearTimeout(this._keyDownTimer)
    setTimeout(()=>{
      if(!this.value.match(/^[a-zA-Z0-9\-\._]*$/)){
        this._error = true
        this.setUsernameError('Invalid characters')
      }
      else if(this.value == '') {
        this._error = true
        this.setURLError("Username is kinda necessary")
      }
      else {
        this._error = false
        this._internals.setValidity({})
        //this.select('error').innerHTML = ''
        this._keyDownTimer = setTimeout(()=>{
          this._keyDownTimer = null
          this.checkUsername()
        }, 500)
      }
    },1)
  }

  setUsernameError(message) {
    this._statusIcon.glyph = 'error'
    this.setAttribute('available', false)
    this.select('error').innerHTML = message
    this._internals.setValidity({customError: true}, message)
  }

  setURLError(message) {
    this._statusIcon.glyph = 'error'
    this.setAttribute('available', false)
    this.select('error').innerHTML = message
    this._internals.setValidity({customError: true}, message)
  }

  async checkUsername(){
    this._statusIcon.glyph = 'spinner'

    console.log('checking username')
    let username = this._input.value
    let available = await fetch(`${config.API_HOST}/user/username-is-available/${username}`)
    if(this._keyDownTimer || this._error) return 0
    if(await available.json() === true){
      this._statusIcon.glyph = 'success'
      this.setAttribute('available', true)
    }
    else {
      let message = ''
      if(available.error){
        message = available.error
      }
      else {
        let messages = [
          'Choose a better one for your lovely meme account.',
          'Choose a better one to post your Bob Ross paintings.',
          'It was probably a bad one anyway.',
          'Maybe try "juggaloboi95" instead?',
          'Maybe try surrounding it in xXx____xXx?',
          'Maybe add a _420 at the end?',
        ]

        message = messages[Math.floor(Math.random() * messages.length)]
      }
      this.setUsernameError('Username is not available. ' + message)
    }
  }

  // required for form elements
  get form() { return this._internals.form }
  get name() { return this.getAttribute('name') }
  get type() { return this.localName }
  get validity() {return this._internals.validity }
  get validationMessage() {return this._internals.validationMessage }
  get willValidate() {return this._internals.willValidate }

  checkValidity() { return this._internals.checkValidity() }
  reportValidity() {return this._internals.reportValidity() }
}