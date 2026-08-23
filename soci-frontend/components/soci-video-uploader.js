import SociComponent from './soci-component.js'
import config from '../config.js'

export default class SociVideoUploader extends SociComponent {
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
      }

      :host([dragover]) {
        border: 2px dashed var(--bg-success);
        transition: border 0.1s ease-out;
      }

      :host:before {
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

      :host([dragover]):before {
        opacity: 0.1;
        transition: opacity 0.1s ease-out;
        z-index: -1;
      }

      :host([state="uploading"]),
      :host([state="encoding"]) {
        border: 2px dashed var(--bg-brand);
      }

      #uploading {
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .info {
        font-weight: 500;
        color: var(--text-secondary);
        margin-bottom: 12px;
        mix-blend-mode: multiply;
        text-align: center;
      }

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
      }
      label:hover {
        background: var(--bg-brand-hover);
        border-color: var(--bg-brand-hover);
      }
      label:active {
        background: var(--bg-brand-active);
        border-color: var(--bg-brand-active);
      }
      label.uploading {
        height: 8px;
        transition: all 0.1s ease-in-out;
        background: var(--bg);
        border-color: var(--bg-brand);
      }
      label.uploading:after {
        content: '';
        display: block;
        position: absolute;
        top: 0;
        left: 0;
        height: 8px;
        width: var(--upload-progress);
        transition: width 0.3s linear;
        background: var(--bg-brand);
      }
      :host([state="preview"]) {
        min-height: 0;
        border-color: transparent;
        transition: all 0.2s ease-in-out;
        overflow: hidden;
      }
      :host([state="preview"]):before {
        opacity: 0;
        transition: all 0.2s ease-in-out;
      }
      :host([state="preview"]) label,
      :host([state="preview"]) div {
        display: none;
      }
      #preview {
        max-width: 100%;
        display: none;
      }
      :host([state="preview"]) #preview {
        display: block;
      }
      input {
        display: none;
      }
      #encoding {
        display: none;
      }
      :host([state="encoding"]) #encoding {
        display: block;
      }
      :host([state="encoding"]) #uploading {
        display: none;
      }

    `
  }

  html(){ return `
    <div id="uploading">
    <div class="info">drag video here</div>
    <label for="file">select video</label>
    <input id="file" type="file" accept="video/*"/>
    <video id="preview" muted autoplay controls loop></video>
    </div>
    <div id="encoding">
      <soci-encoding-progress></soci-encoding-progress>
    </div>
  `}

  connectedCallback(){
    ['dragenter', 'dragleave', 'dragover', 'drop'].forEach(
      e => this.addEventListener(e, this['_' + e])
    )

    this.select("#file").addEventListener('change', this.upload.bind(this))
    this.encode = this.encode.bind(this)
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
    this.removeAttribute('dragover', '')
    e.preventDefault()
    e.stopPropagation()

    let input = this.select('#file')
    input.files = e.dataTransfer.files
    this.filename = e.dataTransfer.files[0].name
    let event = new Event('change')
    input.dispatchEvent(event)
  }

  upload(e){
    if(!this.filename) {
      this.filename = this.select('input')?.files[0]?.name
      console.log(this.filename)
    }
    this.setAttribute('state', 'uploading')
    this.select('#uploading .info').innerHTML = `Uploading ${this.filename}...`
    this.select('label').innerHTML = ''
    this.select('label').classList.add('uploading')
    let data = new FormData()
    let request = new XMLHttpRequest()

    data.append('files', this.select('input').files[0])
    data.append('url', this.closest('form').querySelector('soci-url-input').value)

    request.addEventListener('load', e => {
      this.fileUrl = request.response.slice(0, -4)
      // Set fileUrl immediately so move() can work
      // Start encoding and show the encoding progress UI
      // User can still submit while encoding is in progress
      this.setAttribute('state', 'encoding')
      // Start encoding
      setTimeout(()=>{
        this.encode(request.response)
      }, 400)
    })

    request.upload.addEventListener('progress', e => {
      var percent_complete = (e.loaded / e.total) * 100
      this.style.setProperty('--upload-progress', `${percent_complete}%`)
    })

    request.open('post', `${config.VIDEO_HOST}/upload`) 
    request.setRequestHeader('Authorization', 'Bearer ' + this.authToken)
    request.send(data)
  }

  async encode(filename){
    let protocol = config.VIDEO_HOST.match(/^https/) ? 'wss' : 'ws'
    let server = config.VIDEO_HOST.replace(/(^\w+:|^)\/\//, '')
    var conn = new WebSocket(`${protocol}://${server}/encode?file=${filename}`);
    
    // Helper to get encoding progress component
    const getEncodingProgress = () => {
      return this.select('soci-encoding-progress')
    }
    
    conn.addEventListener('close', e => {
      // Encoding complete - update video source if we have resolution info
      if(this.equivalentResolution) {
        let previewResolution = this.equivalentResolution.match(/480p|720p/) ? '' : '-720p'
        let video = this.select('#preview')
        if(video) {
          video.setAttribute('src', `${config.VIDEO_HOST}/${filename.slice(0, -4)}${previewResolution}.mp4`)
        }
      }
      // Switch to preview state to show the video
      setTimeout(()=> {
        this.setAttribute('state', 'preview')
      }, 500)
    })
    conn.addEventListener('message', e => {
      let message = e.data.split(':')
      if(message[0] == 'resolution'){
        let resolution = message[1].split('x')
        this.videoWidth = parseInt(resolution[0])
        this.videoHeight = parseInt(resolution[1])
        resolution = Math.max(this.videoWidth, this.videoHeight)
        this.equivalentResolution = '480p'
        
        // Update encoding progress component
        const encodingProgress = getEncodingProgress()
        if(encodingProgress) {
          encodingProgress.setResolution(this.videoWidth, this.videoHeight)
        }
      }
      else if(message[0].match(/source|480p|720p|1080p|1440p|4k/)){
        // Update progress in encoding progress component
        const encodingProgress = getEncodingProgress()
        if(encodingProgress) {
          encodingProgress.updateProgress(message[0], message[1])
        }
      }
    })
  }

  time = 0

  async move(url){
    let UPLOAD_HOST = this.type == 'image' ? config.IMAGE_HOST : config.VIDEO_HOST
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

      request.open('post', UPLOAD_HOST + '/move')
      request.setRequestHeader('Authorization', 'Bearer ' + this.authToken)
      request.send(data)
    })
  }

  get type(){
    return this.getAttribute('type')
  }

  get width(){
    return this.videoWidth
  }

  get height(){
    return this.videoHeight
  }
}