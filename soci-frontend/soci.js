import config from './config.js'
import api from './api.js'
import SociRouteContext from './lib/soci-route-context.js'

let soci = {
  init: () => {
    soci.checkTokenExpired()
  },
  routeContext: SociRouteContext,
  _tokenValid: (token) => {
    if(!token) return false
    try {
      const expiry = parseInt(JSON.parse(atob(token.split('.')[1])).expiresAt)
      return expiry > Date.now() / 1000
    }
    catch {
      return false
    }
  },
  isLoggedIn: () => soci._tokenValid(soci.accessToken),
  _ensureLoginRequiredModal: () => {
    let modal = document.querySelector('soci-modal#login-required-modal')
    if(modal) return modal

    modal = document.createElement('soci-modal')
    modal.id = 'login-required-modal'
    modal.setAttribute('title', 'Login required')
    modal.innerHTML = `
      <p id="login-required-message"></p>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
        <soci-button id="login-required-login">Login</soci-button>
        <soci-button subtle id="login-required-close">Close</soci-button>
      </div>
    `
    document.body.appendChild(modal)

    modal.querySelector('#login-required-close')?.addEventListener('click', () => modal.deactivate())
    modal.querySelector('#login-required-login')?.addEventListener('click', () => {
      modal.deactivate()
      document.querySelector('soci-sidebar')?.showLogin?.()
    })

    return modal
  },
  requireLogin: (action = 'do that') => {
    if(soci.isLoggedIn()) return true
    const modal = soci._ensureLoginRequiredModal()
    modal.querySelector('#login-required-message').textContent = `You need to be logged in to ${action}.`
    modal.activate()
    return false
  },
  get accessToken() {
    return localStorage.getItem('accessToken')
  },
  set accessToken(val) {
    localStorage.setItem('accessToken', val)
  },
  get refreshToken() {
    return localStorage.getItem('refreshToken')
  },
  set refreshToken(val) {
    localStorage.setItem('refreshToken', val)
  },
  get roles() {
    let roles = localStorage.getItem('roles')
    if(!roles) return []
    return roles.split(',')
  },
  set roles(val) {
    localStorage.setItem('roles', val)
  },
  get stripe(){
    if("Stripe" in window) return Stripe(config.STRIPE_PUBLISHABLE_KEY)

    let stripe = document.createElement('script')
    stripe.src = 'https://js.stripe.com/v3/'
    return new Promise(resolve =>{
      stripe.onload = ()=>{
        resolve(Stripe(config.STRIPE_PUBLISHABLE_KEY))
      }
      document.head.appendChild(stripe)
    })
  },
  refreshAccessToken: () => {
    api.user.refreshAccessToken(soci.refreshToken).then(res=>{
      soci.accessToken = res.accessToken
      soci.refreshToken = res.refreshToken
    })
  },
  clearToken: () => {
    localStorage.clear()
  },
  checkTokenExpired: () => {
    if(soci._tokenValid(soci.accessToken)) return false
    if(soci._tokenValid(soci.refreshToken)) {
      soci.refreshAccessToken()
      return false
    }
    soci.clearToken()
    return true
  },
  get username() {
    return localStorage.getItem('username')
  },
  set username(val) {
    localStorage.setItem('username', val)
    let e = new CustomEvent('username-updated', {detail: {username: val}})
    document.dispatchEvent(e)
  },
  registerPage: page => {
    if(page.onActivate) page.dom.addEventListener('routeactivate', page.onActivate)
    if(page.onDeactivate) page.dom.addEventListener('routedeactivate', page.onDeactivate)
    if(page.dom.active) page.onActivate()
  },
  getJSONFromForm: form => {
    let data = new FormData(form)
    let json = {}
    for(const [key, val] of data.entries()) {
      json[key] = val
    }
    return json
  },
  postData: async (url, data) => {
    return await api.postData(url, data)
  },
  getData: async (url) => {
    return await api.getData(url)
  },
  log(message, details, type){
    let color = ['deebff', '0747ac']
    if(type == 'warning') color = ['fffae5', 'ee6900']
    if(type == 'error') color = ['ffbdad', 'bf2600']
    let name = 'system message'
    let groupLabel = `%csoci%c${name}%c${message}`
    let style = ['padding:4px 8px;border-radius: 3px 0 0 3px;background:#0052cc;color:#fff','padding: 4px 8px;background:#4c9aff;color:#172b4d;', `padding: 4px 8px;border-radius:0 3px 3px 0;background:#${color[0]};color:#${color[1]};border-left:1px solid #${color[1]}`]
    console.group(groupLabel, style[0], style[1], style[2])
    console.info(details)
    console.groupEnd(groupLabel)
  },

  votes: {},
  loadVotes() {
    api.votes.get().then(res=>{
      let votes = {}
      res.votes.forEach(vote => {
        if(!votes[vote.postID]) votes[vote.postID] = []
        votes[vote.postID].push(vote.tagID)
      })
      soci.votes = votes
    })
  },
  animateSidebar() {
    let pages = document.querySelector('#pages')

    pages.style.transition = 'all 0.2s var(--soci-ease)'
    setTimeout(()=>{
      pages.style.transition = ''
    }, 200)
  },
  showRegister() {
    soci.animateSidebar()
    document.body.toggleAttribute('noauth', false)
    document.querySelector('soci-sidebar')?.showCreateAccount?.()
  },
  showLogin() {
    soci.animateSidebar()
    document.body.toggleAttribute('noauth', false)
    document.querySelector('soci-sidebar')?.showLogin?.()
  },
  setAnimationTimings(){
    let root = document.documentElement
    root.style.setProperty('--anim-duration-short', '0.1s')
    root.style.setProperty('--anim-duration-med', '0.2s')
    root.style.setProperty('--anim-duration-long', '0.4s')
  },
  handlePaste(e) {
    if (e.defaultPrevented) return
    const pathname = window.location.pathname || ''
    if (/^\/@[\w-]+:[^/]+$/.test(pathname)) return
    const path = e.composedPath ? e.composedPath() : []
    const isTextChannelPaste = path.some((node) => node?.tagName === 'SOCI-TEXT-CHANNEL-VIEW')
    if (isTextChannelPaste) return

    const clipboardData = e.clipboardData || window.clipboardData
    if (!clipboardData) return

    // Check for image first
    const items = Array.from(clipboardData.items)
    const imageItem = items.find(item => item.type.indexOf('image') !== -1)

    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (file) {
        soci.navigateToSubmit({ type: 'Image', value: file })
        return
      }
    }

    // If not an image, check if paste is text and only proceed if not in an input etc.
    const text = clipboardData.getData('text/plain')
    if (text) {
      const target = e.target
      const activeElement = document.activeElement

      // Check if target is a standard input element
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Check if the active/focused element is an input (covers shadow DOM inputs)
      if (activeElement) {
        if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable) {
          return
        }

        // Check if active element is a custom input component
        if (activeElement.tagName && activeElement.tagName.startsWith('SOCI-') && 
            (activeElement.tagName.includes('INPUT') || activeElement.tagName.includes('EDITOR'))) {
          return
        }
      }

      // Check if target is inside a shadow root of a custom input component
      const root = target.getRootNode ? target.getRootNode() : target.ownerDocument
      if (root && root.host) {
        const host = root.host
        if (host.tagName && host.tagName.startsWith('SOCI-') && 
            (host.tagName.includes('INPUT') || host.tagName.includes('EDITOR'))) {
          return
        }
      }

      const trimmedText = text.trim()
      // Simple URL detection - check if it looks like a URL
      try {
        const url = new URL(trimmedText)
        // Only handle http/https URLs
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          e.preventDefault()
          soci.navigateToSubmit({ type: 'Link', value: trimmedText })
          return
        }
      } catch (e) {
        // Not a valid URL, ignore
      }
    }
  },
  navigateToSubmit(data) {
    const { type, value } = data
    const submitRoute = document.querySelector('soci-route#submit')
    const isOnSubmitPage = submitRoute && submitRoute.active && window.location.pathname === '/submit'
    
    const setupContent = async () => {
      const tabGroup = submitRoute.querySelector('soci-tab-group')
      if (!tabGroup) return

      await tabGroup.activateTab(type)

      let component = type === 'Image'
        ? submitRoute.querySelector('soci-image-uploader')
        : type === 'Link'
        ? submitRoute.querySelector('soci-link-input')
        : null;
      
      if (type === 'Image') {
        const fileInput = component.shadowRoot.querySelector('input#file')
        if (fileInput) {
          // Use DataTransfer to create a FileList
          const dataTransfer = new DataTransfer()
          dataTransfer.items.add(value)
          fileInput.files = dataTransfer.files
          
          // Trigger the change event to start upload
          const changeEvent = new Event('change', { bubbles: true })
          fileInput.dispatchEvent(changeEvent)
        }
      } else if (type === 'Link') {
        // Set the URL in the link input
        component.value = value
        // Trigger input event to validate
        const input = component.shadowRoot.querySelector('input')
        if (input) {
          const inputEvent = new Event('input', { bubbles: true })
          input.dispatchEvent(inputEvent)
        }
      }
    }

    // If already on submit page, set up content directly
    if (isOnSubmitPage) {
      setupContent()
    }
    else {
      window.history.pushState(null, null, '/submit')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      
      submitRoute.addEventListener('routeactivate', () => {
        setupContent()
      }, { once: true })
    }
  }
}

if(!soci.checkTokenExpired()) {
  soci.loadVotes()
}
else {
  //document.body.toggleAttribute('noauth', true)
}

window.soci = soci
window.config = config
document.addEventListener('DOMContentLoaded', soci.init)
window.addEventListener('load', soci.setAnimationTimings)
document.addEventListener('paste', soci.handlePaste)