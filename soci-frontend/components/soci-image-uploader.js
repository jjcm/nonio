import SociComponent from './soci-component.js'
import config from '../config.js'

export default class SociImageUploader extends SociComponent {
  constructor() {
    super()
  }

  css(){
    return `
      :host {
        width: 100%;
        min-height: 240px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        border: 2px dashed var(--bg-secondary);
        box-sizing: border-box;
        border-radius: 8px;
        margin-bottom: 12px;
        position: relative;
        transition: border 0.2s ease;
        --upload-progress: 0%;
        &::before {
          content: '';
          display: block;
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: var(--bg-success);
          opacity: 0;
          transition: opacity 0.2s ease;
          pointer-events: none;
        }
      }
      :host([dragover]) {
        border: 2px dashed var(--bg-success);
        transition: border 0.1s ease-out;
        &::before { opacity: 0.1; transition: opacity 0.1s ease-out; z-index: -1; }
      }
      :host([preview]) {
        min-height: 0;
        border-color: transparent;
        transition: all 0.2s ease-in-out;
        overflow: hidden;
        &::before { opacity: 0; transition: all 0.2s ease-in-out; }
      }
      :host([preview]) label,
      :host([preview]) div { display: none; }
      div { font-weight: 500; color: var(--text-secondary); margin-bottom: 12px; mix-blend-mode: multiply; }
      label {
        border-radius: 4px;
        height: 24px;
        color: var(--text-inverse);
        cursor: pointer;
        background: var(--bg-brand);
        border: 2px solid var(--bg-brand);
        padding: 0 6px;
        line-height: 22px;
        text-align: center;
        outline: none;
        min-width: 100px;
        transition: height 0.1s ease-in-out;
        user-select: none;
        position: relative;
        &:hover { background: var(--bg-brand-hover); border-color: var(--bg-brand-hover); }
        &:active { background: var(--bg-brand-active); border-color: var(--bg-brand-active); }
        &.uploading {
          height: 8px;
          transition: all 0.1s ease-in-out;
          background: var(--bg);
          border-color: var(--bg-success);
          &::after {
            content: '';
            display: block;
            position: absolute;
            top: 0;
            left: 0;
            height: 8px;
            width: var(--upload-progress);
            transition: width 0.3s ease;
            background: var(--bg-success);
          }
        }
      }
      #preview {
        max-width: 100%;
        img, video { max-width: 100%; }
      }
      input { display: none; }
    `
  }

  html(){ return `
    <div>drag image here</div>
    <label for="file">select image</label>
    <input id="file" type="file" accept="image/*"/>
    <picture id="preview"></picture>
  `}

  connectedCallback(){
    ['dragenter', 'dragleave', 'dragover', 'drop'].forEach(
      e => this.addEventListener(e, this['_' + e])
    )

    this.select("#file").addEventListener('change', this.upload.bind(this))
  }

  static get observedAttributes() {
    return ['type']
  }

  attributeChangedCallback(name, oldValue, newValue){
    if(name == 'type') {
      const TYPES = {
        image: 'image/*',
        video: 'video/*',
        audio: 'audio/*',
        html: 'zip,application/octet-stream,application/zip,application/x-zip,application/x-zip-compressed'
      }
      this.select('div').innerHTML = `drag ${newValue} here`
      this.select('label').innerHTML = `select ${newValue}`
      this.select('input').setAttribute('accept', TYPES[newValue])
      this.select('#preview')?.remove()
      switch (newValue) {
        case 'image':
          let picture = document.createElement('picture')
          picture.id = 'preview'
          this.shadowRoot.appendChild(picture)
          break
        case 'video':
          let video = document.createElement('video')
          video.toggleAttribute('muted', true)
          video.toggleAttribute('autoplay', true)
          video.toggleAttribute('controls', true)
          video.toggleAttribute('loop', true)
          video.id = 'preview'
          this.shadowRoot.appendChild(video)
      }
    }
  }

  _dragenter(e){
    e.preventDefault()
    this.setAttribute('dragover', '')
  }

  _dragover(e){
    e.preventDefault()
  }

  _dragleave(e){
    this.removeAttribute('dragover', '')
  }

  _drop(e){
    e.preventDefault()
    e.stopPropagation()
    this.select('div').innerHTML = `Uploading ${e.dataTransfer.files[0].name}...`
    this.select('label').innerHTML = ''
    this.select('label').classList.add('uploading')

    let input = this.select('#file')
    input.files = e.dataTransfer.files
    let event = new Event('change')
    input.dispatchEvent(event)
  }

  upload(){
    let data = new FormData()
    let request = new XMLHttpRequest()

    data.append('files', this.select('input').files[0])
    data.append('url', this.closest('form').querySelector('soci-url-input').value)

    request.addEventListener('load', e => {
      this.preview(request.response)
    })

    request.upload.addEventListener('progress', e => {
      var percent_complete = (e.loaded / e.total) * 100
      this.style.setProperty('--upload-progress', `${percent_complete}%`)
    })

    request.open('post', config.IMAGE_HOST + '/upload') 
    request.setRequestHeader('Authorization', 'Bearer ' + this.authToken)
    request.send(data)
  }

  async move(url){
    return new Promise((resolve, reject) => {
      if(this.fileUrl == url) resolve(url)

      let data = new FormData()
      let request = new XMLHttpRequest()

      data.append('oldUrl', this.fileUrl)
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

  get type(){
    return this.getAttribute('type')
  }

  preview(filename){
    this.select('#preview').innerHTML = `
      <source srcset="${config.IMAGE_HOST + '/' + filename}.webp">
      <img src="${config.IMAGE_HOST + '/' + filename}.webp">
    `
    this.toggleAttribute('preview', true)
    this.fileUrl = filename
  }

  get width(){
    return this.select('img').naturalWidth
  }

  get height(){
    return this.select('img').naturalHeight
  }
}