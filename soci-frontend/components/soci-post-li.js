import SociComponent from './soci-component.js'
import config from '../config.js'

export default class SociPostLi extends SociComponent {

  constructor() {
    super()
  }

  css(){
    return `
      :host {
        background: var(--bg);
        margin-bottom: 8px;
        display: block;
        padding: 12px;
        border-radius: 8px;
        box-shadow: 0px 1px 3px var(--shadow);
        box-sizing: border-box;
        opacity: 1;
        position: relative;
        min-height: 96px;
      }

      :host(.no-image) slot[name="thumbnail"] {
        display: none;
      }

      ::slotted(img),
      img {
        display: none;
        width: 96px;
        height: 72px;
        border-radius: 3px;
        object-fit: cover;
        cursor: zoom-in;
        float: left;
      }
      ::slotted(img[src]),
      img[src] {
        display: block;
        margin-right: 8px;
      }

      #preview {
        position: absolute;
        padding: 12px;
        top: 0;
        left: 0;
        pointer-events: none;
        box-sizing: border-box;
        width: 100%;
      }

      #preview img {
        opacity: 0;
      }

      content {
        display: flex;
        flex-direction: column;
      }
      #top {
        display: flex;
        flex-direction: column;
      }
      #details {
        display: flex;
        gap: 8px;
        font-size: 12px;
        white-space: nowrap;
        flex-wrap: wrap;
        height: 16px;
        overflow: hidden;
      }
      #domain,
      #time {
        color: var(--text-tertiary);
      }
      :host([time="now"]) #time suffix {
        display: none;
      }

      #metadata-link > div:before,
      #delete:before {
        content: '•';
        display: inline-block;
        margin-right: 1ch;
        color: var(--text-tertiary);
      }
      #delete {
        color: var(--text-tertiary);
      }
      #delete span:hover {
        text-decoration: underline;
        cursor: pointer;
      }
      #comments {
        color: var(--text-secondary);
        letter-spacing: -0.16px;
        line-height: 16px;
      }
      #time svg,
      #comments svg {
        display: none;
      }

      #domain {
        display: none;
        pointer-events: none;
      }

      :host([type="link"]) #domain {
        display: block;
      }

      .title {
        font-size: 16px;
        color: var(--text-bold);
        letter-spacing: -0.08px;
        line-height: 20px;
        max-height: 72px;
        font-weight: 600;
        margin-bottom: 8px;
        margin-top: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      slot[name="tags"] {
        display: inline-block;
        height: 20px;
      }

      :host([score="0"]) #score {
        color: var(--bg-secondary);
      }

      :host([expanded]) {
        height: 400px;
      }

      :host([expanded]) img {
        transition: all 0.1s var(--soci-ease);
        max-width: calc(100% - 280px);
        margin-right: 16px;
      }

      #metadata-link,
      picture {
        display: contents;
      }

      :host([expanded]) #top {
        flex-direction: column-reverse;
      }

      :host([expanded]) #title {
        font-size: 20px;
        line-height: 28px;
        white-space: normal;
        animation: load-in 0.2s var(--soci-ease) 0.14s forwards;
        opacity: 0;
        margin-top: 4px;
        margin-bottom: 12px;
      }

      :host([expanded]) #details {
        animation: load-in 0.2s var(--soci-ease) 0.14s forwards;
        opacity: 0;
        display: flex;
        margin-bottom: 8px;
      }

      :host([expanded]) #time,
      :host([expanded]) #comments {
        position: static;
        color: var(--text-secondary);
      }

      :host([expanded]) slot[name="tags"] {
        margin-bottom: 12px;
        display: inline-block;
        opacity: 0;
        animation: load-in 0.2s var(--soci-ease) 0.14s forwards;
        z-index: 1;
      }

      :host([expanded]) ::slotted(soci-markdown-view) {
        display: block;
        opacity: 0;
        animation: load-in 0.25s var(--soci-ease) 0.14s forwards;
        font-size: 14px;
      }

      slot[name="description"] {
        display: block;
        max-height: 100%;
        overflow: hidden;
      }

      #external-link {
        color: var(--text);
        display: none;
      }

      #external-link:visited {
        color: var(--text-secondary);
      }

      #external-link svg {
        margin-left: 4px;
        margin-top: 6px;
        color: var(--text-tertiary);
      }

      :host([type="link"]) #external-link {
        display: flex;
      }

      :host([type="link"]) #internal-link {
        display: none;
      }

      @keyframes load-in {
        from {
          transform: translateY(4px);
          opacity: 0;
        }

        to {
          transform: translateY(0px);
          opacity: 1;
        }
      }

      @media (max-width: 768px) {
        :host {
          display: flex;
          flex-direction: column;
          padding-top: 28px;
        }
        :host([expanded]) {
          height: auto;
        }
        :host([expanded]) img {
          max-width: 100%;
          margin-right: 0;
        }
        :host([expanded]) #details,
        :host([expanded]) #title {
          animation: none;
          opacity: 1;
        }
        img {
          width: 100%;
          height: 200px;
          margin-top: 4px;
        }
        #preview img {
          transform: translateY(16px);
        }
        #time,
        #comments {
          position: static;
          display: inline-flex;
          color: var(--text-tertiary);
        }
        #time svg,
        #comments svg {
          display: inline-block;
          margin-right: 4px;
        }
        #time suffix,
        #comments suffix {
          display: none;
        }
        content {
          padding-left: 0;
        }
        #details {
          position: absolute;
          top: 8px;
          width: calc(100% - 24px);
          flex-wrap: nowrap;
        }
        #metadata-link > div:before {
          display: none;
        }
        #metadata-link > div {
          order: 1;
        }
        #metadata-link #domain {
          order: 0;
        }
        #domain:after {
          content: "•";
          margin-left: 1ch;
        }
        slot[name="user"] {
          width: 100%;
          display: inline-block;
        }
        #title {
          margin-top: 0;
          margin-bottom: 12px;
        }
        #delete {
          display: none !important;
        }
      }

    `
  }

  html(){ 
    const title = this.getAttribute('post-title')
    const link = this.getAttribute('link')
    const score = this.getAttribute('score')
    const comments = this.getAttribute('comments') || 0
    const url = this.getAttribute('url')
    const community = this.getAttribute('community') || ''
    const postPath = community ? `/@${community}/${url}` : `/${url}`

    return `
    <slot name="thumbnail">
      <picture id="thumbnail">
        <img @click=expand />
      </picture>
    </slot>
    <div id="preview">
      <picture>
        <img @click=expand />
      </picture>
      <content></content>
    </div>
    <content>
      <div id="top">
        <div id="details">
          <slot name="user"></slot>
            <soci-link id="metadata-link" ${url ? `href="${postPath}"` : ''}>
            <div id="votes">${score} vote${score == 1 ? '' : 's'}</div>
            <div id="comments">${window.SociIcon?.('comments', 16) || ''}<span>${comments} comment${comments == 1 ? '' : 's'}</span></div>
            <div id="time">${window.SociIcon?.icon?.('time', 16) || ''}<span></span><suffix> ago</suffix></div>
            <div id="domain">${link?.replace(/^(?:https?:\/\/)?(?:www\.)?([^\/]+).*$/, '$1')}</div>
          </soci-link>
          <div id="delete" style="display: none;" @click=deletePost><span>delete</span></div>
        </div>
          <soci-link id="internal-link" ${url ? `href="${postPath}"` : ''}>
          <div class="title">${title}</div>
        </soci-link>
        <a id="external-link" href="${this.getAttribute('link')}">
          <div class="title">${title}</div>
        </a>
      </div>
      <slot name="tags"></slot>
      <slot name="description"></slot>
    </content>
  `}

  connectedCallback(){
    this.addEventListener('scoreChanged', this._scoreChanged)
    this.loadContent(this.getAttribute('type'))
    const time = this.getAttribute('time')
    if(time == 'now') this.select('#time span').innerHTML = "just now"
    else {
      this.updateTime = this.updateTime.bind(this)
      this.updateTime(time, this.select('#time span'))
    }
    this._checkDeletePermission()
  }

  _checkDeletePermission(){
    const author = this.querySelector('soci-user')?.getAttribute('name')
    
    if(author == soci.username || soci.roles.includes('admin')) {
      this.select('#delete').style.display = 'inline'
    }
  }

  async deletePost(e){
    let dom = this.select('#delete')
    switch(e.target.innerHTML){
      case 'delete':
        dom.innerHTML = `are you sure? <span style="color: var(--text-danger);">confirm delete</span> | <span>cancel</span>`
        break
      case 'confirm delete':
        await window.api.posts.delete(this.getAttribute('url'), this.community)
        this.remove()
        break
      case 'cancel':
        dom.innerHTML = `<span>delete</span>`
        break
    }
  }

  static get observedAttributes() {
    return ['post-title', 'score', 'time', 'type', 'comments', 'url', 'link', 'community']
  }

  attributeChangedCallback(name, oldValue, newValue){
    if(!this._initialRenderComplete) return

    switch(name) {
      case 'post-title':
        this.select('#internal-link .title').innerHTML = newValue
        this.select('#external-link .title').innerHTML = newValue
        break
      case 'type':
        this.loadContent(newValue)
        break
      case 'link':
        let link = this.select('#external-link')
        link.setAttribute('href', newValue)
        this.select('#domain').innerHTML = link.hostname.replace('www.', '')
        break
      case 'time':
        if(newValue == "now") return this.select('#time span').innerHTML = "just now"
        this.updateTime = this.updateTime.bind(this)
        this.updateTime(newValue, this.select('#time span'))
        break
      case 'score':
        this.select('#votes').innerHTML = newValue + ' vote' + (newValue == 1 ? '' : 's')
        break;
      case 'comments':
        this.select('#comments span').innerHTML = `${newValue}<suffix> comment${(newValue == 1 ? '' : 's')}</suffix>`
        break;
      case 'url':
        this._updateLinks()
        break;
      case 'community':
        this._updateLinks()
        break;

    }
  }

  get score(){
    let score = this.getAttribute('score') || 0
    return parseInt(score)
  }

  set score(val){
    this.setAttribute('score', val)
  }

  get url(){
    return this.getAttribute('url')
  }

  get community(){
    return this.getAttribute('community') || ''
  }

  _postPath(){
    return this.community ? `/@${this.community}/${this.url}` : `/${this.url}`
  }

  _postApiPath(){
    return this.community ? `/posts/@${this.community}/${this.url}` : `/posts/${this.url}`
  }

  _updateLinks(){
    const path = this._postPath()
    this.select('#metadata-link')?.setAttribute('href', path)
    this.select('#internal-link')?.setAttribute('href', path)
  }

  expand(){
    this.toggleAttribute('expanded')
    let thumbnail = this.select('#thumbnail img')
    let preview = this.select('#preview img')
    if(this.hasAttribute('expanded')){
      //TODO - this only works for desktop. Mobile this logic is a bit funky
      thumbnail.style.height = preview.style.height = '376px'
      thumbnail.style.width = preview.style.width = `${(thumbnail.naturalWidth / thumbnail.naturalHeight) * 376}px`
      let description = document.createElement('soci-markdown-view')
      this._setImageSource(this.select('#preview'), config.IMAGE_HOST)
      description.setAttribute('slot', 'description')
      setTimeout(()=>{
        if(this.hasAttribute('expanded'))
          preview.style.opacity = 1
      }, 100)
      this.getData(this._postApiPath()).then(e=>{
        if(e.content.length && this.hasAttribute('expanded')){
          description.render(e.content)
          this.appendChild(description)
        }
      })
    }
    else {
      thumbnail.style.height = preview.style.height = ''
      thumbnail.style.width = preview.style.width = ''
      this.querySelector('soci-markdown-view')?.remove()
      preview.style.opacity = ''
    }

  }

  _scoreChanged(e){
    this.score = e.detail.score
  }

  _setImageSource(container, host){
    let img = container.querySelector('img')
    img.loading = this.hasAttribute('eager') ? 'eager' : 'lazy'
    img.decoding = 'async'
    img.src = `${host}/${this.url}.webp`
    img.onerror = () => {
      this.classList.toggle('no-image', true)
    }
  }

  loadContent(type) {
    switch(type){
      case 'image':
      case 'link':
        this._setImageSource(this.select('#thumbnail'), config.THUMBNAIL_HOST)
        break
    }
  }
}
