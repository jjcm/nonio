import NonioComponent from './nonio-component.js'
import config from '../config.js'

export default class NonioLinkInput extends NonioComponent {
  static get formAssociated() {
    return true
  }

  constructor() {
    super()
    this._internals = this.attachInternals()
  }

  css() { return `
    :host {
      display: flex;
      align-items: center;
      position: relative;
      height: 32px;
      min-width: 540px;
      line-height: 28px;
      border: 2px solid var(--bg-secondary);
      box-sizing: border-box;
      width: 100%;
      font-size: 14px;
      padding: 0 8px;
      border-radius: 8px;
      transition: none;
      &:focus { outline: 0; }
    }
    :host([available="true"]) {
      background: var(--bg-success);
      border: 2px solid var(--bg-success);
      color: var(--text-inverse);
      cursor: pointer;
      transition: all 0.1s ease-in-out, color 0s ease-in-out;
    }
    :host([available="false"]) {
      border: 2px solid var(--bg-danger);
      nonio-icon { color: var(--bg-danger); }
    }
    input {
      cursor: pointer;
      text-decoration: inherit;
      font-weight: bold;
      border: none;
      outline: none;
      padding: 0;
      font-size: 14px;
      width: 100%;
      background: transparent;
      color: inherit;
      &::placeholder { font-weight: normal; text-transform: none; opacity: 0.5; font-size: 14px; }
    }
    nonio-icon { pointer-events: none; position: absolute; right: 2px; }
    error { position: absolute; left: 2px; bottom: -20px; color: var(--text-danger); height: 20px; font-size: 12px; }
  `}

  html() { return `
    <input type="text" placeholder="post-url" spellcheck="false"/>
    <nonio-icon></nonio-icon>
    <error></error>
  `}

  connectedCallback() {
    this._input = this.select('input')
    this._statusIcon = this.select('nonio-icon')

    this._keyDownTimer = null
    this._error = null

    //this._input.addEventListener('keydown', this.checkUrlValidity.bind(this))
    //this._input.addEventListener('change', this._onChange.bind(this))
    this._input.addEventListener('input', this._onInput.bind(this))
    this.addEventListener('focus', this._onFocus.bind(this))

    this._internals.setValidity({customError: true}, 'Submissions require a url')
  }

  checkValidity() {
    return this._internals.checkValidity()
  }

  get value() {
    return this._input.value.trim()
  }

  set value(val) {
    this._input.value = val
    this._internals.setFormValue(val)
  }

  _onFocus(e) {
    this._input.focus()
  }

  _onInput(e) {
    this._internals.setFormValue(this.value)
    this.checkUrlValidity()
  }

  checkUrlValidity() {
    this.removeAttribute('available')
    this._statusIcon.glyph = ''
    clearTimeout(this._keyDownTimer)
    setTimeout(()=>{
      if(!this.testURL()){
        this._error = true
        this.setURLError('Invalid URL')
      }
      else if(this.value == '') {
        this._error = true
        this.setURLError("URL can't be empty")
      }
      else {
        this._error = false
        this._internals.setValidity({})
        this.select('error').innerHTML = ''
        this._keyDownTimer = setTimeout(()=>{
          this._keyDownTimer = null
          this.checkURL()
        }, 500)
      }
    },1)
  }

  testURL() {
    try {
      new URL(this.value)
      return true
    }
    catch(e) {
      return false
    }
  }

  setURLError(message) {
    this._statusIcon.glyph = 'error'
    this.setAttribute('available', false)
    this.select('error').innerHTML = message
    this._internals.setValidity({customError: true}, message)
  }


  async checkURL(){
    this._statusIcon.glyph = 'spinner'

    let url = this._input.value
    this.postData('/post/parse-external-url', {
      url: url
    }).then(res=>{
      this.fire('url-metadata', res)
      this._statusIcon.glyph = 'success'
      this.setAttribute('available', true)

      if(res.image) {
        this.fetchThumbnail()
      }
    })
    return
  }

  fetchThumbnail() {
    let data = new FormData()
    let request = new XMLHttpRequest()

    data.append('url', this.closest('form').querySelector('nonio-url-input').value)
    data.append('link', this._input.value)

    request.addEventListener('load', e => {
      console.log(request.response)
      this.imageUrl = request.response
    })

    request.open('post', config.IMAGE_HOST + '/fetch-og-image') 
    request.setRequestHeader('Authorization', 'Bearer ' + nonio.accessToken)
    request.send(data)
  }

  async move(url){
    return new Promise((resolve, reject) => {
      if(this.fileUrl == url) resolve(url)

      let data = new FormData()
      let request = new XMLHttpRequest()

      data.append('oldUrl', this.imageUrl)
      data.append('url', url)

      request.addEventListener('load', e => {
        if(request.status >= 200 && request.status < 300) {
          this.fileUrl = request.response
          resolve(request.response)
        }
        else {
          reject({
            status: request.status,
            statusText: request.statusText
          })
        }
      })

      request.addEventListener('error', e => {
        reject({
          status: e.status,
          statusText: request.statusText
        })
      })

      request.open('post', config.IMAGE_HOST + '/move')
      request.setRequestHeader('Authorization', 'Bearer ' + this.authToken)
      request.send(data)
    })
  }
}