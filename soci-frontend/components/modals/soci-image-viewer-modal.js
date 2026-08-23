import config from '../../config.js'

class SociImageViewerModal extends HTMLElement {
  constructor() {
    super()
    this._imageUrls = []
    this._index = 0
    this._boundKeydown = (e) => this._onKeydown(e)
  }

  connectedCallback() {
    if (this._bound) return
    this._bound = true
    this.innerHTML = `
      <style>
        #viewer {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        #image {
          max-width: 95vw;
          max-height: 92vh;
          object-fit: contain;
          box-shadow: 0 0 0 1px var(--shadow), 0 4px 8px var(--shadow), 0 0 0 1px rgba(255,255,255,0.1) inset;
          border-radius: 4px;
        }
        .viewer-btn {
          position: absolute;
          border: 0;
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.7);
          color: #fff;
          cursor: pointer;
        }
        #prev {
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          padding: 10px 12px;
        }
        #next {
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          padding: 10px 12px;
        }
        #counter {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.7);
          color: #fff;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
        }
      </style>
      <div id="viewer">
        <button id="prev" class="viewer-btn" type="button">←</button>
        <img id="image" alt="Attachment">
        <button id="next" class="viewer-btn" type="button">→</button>
        <div id="counter"></div>
      </div>
    `
    this.querySelector('#prev')?.addEventListener('click', () => this._step(-1))
    this.querySelector('#next')?.addEventListener('click', () => this._step(1))
    window.addEventListener('keydown', this._boundKeydown)
    this._applyModalShellStyles()
    this._render()
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this._boundKeydown)
  }

  setImages(imageUrls, index = 0) {
    const list = Array.isArray(imageUrls) ? imageUrls.filter((url) => typeof url === 'string' && url.trim()) : []
    this._imageUrls = [...new Set(list.map((url) => url.trim()))]
    const max = Math.max(0, this._imageUrls.length - 1)
    this._index = Math.max(0, Math.min(index, max))
    this._render()
  }

  _onKeydown(e) {
    const modal = this.closest('soci-modal')
    if (!modal?.hasAttribute('active')) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      this._step(-1)
      return
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      this._step(1)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      window.sociModals?.close('imageViewer')
    }
  }

  _step(delta) {
    if (this._imageUrls.length <= 1) return
    this._index = (this._index + delta + this._imageUrls.length) % this._imageUrls.length
    this._render()
  }

  _render() {
    const image = this.querySelector('#image')
    const counter = this.querySelector('#counter')
    const prev = this.querySelector('#prev')
    const next = this.querySelector('#next')
    const total = this._imageUrls.length
    if (image) {
      const current = total ? this._imageUrls[this._index] : ''
      image.src = this._toImageSrc(current)
    }
    if (total == 1) counter.style.display = 'none'
    else counter.textContent = total ? `${this._index + 1} / ${total}` : ''
    if (prev) prev.hidden = total <= 1
    if (next) next.hidden = total <= 1
  }

  _toImageSrc(imageUrl) {
    if (!imageUrl) return ''
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl
    if (imageUrl.endsWith('.webp')) return `${config.IMAGE_HOST}/${imageUrl}`
    return `${config.IMAGE_HOST}/${imageUrl}.webp`
  }

  _applyModalShellStyles() {
    const modal = this.closest('soci-modal')
    if (!modal?.select) return
    const shell = modal.select('#modal')
    const title = modal.select('#title')
    if (title) title.style.display = 'none'
    if (shell) {
      shell.style.backgroundColor = 'transparent'
      shell.style.boxShadow = 'none'
    }
  }
}

export default SociImageViewerModal
