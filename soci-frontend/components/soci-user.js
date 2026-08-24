import SociComponent from './soci-component.js'
import config from '../config.js'

export default class SociUser extends SociComponent {

  constructor() {
    super()
  }

  css(){
    return `
      :host {
        color: var(--text);
        cursor: pointer;
        --font-size: 12px;
        --font-weight: 400;
        --avatar-size: 16px;
        --line-height: 16px;
        --spacing: 8px;
        height: var(--line-height);
      }

      div {
        display: inline-flex;
      }

      img {
        width: var(--avatar-size);
        height: var(--avatar-size);
        border-radius: 50%;
        background: var(--bg-secondary);
        object-fit: cover;
      }

      :host([talking]) img {
        box-shadow: 0 0 0 2px var(--bg-success, #22c55e);
      }

      username {
        font-size: var(--font-size);
        font-weight: var(--font-weight);
        line-height: var(--line-height);
        height: var(--line-height);
        letter-spacing: -0.16px;
        margin-left: var(--spacing);
        user-select: none;
        color: inherit;
        display: block;
        border-radius: 3px;
      }

      soci-link {
        height: var(--line-height);
      }

      :host([op]) username {
        font-weight: 900;
        letter-spacing: 0.1px;
      }

      :host([admin]) username {
        color: var(--text-danger);
        font-weight: 900;
      }

      :host([size="small"]) {
        --avatar-size: 20px;
        --font-size: 12px;
        --font-weight: normal;
        --line-height: 20px;
        --spacing: 6px;
      }

      :host([size="large"]) {
        --avatar-size: 116px;
        --font-size: 32px;
        --font-weight: 600;
        --line-height: 32px;
        --spacing: 18px;
      }

      :host([avatar-only]) username {
        display: none;
      }
      
      :host([username-only]) picture {
        display: none;
      }

      :host([username-only]) username {
        margin-left: 0;
      }

      :host([size="small"][self]) username {
        background: var(--bg-brand);
        padding: 0 6px;
        color: var(--text-inverse);
        margin-right: -4px;
      }
    `
  }

  html(){ 
    let name = this.hasAttribute('self') ? soci.username : this.getAttribute('name')
    return `
    <soci-link ${name ? `href="/user/${name}"` : ''}>
      <div>
      <picture>${this._setImages(name)}</picture>
      <username>${name}</username>
      </div>
    </soci-link>
  `}

  connectedCallback(){
    this._updateUser = this._updateUser.bind(this)
    this._updateAvatar = this._updateAvatar.bind(this)
    document.addEventListener('username-updated', this._updateUser)
    document.addEventListener('avatar-updated', this._updateAvatar)
  }

  disconnectedCallback(){

  }

  static get observedAttributes() {
    return ['name', 'self']
  }

  attributeChangedCallback(name, oldValue, newValue){
    switch(name) {
      case 'name':
        this.select('username').innerHTML = newValue
        this.select('soci-link').setAttribute('href', `/user/${newValue}`)
        this.select('picture').innerHTML = this._setImages(newValue)
        this.toggleAttribute('self', newValue == soci.username) 
        break
      case 'self':
        if(newValue != null){
          this._updateUser()
        }
    }
  }

  _updateUser(){
    if(this.hasAttribute('self') && soci.username){
      this.setAttribute('name', soci.username)
    }
  }

  _updateAvatar(){
    if(this.hasAttribute('self')){
      this.select('picture').innerHTML = this._setImages(soci.username, true)
    }
  }

  _setImages(path, force = false){
    if(!path) return ''
    let cacheBuster = force ? `?${Date.now()}` : ''
    let basePath = this.getAttribute('size') == 'large' ? path : `thumbnail/${path}`
    let formats = ['webp', 'heic'].map(format => `<source srcset="${config.AVATAR_HOST}/${basePath}.${format}${cacheBuster}" />`).join('')
    // Avatars are never the LCP element; lazy keeps offscreen feed rows from
    // fetching a hundred of them during initial load.
    return (path == 'Anonymous coward' ? '' : formats) + `<img loading="lazy" decoding="async" src="${config.AVATAR_HOST}/thumbnail/default.png"/>`
  }
}
