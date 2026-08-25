import NonioComponent from './nonio-component.js'
import config from '../config.js'

export default class NonioHTMLUploader extends NonioComponent {
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
        max-width: 920px;
        margin: 0 auto;
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
      :host([state="uploading"]),
      :host([state="preview"]) { border: 2px dashed var(--bg-brand); }
      :host([state="preview"]) {
        min-height: 0;
        transition: all 0.2s ease-in-out;
        border-radius: 0px;
        overflow: hidden;
        max-width: 100%;
        border: 0;
        border-top: 1px solid var(--bg-secondary);
        border-bottom: 1px solid var(--bg-secondary);
        padding: 24px 0;
        background: var(--bg-bold);
        &::before { opacity: 0; transition: all 0.2s ease-in-out; }
      }
      :host([state="preview"]) label,
      :host([state="preview"]) div { display: none; }
      :host([state="preview"]) #preview { display: block; }
      :host([state="preview"]) #uploading { display: none; }
      #uploading { display: flex; flex-direction: column; align-items: center; }
      .info { font-weight: 500; color: var(--text-secondary); margin-bottom: 12px; mix-blend-mode: multiply; text-align: center; }
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
          border-color: var(--bg-brand);
          &::after {
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
        }
      }
      #preview { max-width: 100%; display: none; }
      input { display: none; }
    `
  }

  html(){ return `
    <div id="uploading">
      <div class="info">drag files or a .zip here</div>
      <label for="file">select files or .zip</label>
      <input id="file" type="file" name="files" multiple accept=".html,.htm,.css,.js,.zip,application/zip,application/x-zip-compressed,text/html,text/css,text/javascript,application/javascript,image/*"/>
    </div>
    <nonio-html-page id="preview"></nonio-html-page>
  `}

  connectedCallback(){
    ['dragenter', 'dragleave', 'dragover', 'drop'].forEach(
      e => this.addEventListener(e, this['_' + e])
    )

    this.select("#file").addEventListener('change', this.upload.bind(this))
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
    if(!this.files) {
      this.files = this.select('input')?.files
      console.log(this.files)
    }
    this.setAttribute('state', 'uploading')
    this.select('#uploading .info').innerHTML = `Uploading ${this.files.length} file${this.files.length == 1 ? '' : 's'}...`
    this.select('label').innerHTML = ''
    this.select('label').classList.add('uploading')
    let data = new FormData()
    let request = new XMLHttpRequest()

    let files = e.target.files
    for (let i = 0; i < files.length; i++) {
      data.append('files', files[i])
    }

    data.append('url', this.closest('form').querySelector('nonio-url-input').value)

    request.addEventListener('error', () => {
      this.setAttribute('state', 'uploading')
      this.select('#uploading .info').innerHTML = 'Upload failed. Check that your upload includes index.html or a valid .zip.'
      this.select('label').innerHTML = 'select files or .zip'
      this.select('label').classList.remove('uploading')
    })

    request.addEventListener('load', e => {
      if(request.status < 200 || request.status >= 300) {
        this.setAttribute('state', 'uploading')
        this.select('#uploading .info').innerHTML = request.response || 'Upload failed.'
        this.select('label').innerHTML = 'select files or .zip'
        this.select('label').classList.remove('uploading')
        return
      }
      setTimeout(()=>{
        this.setAttribute('state', 'preview')
        console.log(request.response)
        this.fileUrl = request.response
        this.select('nonio-html-page').setAttribute('src', 'temp/' + request.response)
      }, 400)
    })

    request.upload.addEventListener('progress', e => {
      var percent_complete = (e.loaded / e.total) * 100
      this.style.setProperty('--upload-progress', `${percent_complete}%`)
    })

    request.open('post', `${config.HTML_HOST}/upload`) 
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

      request.open('post', config.HTML_HOST + '/move')
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