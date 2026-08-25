import SociComponent from './soci-component.js'
import config from '../config.js'

export default class SociAvatarUploader extends SociComponent {
  // Crop configs are centralized for DRY + future formats
  static CROP_TYPES = {
    avatar: {
      aspectRatio: 1,
      minWidth: 96,
      minHeight: 96,
      maskRadius: '50%',
    },
    banner: {
      aspectRatio: 280 / 63,
      minWidth: 560,
      minHeight: 126,
      maskRadius: '8px',
    },
  }

  get _cropConfig() {
    return SociAvatarUploader.CROP_TYPES[this.getAttribute('type')] || SociAvatarUploader.CROP_TYPES.avatar
  }
  get _aspectRatio() { return this._cropConfig.aspectRatio }
  get _minWidth() { return this._cropConfig.minWidth }
  get _minHeight() { return this._cropConfig.minHeight }

  constructor() {
    super()
  }

  css(){
    return `
      :host {
        display: block;
        margin-bottom: 12px;
        width: 100%;
        height: 300px;
        cursor: pointer;
        border-radius: 8px;
        transition: margin-bottom 0.2s var(--soci-ease);
      }

      input { display: none; }

      #container,
      #cropping,
      #preview,
      svg {
        width: 100%;
        height: 100%;
        overflow: hidden;
        border-radius: 8px;
      }
      
      #container {
        position: relative;
      }

      #cropping { opacity: 0; pointer-events: none; position: absolute;}
      :host([editing]) #cropping { opacity: 1; pointer-events: all; position: relative;}
      :host([editing]) picture { display: none; }
      :host(:not([editing])) picture {
        display: block;
        height: 100%;
      }
      :host(:not([editing])) picture img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      svg {
        position: absolute;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s var(--soci-ease);
      }
      
      :host([editing]) svg {
        opacity: 1;
      }
      :host([editing]) #resizer {
        opacity: 0.8;
        transition-delay: 0.2s;
      }

      :host([editing]) #resize-mask {
        transition-delay: 0.2s;
      }


      #preview {
        object-fit: contain;
        pointer-events: none;
      }

      #actions {
        height: 0;
        opacity: 0;
        overflow: hidden;
        transition: all 0.2s var(--soci-ease);
        margin-top: 0;
      }

      :host([editing]) {
        margin-bottom: 56px;
      }
      :host([editing]) #actions {
        height: 32px;
        opacity: 1;
        margin-top: 12px;
      }

      #resizer {
        position: absolute;
        width: 100px;
        height: 100px;
        top: 100px;
        left: 100px;
        opacity: 0;
        transition: opacity 0.2s var(--soci-ease);
      }
      
      .resizer {
        position: absolute;
        width: min(12px, 50%);
        height: min(12px, 50%);
        border-color: #fff;
        border-width: 0;
      }
      .corner {
        border-style: solid;
        z-index: 2;
      }
      .edge {
        border-style: dotted;
        z-index: 1;
        opacity: 0.2;
      }

      #nw {
        top: 0px;
        left: 0px;
        cursor: nw-resize;
        border-width: 1px 0 0 1px;
      }
      #ne {
        top: 0px;
        right: 0px;
        cursor: ne-resize;
        border-width: 1px 1px 0 0;
      }
      #se {
        bottom: 0px;
        right: 0px;
        cursor: se-resize;
        border-width: 0 1px 1px 0;
      }
      #sw {
        bottom: 0px;
        left: 0px;
        cursor: sw-resize;
        border-width: 0 0 1px 1px;
      }

      #n {
        width: 100%;
        border-top-width: 1px;
        top: 0px;
      }
      #e {
        height: 100%;
        border-right-width: 1px;
        right: 0px;
      }
      #s {
        width: 100%;
        border-bottom-width: 1px;
        bottom: 0px;
      }
      #w {
        height: 100%;
        border-left-width: 1px;
        left: 0px;
      }
      #drag {
        position: absolute;
        width: calc(100% - 8px);
        height: calc(100% - 8px);
        border-radius: 4px;
        top: 4px;
        left: 4px;
        cursor: move;
      }
      #pattern {
        left: 0;
        z-index: -1;
      }

      :host([dragging]) {
        #w {
          cursor: w-resize;
        }
        #e {
          cursor: e-resize;
        }
        #s {
          cursor: s-resize;
        }
        #n {
          cursor: n-resize;
        }
      }
      
      :host([dragging="sw"]) {
        cursor: sw-resize;
      }
      :host([dragging="se"]) {
        cursor: se-resize;
      }
      :host([dragging="ne"]) {
        cursor: ne-resize;
      }
      :host([dragging="nw"]) {
        cursor: nw-resize;
      }
      :host([dragging="drag"]) {
        cursor: move;
      }

    `
  }

  html(){ return `
    <input id="file" type="file" accept="image/*"/>
    <div id="container">
      <div id="cropping">
        <svg id="resize-mask">
          <mask id="mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white"/>
            <rect id="mask-rect" x="100" y="100" width="100" height="100" fill="black"/>
          </mask>
          <rect x="0" y="0" width="100%" height="100%" fill="url(#bg-pattern)" mask="url(#mask)"/>
          <defs>
            <pattern id="bg-pattern" patternUnits="userSpaceOnUse" width="32" height="32">
              <rect x="0" y="0" width="100%" height="100%" fill="#00000088"/>
              <path d="M32 0V32M0 32H32" stroke="#ffffff10" stroke-width="1"/>
            </pattern>
            <pattern id="bg-pattern2" patternUnits="userSpaceOnUse" width="16" height="16">
              <path d="M16 0V16M0 16H16" stroke="#ffffff10" stroke-width="1"/>
            </pattern>
          </defs>
        </svg>
        <div id="resizer" @mousedown=_mousedown>
          <div class="resizer corner" id="nw"></div>
          <div class="resizer edge" id="n"></div>
          <div class="resizer corner" id="ne"></div>
          <div class="resizer edge" id="e"></div>
          <div class="resizer corner" id="se"></div>
          <div class="resizer edge" id="s"></div>
          <div class="resizer corner" id="sw"></div>
          <div class="resizer edge" id="w"></div>
          <div id="drag"></div>
        </div>
        <img id="preview" @load=_maximizeCrop />
        <svg id="pattern">
          <rect x="0" y="0" width="100%" height="100%" fill="url(#bg-pattern)"/>
          <rect x="0" y="0" width="100%" height="100%" fill="url(#bg-pattern2)"/>
          <defs>
            <pattern id="bg-pattern" patternUnits="userSpaceOnUse" width="32" height="32">
              <path d="M32 0V32M0 32H32" stroke="#ffffff10" stroke-width="1"/>
            </pattern>
            <pattern id="bg-pattern2" patternUnits="userSpaceOnUse" width="16" height="16">
              <path d="M16 0V16M0 16H16" stroke="#ffffff10" stroke-width="1"/>
            </pattern>
          </defs>
        </svg>
      </div>
      <picture>
        <img/>
      </picture>
    </div>
    <div id="actions">
      <soci-button async @click=_upload>submit</soci-button>
      <soci-button subtle @click=_cancelEditing>cancel</soci-button>
    </div>
  `}

  static get observedAttributes() {
    return ['community', 'type']
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'type') this._applyCropConfig()
    if (name === 'community' && this.isConnected) this._loadCurrentAvatar()
  }



  connectedCallback(){
    ['dragenter', 'dragleave', 'dragover', 'drop'].forEach(
      e => this.addEventListener(e, this['_' + e])
    )

    this.select('#file').addEventListener('change', this._loadCropPreview.bind(this))
    this.select('picture').addEventListener('click', this._selectFile.bind(this))

    this._mousemove = this._mousemove.bind(this)
    this._mouseup = this._mouseup.bind(this)
    this._maximizeCrop = this._maximizeCrop.bind(this)
    this._applyCropConfig()
    this._loadCurrentAvatar()
  }

  get _avatarPath() {
    const community = this.getAttribute('community')
    if (community) return community.startsWith('@') ? community : `@${community}`
    return soci.username
  }

  _loadCurrentAvatar(){
    this._currentAvatarUrl = `${config.AVATAR_HOST}/${this._avatarPath}.webp?${Date.now()}`
    this.select('picture').innerHTML = `<img src="${this._currentAvatarUrl}">`
    this.select('#preview').src = this._currentAvatarUrl
  }

  _selectFile(){
    if (this.hasAttribute('editing')) return
    this.select('#file').click()
  }

  _loadCropPreview(e){
    const file = e?.target?.files?.[0]
    if (!file || file.type.indexOf('image/') !== 0) return
    const reader = new FileReader()
    reader.addEventListener('load', evt => {
      this.setAttribute('editing', '')
      this.select('#preview').src = evt.target.result
    })
    reader.readAsDataURL(file)
    setTimeout(() => {
      this._maximizeCrop()
    }, 200)
  }

  _cancelEditing(){
    this.toggleAttribute('editing', false)
    this.select('#file').value = ''
    if (this._currentAvatarUrl) this.select('#preview').src = this._currentAvatarUrl
  }

  _applyCropConfig() {
    const rect = this.select('#mask-rect')
    if (rect) rect.setAttribute('rx', this._cropConfig.maskRadius)
  }

  _dragType = null
  _dragStartX = 0
  _dragStartY = 0
  _dragDeltaX = 0
  _dragDeltaY = 0
  _x = 100
  _y = 100
  _width = 100
  _height = 100
  _uploading = false

  _mousedown(e){
    this._dragType = e.target.id
    document.body.toggleAttribute('dragging', true)
    this.setAttribute('dragging', this._dragType)
    this._dragStartX = e.clientX
    this._dragStartY = e.clientY

    this._editorDimensions = this._getContainedImageDimensions(this.select('#preview'))

    document.addEventListener('mousemove', this._mousemove)
    document.addEventListener('mouseup', this._mouseup)
  }

  _mousemove(e){
    this._dragDeltaX = e.clientX - this._dragStartX
    this._dragDeltaY = e.clientY - this._dragStartY
    const ar = this._aspectRatio
    let w, h, x, y
    const dx = this._dragDeltaX
    const dy = this._dragDeltaY
    switch(this._dragType){
      case 'drag':
        this._resizeCrop(
          Math.min(Math.max(this._editorDimensions.xOffset, this._x + dx), this._editorDimensions.width + this._editorDimensions.xOffset - this._width),
          Math.min(Math.max(this._editorDimensions.yOffset, this._y + dy), this._editorDimensions.height + this._editorDimensions.yOffset - this._height),
          this._width, 
          this._height
        )
        break
      case 'nw':
        // Opposite corner: bottom-right
        w = Math.max(this._width - dx, (this._height - dy) * ar)
        h = w / ar
        x = this._x + (this._width - w)
        y = this._y + (this._height - h)
        this._resizeCrop(x, y, w, h)
        break
      case 'se':
        // Opposite corner: top-left
        w = Math.max(this._width + dx, (this._height + dy) * ar)
        h = w / ar
        x = this._x
        y = this._y
        this._resizeCrop(x, y, w, h)
        break
      case 'ne':
        // Opposite corner: bottom-left
        w = Math.max(this._width + dx, (this._height - dy) * ar)
        h = w / ar
        x = this._x
        y = this._y + (this._height - h)
        this._resizeCrop(x, y, w, h)
        break
      case 'sw':
        // Opposite corner: top-right
        w = Math.max(this._width - dx, (this._height + dy) * ar)
        h = w / ar
        x = this._x + (this._width - w)
        y = this._y
        this._resizeCrop(x, y, w, h)
        break
    }
  }

  _mouseup(e){
    document.body.toggleAttribute('dragging', false)
    this.toggleAttribute('dragging', false)
    this._x = parseInt(this.select('#mask-rect').getAttribute('x'))
    this._y = parseInt(this.select('#mask-rect').getAttribute('y'))
    this._width = parseInt(this.select('#mask-rect').getAttribute('width'))
    this._height = parseInt(this.select('#mask-rect').getAttribute('height'))
    document.removeEventListener('mousemove', this._mousemove)
    document.removeEventListener('mouseup', this._mouseup)
  }

  _dragenter(e){
    e.preventDefault()
    this.toggleAttribute('dragover', true)
  }

  _dragover(e){
    e.preventDefault()
  }

  _dragleave(e){
    this.toggleAttribute('dragover', false)
  }

  _drop(e){
    e.preventDefault()
    e.stopPropagation()
    this.toggleAttribute('dragover', false)
    if(e.dataTransfer.files.length == 0) return 0

    let input = this.select('#file')
    input.files = e.dataTransfer.files
    let event = new Event('change')
    input.dispatchEvent(event)
  }

  _resizeCrop(x, y, width, height) {
    const ed = this._editorDimensions
    const minW = this._minWidth / ed.scale
    const minH = this._minHeight / ed.scale
    const EPS = 1 // tolerate sub-pixel drift

    // Snap small floating errors back into the box without bailing
    let nx = x
    let ny = y
    let nw = width
    let nh = height
    const maxX = ed.xOffset + ed.width
    const maxY = ed.yOffset + ed.height

    const right = nx + nw
    const bottom = ny + nh
    if (nx < ed.xOffset && ed.xOffset - nx <= EPS) nx = ed.xOffset
    if (ny < ed.yOffset && ed.yOffset - ny <= EPS) ny = ed.yOffset
    if (right > maxX && right - maxX <= EPS) nx = maxX - nw
    if (bottom > maxY && bottom - maxY <= EPS) ny = maxY - nh

    const blocked =
      nw < minW ||
      nh < minH ||
      nx < ed.xOffset ||
      ny < ed.yOffset ||
      nx + nw > maxX ||
      ny + nh > maxY
    if (blocked) return

    let maskRect = this.select('#mask-rect')
    maskRect.setAttribute('x', nx)
    maskRect.setAttribute('y', ny)
    maskRect.setAttribute('width', nw)
    maskRect.setAttribute('height', nh)

    let resizer = this.select('#resizer')
    resizer.style.left = nx + 'px'
    resizer.style.top = ny + 'px'
    resizer.style.width = nw + 'px'
    resizer.style.height = nh + 'px'
  }

  _maximizeCrop() {
    const ed = this._editorDimensions = this._getContainedImageDimensions(this.select('#preview'))
    let width, height
    if (ed.width / ed.height > this._aspectRatio) {
      height = ed.height
      width = height * this._aspectRatio
    } else {
      width = ed.width
      height = width / this._aspectRatio
    }

    const minW = this._minWidth / ed.scale
    const minH = this._minHeight / ed.scale
    width = Math.max(width, minW)
    height = Math.max(height, minH)

    const x = ed.xOffset + (ed.width - width) / 2
    const y = ed.yOffset + (ed.height - height) / 2

    this._x = x
    this._y = y
    this._width = width
    this._height = height
    this._resizeCrop(x, y, width, height)
  }

  _getCropSelection() {
    const rect = this.select('#mask-rect')
    const ed = this._editorDimensions || this._getContainedImageDimensions(this.select('#preview'))
    if (!rect || !ed?.scale) return null

    const x = Math.max(0, parseFloat(rect.getAttribute('x')) - ed.xOffset)
    const y = Math.max(0, parseFloat(rect.getAttribute('y')) - ed.yOffset)
    const width = parseFloat(rect.getAttribute('width'))
    const height = parseFloat(rect.getAttribute('height'))

    const scale = ed.scale
    return {
      x: Math.floor(x * scale),
      y: Math.floor(y * scale),
      width: Math.floor(width * scale),
      height: Math.floor(height * scale),
    }
  }

  async _upload(){
    if (this._uploading || !this.hasAttribute('editing')) return

    const file = this.select('#file')?.files?.[0]
    const crop = this._getCropSelection()
    if (!file || !crop) return

    this._uploading = true
    const btn = this.select('soci-button[async]')
    const data = new FormData()
    data.append('files', file)
    data.append('xoffset', crop.x)
    data.append('yoffset', crop.y)

    if (this.getAttribute('type') === 'banner') {
      data.append('width', crop.width)
      data.append('height', crop.height)
      data.append('type', 'banner')
    } else {
      data.append('size', crop.width)
    }

    const community = this.getAttribute('community')
    if (community) data.append('community', community.replace('@', ''))

    const res = await fetch(config.AVATAR_HOST + '/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + this.authToken },
      body: data,
    }).catch(() => null)

    if (res?.ok) {
      btn?.success?.()
      this._loadCurrentAvatar()
      this._cancelEditing()
      this.fire('avatar-updated', { community })
    } else {
      btn?.error?.()
    }

    this._uploading = false
  }

  _getContainedImageDimensions(img) {
    // Get the original aspect ratio of the image
    const imageAspectRatio = img.naturalWidth / img.naturalHeight;

    // Get the rendered dimensions of the <img> element's content box
    const elementWidth = img.width;
    const elementHeight = img.height;
    const elementAspectRatio = elementWidth / elementHeight;

    let renderedWidth;
    let renderedHeight;

    // Compare the aspect ratios to determine how it's 'contained'
    if (imageAspectRatio > elementAspectRatio) {
      // The image is limited by the container's width (pillarboxed)
      renderedWidth = elementWidth;
      renderedHeight = elementWidth / imageAspectRatio;
    } else {
      // The image is limited by the container's height (letterboxed)
      renderedHeight = elementHeight;
      renderedWidth = elementHeight * imageAspectRatio;
    }

    return {
      xOffset: (elementWidth - renderedWidth) / 2,
      yOffset: (elementHeight - renderedHeight) / 2,
      width: renderedWidth,
      height: renderedHeight,
      scale: img.naturalWidth / renderedWidth
    };
  }

}