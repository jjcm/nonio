import NonioComponent from './nonio-component.js'
import config from '../config.js'

export default class NonioHTMLPage extends NonioComponent {
  constructor() {
    super()
  }

  css(){ return `
    :host {
      width: 100%;
      display: block;
      overflow: hidden;
      position: relative;
    }
    
    iframe {
      width: 100%;
      border: 0;
    }
  `}

  html(){ return `
    <iframe id="page"></iframe>
  `}

  static get observedAttributes() {
    return ['src']
  }

  attributeChangedCallback(name, oldValue, newValue){
    if(name == 'src') this.src = newValue
  }

  connectedCallback(){
    this._contentHeight = null
    this._setDefaultHeight()
    this._watchDetailsHeight()

    const channel = new MessageChannel()
    this.select('iframe').addEventListener('load', () => {
      this._contentHeight = null
      this._setDefaultHeight()

      channel.port1.onmessage = (e) => {
        if(e.data.height) {
          this._contentHeight = e.data.height
          this.select('iframe').style.height = e.data.height + 'px'
        }
      }

      this.select('iframe').contentWindow.postMessage('resize observer initialization', '*', [channel.port2])
    })
  }

  disconnectedCallback(){
    this._detailsResizeObserver?.disconnect()
    this._detailsResizeObserver = null
  }

  _getDetailsHeight(){
    const post = this.closest('nonio-post')
    const details = post?.shadowRoot?.querySelector('#details')
    return details?.offsetHeight || 0
  }

  _setDefaultHeight(){
    if(this._contentHeight != null) return

    const iframe = this.select('iframe')
    if(!iframe) return

    const detailsHeight = this._getDetailsHeight()
    iframe.style.height = detailsHeight
      ? `calc(100vh - ${detailsHeight}px)`
      : '100vh'
  }

  _watchDetailsHeight(){
    const post = this.closest('nonio-post')
    if(!post) return

    const observe = () => {
      const details = post.shadowRoot?.querySelector('#details')
      if(!details) return

      this._detailsResizeObserver?.disconnect()
      this._detailsResizeObserver = new ResizeObserver(() => this._setDefaultHeight())
      this._detailsResizeObserver.observe(details)
    }

    if(post.shadowRoot) observe()
    else customElements.whenDefined('nonio-post').then(observe)
  }

  get src(){
    return this.getAttribute('url')
  }

  set src(val){
    if(this.getAttribute('src') != val){
      this.setAttribute('src', val)
      return
    }
    this._contentHeight = null
    this._setDefaultHeight()
    this.select('#page').src = config.HTML_HOST + '/' + val
  }
}
