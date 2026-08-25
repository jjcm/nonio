import SociComponent from './soci-component.js'
import config from '../config.js'
import { MEDIA_FRAME_CSS, lockRatio } from '../lib/media-frame.js'

export default class SociImageViewer extends SociComponent {
  constructor() {
    super()
  }

  css(){ return `
    :host {
      --media-max-width: min(var(--media-width, 100%), 100%);
      --media-max-height: min(calc(100vh - 100px), var(--media-height, calc(100vh - 100px)));
      width: 100%;
      display: block;
      overflow: auto;
      position: relative;
    }
    ${MEDIA_FRAME_CSS}
    #frame {
      z-index: 2;
    }
    :host([zoomable]) #image { cursor: zoom-in; }
    :host([zoomed]) #frame {
      /* Zooming means "paint at 1:1 and let the host scroll", so the bounds the
         frame is normally capped by have to come off. */
      width: var(--natural-width);
      max-width: none;
      max-height: none;

      #image { cursor: zoom-out; }
    }
    ::-webkit-scrollbar { width: 14px; }
    ::-webkit-scrollbar-track { background: var(--bg-bold); }
    /* this is a bad hack to get alpha transparency on the scroll bars */
    ::-webkit-scrollbar-thumb {
      background: linear-gradient(90deg, var(--text-secondary) -1500px, transparent 1000px);
      border-radius: 7px;
      border: 3px solid var(--bg-bold);
      &:hover { background: linear-gradient(90deg, var(--text-secondary-hover) -1500px, transparent 1000px); }
    }
    img.bg {
      position: absolute;
      z-index: 1;
      left: 0;
      top: 0;
      object-fit: cover;
      opacity: 0.2;
      filter: blur(20px);
      margin-bottom: 0;
      height: 100%;
      width: 100%;
    }
  `}

  html(){ return `
    <div id="frame">
      <img id="thumb" />
      <img id="image" @click=_toggleZoom />
    </div>
    <img class="bg"/>
  `}

  static get observedAttributes() {
    return ['url', 'width', 'height']
  }

  attributeChangedCallback(name, oldValue, newValue){
    if(name == 'url') this.url = newValue
    else lockRatio(this, this.getAttribute('width'), this.getAttribute('height'))
  }

  connectedCallback(){
    this._checkZoomable = this._checkZoomable.bind(this)
    this._frame = this.select('#frame')
    this._resizeObserver = new ResizeObserver(this._checkZoomable)
    this._resizeObserver.observe(this)
  }

  disconnectedCallback(){
    this._resizeObserver.unobserve(this)
  }

  _checkZoomable(){
    if(this.naturalWidth > this._frame.offsetWidth || this.naturalHeight > this._frame.offsetHeight){
      this.toggleAttribute('zoomable', true)
    }
    else {
      if(!this.hasAttribute('zoomed'))
        this.toggleAttribute('zoomable', false)
    }
  }

  _toggleZoom(){
    if(this.hasAttribute('zoomable')) this.toggleAttribute('zoomed')
  }

  get url(){
    return this.getAttribute('url')
  }

  set url(val){
    if(this.getAttribute('url') != val){
      this.setAttribute('url', val)
      return
    }
    let thumb = this.select('#thumb')
    let image = this.select('#image')
    let thumbUrl = `${config.THUMBNAIL_HOST}/${this.url}.webp`

    // Posts predating stored dimensions have to be measured. The thumbnail is
    // resized on the ratio it came in on, so it can stand in for the full image
    // and it lands first by an order of magnitude.
    let ratioIsKnown = lockRatio(this, this.getAttribute('width'), this.getAttribute('height'))
    if(!ratioIsKnown)
      thumb.onload = () => lockRatio(this, thumb.naturalWidth, thumb.naturalHeight)

    image.onload = () => {
      this.naturalWidth = image.naturalWidth
      this.naturalHeight = image.naturalHeight
      this.style.setProperty('--natural-width', `${image.naturalWidth}px`)
      // Only a last resort, for when the thumbnail is missing too. Re-locking a
      // box that is already reserved is the shift this component exists to
      // avoid, even when the full image disagrees by a fraction of a pixel.
      if(!this.hasAttribute('ratio'))
        lockRatio(this, image.naturalWidth, image.naturalHeight)
      this._checkZoomable()
    }

    thumb.src = this.select('img.bg').src = thumbUrl
    // #image sits above #thumb in the frame and paints nothing until it decodes,
    // so the two can load in parallel and the handoff needs no cross-fade.
    image.src = `${config.IMAGE_HOST}/${this.url}.webp`
  }
}
