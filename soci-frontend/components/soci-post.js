import SociComponent from './soci-component.js'
import config from '../config.js'

export default class SociPost extends SociComponent {
  constructor() {
    super()
  }

  css(){
    let CONTENT_HEIGHT = 300
    return `
       :host {
        background: var(--bg);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        z-index: 10;
        /* Entrances fade in on --soci-ease-out. The symmetric --soci-ease held
           each of these below perceptible opacity for its first ~18% and needed
           ~70% to reach full, all of it after the response had landed. */
        transition: opacity 0.1s var(--soci-ease-out);
        width: 100%;
        height: 100dvh;
        overflow-x: hidden;
        opacity: 0;
      }

      :host([loaded]) {
        opacity: 1;
      }


      #external-link {
        color: var(--text);
      }

      #external-link:visited {
        color: var(--text-secondary);
      }

      #media-container {
        --media-height: calc(100vh - 100px);
        --media-width: 100%;
      }

      .media {
        opacity: 0;
      }

      :host([loaded]) .media {
        opacity: 1;
        transition: opacity 0.3s var(--soci-ease-out);
        position: relative;
      }

      /* No backdrop here: soci-video is the size of its own picture and carries
         its own black, so painting the wrapper as well put a portrait video in
         a slab twice its width. */
      :host([type="video"]) #video {
        display: block;
      }

      content {
        box-shadow: 0 -2px 0 0 rgba(0,0,0,0.08);
        display: block;
        position: relative;
        background: var(--bg);
        z-index: 10;
      }

      #details-container {
        width: 100%;
        max-width: 840px;
        margin: 0 auto;
      }

      #details {
        margin: 0 auto;
        box-sizing: border-box;
        padding: 12px 18px;
      }

      title-container {
        display: block;
        padding-left: 60px;
        margin-bottom: 12px;
        transform: translateY(20px);
      }

      h1 {
        font-size: 24px;
        line-height: 28px;
        margin-top: -4px;
        font-weight: 400;
        margin-bottom: 0;
        min-height: 28px;
      }

      meta-data {
        display: block;
        margin-top: 4px;
        color: var(--text-secondary);
      }
      meta-data > *:not(:first-child):before,
      #delete:before {
        content: '•';
        display: inline-block;
        margin: 0 1ch 0 0.5ch;
        color: var(--text-tertiary);
      }
      #delete {
        color: var(--text-tertiary);
      }
      #delete span:hover {
        text-decoration: underline;
        cursor: pointer;
      }

      soci-user[username-only] {
        --font-size: 14px;
        --font-weight: 500;
        color: var(--text-brand);
      }

      soci-user[username-only]:hover {
        color: var(--text-brand-hover);
      }

       soci-comment-list {
        display: block;
        border-left: 2px solid rgba(0,0,0,0.08);
        width: 100%;
        box-sizing: border-box;
        position: relative;
      }

       soci-user[avatar-only] {
        --avatar-size: 48px;
        position: absolute;
        left: 0px;
        top: 2px;
      }

       slot[name="description"] {
        opacity: 0;
        display: block;
        transform: translateY(20px);
      }

      ::slotted(soci-markdown-view){
        margin: 12px 0;
        border: 1px solid var(--bg-secondary);
        border-radius: 4px;
        line-height: 1.5;
        display: block;
        padding: 8px 12px 10px;
      }

      slot[name="tags"] {
        opacity: 0;
        transform: translateY(20px);
        display: block;
        position: relative;
        z-index: 1;
      }

      :host([loaded]) title-container,
      :host([loaded]) slot[name="tags"] {
        opacity: 1;
        transition: transform 0.3s cubic-bezier(.15,0,0,1), opacity 0.3s var(--soci-ease-out);
        transform: translateY(0);
      }

      :host([loaded]) slot[name="description"] {
        transition: transform 0.3s cubic-bezier(.15,0,0,1), opacity 0.3s var(--soci-ease-out);
        opacity: 1;
        transform: translateY(0);
      }

      :host([type="blog"][loaded]) slot[name="description"] {
        transition: all 0.35s cubic-bezier(.15,0,.20,1), opacity 0.35s var(--soci-ease-out);
      }

      :host([type="html"]) #media-container {
        background: var(--bg-bold);
      }


      slot[name="comments"] {
        display: block;
        opacity: 0;
        transform: translateY(30px);
      }

      :host([loaded]) slot[name="comments"] {
        opacity: 1;
        transform: translateY(0px);
        transition: all 0.4s cubic-bezier(.15,0,.35,1), opacity 0.4s var(--soci-ease-out);
      }

      #vote-message span {
        color: var(--text-success);
        font-size: 11px;
        transform: translateY(-1px);
        animation: load 0.1s var(--soci-ease) forwards;
        display: inline-block;
      }

      #error {
        color: var(--text-danger);
        font-size: 16px;
        text-align: center;
        margin-top: 40px;
        animation: load 0.2s var(--soci-ease) forwards;
      }

      @keyframes load {
        from {
          transform: translateY(4px);
          opacity: 0;
        }
        to {
          transform: translateY(-1px);
          opacity: 1;
        }
      }

    `
  }

  html(){ 
    return `
    <div id="media-container"></div>
    <content>
      <div id="details-container">
        <div id="details">
          <title-container>
            <a id="external-link"><h1></h1></a>
            <soci-user avatar-only></soci-user>
            <meta-data>
              by <soci-user username-only></soci-user> <time></time>
              <div id="delete" style="display: none;" @click=deletePost><span>delete</span></div>
            </meta-data>
          </title-container>
          <slot name="tags"></slot>
          <slot name="description"></slot>
        </div>
      </div>
      <slot name="comments"></slot>
    </content>
  `}

  static get observedAttributes() {
    return ['post-title', 'score', 'time', 'user', 'thumbnail', 'comments', 'url', 'link']
  }

  connectedCallback(){
    this.addEventListener('scoreChanged', this._scoreChanged)
  }

  attributeChangedCallback(name, oldValue, newValue){
    switch(name) {
      case 'post-title':
        document.title = newValue
        let meta = document.head.querySelector('meta[property="og:title"]')
        if(meta) meta.setAttribute('content', newValue)
        else {
          meta = document.createElement('meta')
          meta.setAttribute('property', 'og:title')
          meta.setAttribute('content', newValue)
          document.head.appendChild(meta)
        }
        this.select('h1').innerHTML = newValue
        break
      case 'time':
        let date = new Date(parseInt(newValue))
        this.select('time').innerHTML = date.toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })
        break
      case 'user':
        this.selectAll('soci-user').forEach(user => user.setAttribute('name', newValue))
        this._checkDeletePermission()
        break
      case 'score':
        this.querySelector('soci-tag-group').setAttribute('score', newValue)
        break
      case 'url':
        this.querySelector('soci-comment-list').setAttribute('url', newValue)
        if(this.community) this.querySelector('soci-comment-list').setAttribute('community', this.community)
        this.loadPost(newValue)
        break
      case 'community':
        if(newValue){
          this.querySelector('soci-comment-list')?.setAttribute('community', newValue)
        } else {
          this.querySelector('soci-comment-list')?.removeAttribute('community')
        }
        break
    }
  }

  loadPost(url) {
    this.toggleAttribute('loaded', false)
    // Back-nav reuses this element, and the previous post's dimensions would
    // otherwise reserve the wrong box for a post that has none of its own.
    this._width = this._height = 0
    this.getData(this._postApiPath(url)).then(post => {
      if(post.error) {
        this.select('#details-container').innerHTML = `<div id="error">${post.error}</div>`
        this.style.opacity = 1
        return
      }
      // Store isEncoding before processing other fields
      let isEncoding = false
      
      for(let key in post) {
        switch(key){
          case 'content':
            this.renderDescription(post[key])
            break
          case 'type':
            this.setAttribute(key, post[key])
            break
          case 'tags':
            this.setAttribute(key, post[key].map(tag=>tag.tag).join(','))
            this.createTags(post[key])
            break
          case 'url':
            this.setMeta('url', post[key])
            break
          case 'link':
            if(post[key] != '') this.select('#external-link').setAttribute('href', post[key])
            break
          case 'width':
          case 'height':
            // Kept for loadContent, which reserves the media box from these
            // before either the thumbnail or the full media is requested.
            this['_' + key] = parseInt(post[key]) || 0
            if(this['_' + key])
              this.select('#media-container').style.setProperty(`--media-${key}`, post[key] + 'px')
            break
          case 'title':
            this.setAttribute('post-title', post[key])
            this.setMeta('title', post[key])
            break
          case 'ID':
            this.setAttribute('post-id', post[key])
            break
          case 'isEncoding':
            isEncoding = post[key]
            this.setAttribute('is-encoding', post[key] ? 'true' : 'false')
            break
          default:
            this.setAttribute(key, post[key])
            break
        }
      }
      
      // Load content after all attributes are set, checking isEncoding
      if(post.type) {
        this.loadContent(post.type, isEncoding)
      }
      
      // Reveal on the next frame rather than after a fixed 100ms. The element
      // has been rendering at opacity 0 for the whole fetch, so its style is
      // already resolved and the entrance transitions still animate; the wait
      // was 100ms of dead time between the response landing and the post
      // becoming visible.
      requestAnimationFrame(()=>{
        this.toggleAttribute('loaded', true)
        this._checkDeletePermission()
      })
    })
  }

  _checkDeletePermission(){
    const author = this.select('soci-user')?.getAttribute('name')
    console.log(author)
    
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
        window.location.href = '/'
        window.history.pushState(null, null, '/')
        break
      case 'cancel':
        dom.innerHTML = `<span>delete</span>`
        break
    }
  }

  loadContent(type, isEncoding = false) {
    this.querySelector('soci-tag-group')?.setAttribute('format', type)
    document.head.querySelector(`meta[property="og:image"]`)?.remove()
    switch(type){
      case 'link':
        // test if thumbnail exists, if so populate the image
        let test = document.createElement('img')
        test.src = `${config.THUMBNAIL_HOST}/${this.url}.webp`
        test.onload = () => {
          this.setImage()
        }
        break
      case 'image':
        this.setImage()
        break
      case 'video':
        // Check if video is still encoding
        // If isEncoding parameter is explicitly passed (not undefined), use it
        // Otherwise fall back to attribute
        const encoding = isEncoding !== undefined ? isEncoding : (this.getAttribute('is-encoding') === 'true')
        console.log('[SociPost] loadContent video, encoding:', encoding, 'isEncoding param:', isEncoding, 'attribute:', this.getAttribute('is-encoding'))
        if(encoding) {
          // Only show encoding progress if we don't already have a video element
          const existingVideo = this.select('#video')
          const existingProgress = this.select('soci-encoding-progress')
          console.log('[SociPost] Existing video element:', existingVideo, 'Existing progress:', existingProgress)
          if(!existingVideo) {
            console.log('[SociPost] No video element, showing encoding progress')
            this.showEncodingProgress()
          } else {
            console.log('[SociPost] Video element already exists, not showing encoding progress')
          }
        } else {
          console.log('[SociPost] Encoding complete, loading video')
          // Close any existing encoding WebSocket connection
          if(this._encodingWebSocket) {
            console.log('[SociPost] Closing existing WebSocket connection')
            this._encodingWebSocket.close()
            this._encodingWebSocket = null
          }
          // Clear any encoding progress widget
          this.select('#media-container').innerHTML = ''
          this.select('#media-container').innerHTML = `
            <div id="video" class="media">
              <soci-video ${this._mediaSize()}></soci-video>
            </div>
          `
          this.select('soci-video').url = this.url
        }
        break
      case 'html':
        this.setAttribute('type', 'html')
        this.select('#media-container').innerHTML = `<soci-html-page src="${this.getAttribute('url')}"></soci-html-page>`
        break
    }
  }

  setImage(){
    this.setMeta('image', `${config.IMAGE_HOST}/${this.url}.webp`)
    this.select('#media-container').innerHTML = `<soci-image ${this._mediaSize()} url="${this.url}"></soci-image>`
  }

  // Stored post dimensions, for whichever media component is about to mount.
  // They let it reserve the right box up front; without them it has to wait and
  // measure the thumbnail instead.
  _mediaSize(){
    return this._width && this._height ? `width="${this._width}" height="${this._height}"` : ''
  }

  setMeta(property, value){
    let meta = document.head.querySelector(`meta[property="og:${property}"]`)
    if(!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('property', `og:${property}`)
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', value)
  }

  createTags(tags){
    let tagContainer = this.querySelector('soci-tag-group')
    tagContainer.innerHTML += tags.map((tag) => `<soci-tag tag="${tag.tag}" score="${tag.score}" tag-id="${tag.tagID}" ${soci.votes[this.getAttribute('post-id')]?.includes(tag.tagID) ? 'upvoted':''}></soci-tag>`).join('')
  }

  renderDescription(description){
    let dom = this.querySelector('soci-markdown-view[slot="description"]')
    if(!dom){
      dom = document.createElement('soci-markdown-view')
      dom.setAttribute('slot', 'description')
      this.appendChild(dom)
    }
    dom.render(description)
    this.setMeta('description', dom.textContent)
  }

  get url(){
    return this.getAttribute('url')
  }

  get community(){
    return this.getAttribute('community') || window.soci.routeContext.community || ''
  }

  _postApiPath(urlOverride){
    const slug = urlOverride || this.url
    return this.community ? `/posts/@${this.community}/${slug}` : `/posts/${slug}`
  }

  _scoreChanged(e){
    if(this.querySelector('soci-tag-group')?.hasAttribute('upvoted')){
      this.select('meta-data').innerHTML += '<span id="vote-message">&nbsp;| &nbsp;<span>Contributing one share of your subscription at the end of the month</span></span>'
    }
    else {
      this.select('meta-data #vote-message')?.remove()
    }
  }

  showEncodingProgress(){
    console.log('[SociPost] showEncodingProgress called')
    // Don't show encoding progress if we already have it displayed
    const existing = this.select('soci-encoding-progress')
    if(existing) {
      console.log('[SociPost] Encoding progress already displayed, skipping')
      return
    }
    
    console.log('[SociPost] Creating encoding progress widget')
    // Use the reusable encoding progress component
    this.select('#media-container').innerHTML = `<soci-encoding-progress></soci-encoding-progress>`
    
    // Connect to WebSocket for real-time encoding progress
    this.connectToEncodingProgress()
  }

  connectToEncodingProgress(){
    console.log('[SociPost] connectToEncodingProgress called, url:', this.url)
    // Don't create multiple connections
    if(this._encodingWebSocket) {
      console.log('[SociPost] WebSocket already exists, skipping connection')
      return
    }
    
    let protocol = config.VIDEO_HOST.match(/^https/) ? 'wss' : 'ws'
    let server = config.VIDEO_HOST.replace(/(^\w+:|^)\/\//, '')
    const encodingProgress = this.select('soci-encoding-progress')
    console.log('[SociPost] Encoding progress element:', encodingProgress)
    
    const wsUrl = `${protocol}://${server}/encode?url=${this.url}`
    console.log('[SociPost] Connecting to WebSocket:', wsUrl)
    // Connect using the post URL instead of temp filename
    this._encodingWebSocket = new WebSocket(wsUrl)
    const conn = this._encodingWebSocket
    
    conn.addEventListener('open', e => {
      console.log('[SociPost] WebSocket connection opened')
    })
    
    conn.addEventListener('close', e => {
      console.log('[SociPost] WebSocket connection closed, code:', e.code, 'reason:', e.reason)
      this._encodingWebSocket = null
      
      // Check if the close was due to an error (like "No encoding session found")
      // If so, encoding is definitely complete
      const wasError = e.code === 1006 || e.reason?.includes('Error')
      
      // Encoding complete - reload the post content
      // Add a small delay to ensure backend has updated isEncoding status
      console.log('[SociPost] Waiting 500ms before checking encoding status...')
      setTimeout(() => {
        console.log('[SociPost] Checking post encoding status...')
        this.getData(this._postApiPath()).then(post => {
          console.log('[SociPost] Post data received, isEncoding:', post.isEncoding)
          // If encoding is false OR we got an error from WebSocket, load the video
          if(!post.isEncoding || wasError) {
            console.log('[SociPost] Encoding complete, clearing widget and loading video')
            // Clear the encoding progress widget before loading video
            this.select('#media-container').innerHTML = ''
            // Explicitly pass false to prevent checking attribute
            this.loadContent('video', false)
          } else {
            console.log('[SociPost] Post still encoding, not loading video yet')
          }
        }).catch(err => {
          console.error('[SociPost] Error fetching post data:', err)
          // If request fails, still try to load content
          console.log('[SociPost] Loading video anyway due to error')
          this.select('#media-container').innerHTML = ''
          // Explicitly pass false to prevent checking attribute
          this.loadContent('video', false)
        })
      }, 500)
    })
    
    conn.addEventListener('message', e => {
      console.log('[SociPost] WebSocket message received:', e.data)
      let message = e.data.split(':')
      if(message[0] == 'resolution'){
        let resolution = message[1].split('x')
        const width = parseInt(resolution[0])
        const height = parseInt(resolution[1])
        console.log('[SociPost] Resolution message:', width, 'x', height)
        
        // Update encoding progress component
        if(encodingProgress) {
          encodingProgress.setResolution(width, height)
        } else {
          console.warn('[SociPost] Encoding progress element not found when updating resolution')
        }
      }
      else if(message[0].match(/source|480p|720p|1080p|1440p|4k/)){
        console.log('[SociPost] Progress update:', message[0], '=', message[1])
        // Update progress in encoding progress component
        if(encodingProgress) {
          encodingProgress.updateProgress(message[0], message[1])
        } else {
          console.warn('[SociPost] Encoding progress element not found when updating progress')
        }
      } else {
        console.log('[SociPost] Unknown message type:', message[0])
      }
    })
    
    conn.addEventListener('error', e => {
      console.error('[SociPost] WebSocket error:', e)
      this._encodingWebSocket = null
      // Fallback to polling if WebSocket fails
      this.checkEncodingStatus()
    })
  }

  checkEncodingStatus(){
    // Fallback polling method if WebSocket fails
    const checkInterval = setInterval(() => {
      this.getData(this._postApiPath()).then(post => {
        if(!post.isEncoding) {
          // Encoding is complete, reload the post content
          clearInterval(checkInterval)
          this.loadContent('video', false)
        }
      }).catch(() => {
        clearInterval(checkInterval)
      })
    }, 2000) // Check every 2 seconds

    // Stop checking after 5 minutes to avoid infinite polling
    setTimeout(() => {
      clearInterval(checkInterval)
    }, 300000)
  }
}
