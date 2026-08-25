import NonioComponent from './nonio-component.js'
import config from '../config.js'
import nonioModalManager from './modals/nonio-modal-manager.js'

export default class NonioSidebar extends NonioComponent {
  constructor() {
    super()
    this._onAvatarUpdate = this._onAvatarUpdate.bind(this)
    this._onCommunityUpdate = this._onCommunityUpdate.bind(this)
    this._onToggleAuth = this._toggleAuth.bind(this)
    this._onRouteChange = this._onRouteChange.bind(this)
    this._onSidebarClick = this._onSidebarClick.bind(this)
  }

  css(){
    // Styling is now sourced from soci-frontend/nonio.css (light-DOM sidebar markup)
    // Exception: mobile header is in shadow DOM
    return `
      #mobile-header {
        display: none;
        position: absolute;
        top: 0;
        left: 8px;
        height: 40px;
        align-items: center;
        z-index: 11;
      }
      #mobile-header nonio-icon {
        cursor: pointer;
        border-radius: 3px;
      }
      #mobile-header nonio-icon:hover {
        background-color: var(--bg-secondary);
      }
      @media (max-width: 768px) {
        :host([overlay]) #mobile-header {
          display: flex;
        }
      }
    `
  }

  html(){
    return `
      <div id="mobile-header">
        <nonio-icon glyph="menu" @click=_closeMobileOverlay></nonio-icon>
      </div>
      <slot></slot>
    `
  }

  // This component is now primarily light-DOM; query from the host instead of shadowRoot.
  select(s){
    return this.querySelector(s)
  }

  selectAll(s){
    return this.querySelectorAll(s)
  }

  get currentCommunity() {
    return window.nonio.routeContext.community
  }

  static get observedAttributes() {
    return ['view']
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if(name === 'view' && oldValue !== newValue) this._syncPanels()
  }

  _setView(view) {
    if(view) this.setAttribute('view', view)
    else this.removeAttribute('view')
  }

  setView(view) {
    this._setView(view)
  }

  showLogin() {
    nonioModalManager.open('login')
  }

  showCreateAccount() {
    nonioModalManager.open('createAccount')
  }

  showCreateCommunity() {
    nonioModalManager.open('createCommunity')
  }

  needsLogin() {
    // Visual nudge: user stays on community view; user-section "Login / Signup" is the explicit entry point.
    this.removeAttribute('needs-login')
    this.setAttribute('needs-login', '')
    setTimeout(() => this.removeAttribute('needs-login'), 900)
  }

  showCommunity() {
    this._setView('community')
  }

  _syncPanels() {
    const view = this.getAttribute('view') || 'community'
    this.querySelectorAll('[panel]').forEach(p => {
      p.toggleAttribute('active', p.getAttribute('panel') === view)
    })
  }

  _onLoggedIn(response) {
    if(!response?.accessToken) return
    window.nonio.accessToken = response.accessToken
    if(response.refreshToken) window.nonio.refreshToken = response.refreshToken
    if(response.username) window.nonio.username = response.username
    if(response.roles) window.nonio.roles = response.roles

    this._loadCommunities()
    this._loadCommonTags()
    this._loadSubscribedTags()
    window.nonio.loadVotes?.()
    this._syncAuthUI()
    this._startVoicePresenceSocket('auth')

    this.showCommunity()
  }

  async connectedCallback(){
    this.toggleAttribute('loading', false)

    // Default view is always "community" (even when logged out).
    // Login panel is only shown via footer "Login" action or explicit showLogin().
    if(!this.hasAttribute('view')) this.showCommunity()
    this._syncPanels()

    // Always load public data
    this._loadCommunities()

    // Tags: common tags are public; subscribed tags require auth.
    if(this.authToken) {
      this._loadSubscribedTags()
    } else {
      this._subscribedTags = []
      this._subscribedTagsLoaded = true
      this._toggleSubscribedTagsVisible(false)
    }
    this._loadCommonTags()

    this._syncAuthUI()

    if(!this._eventsBound) {
      // Event delegation (panels re-render; avoid rebinding per activation)
      this.addEventListener('click', this._onSidebarClick)
      this._eventsBound = true
    }
    
    // Update submit button href based on current route
    window.addEventListener('hashchange', this._onRouteChange)
    window.addEventListener('popstate', this._onRouteChange)
    window.addEventListener('link', this._onRouteChange)
    window.addEventListener('auth-login', (e) => this._onLoggedIn(e.detail))
    window.addEventListener('auth-signup', (e) => this._onLoggedIn(e.detail))
    window.addEventListener('community-created', () => this._loadCommunities())
    window.addEventListener('channel-created', (e) => {
      this._loadChannels()
      if (e.detail?.kind === 'text' && e.detail?.slug) this.openTextChannel(e.detail.slug)
    })
    document.addEventListener('avatar-updated', this._onAvatarUpdate)
    document.addEventListener('community-updated', this._onCommunityUpdate)

    // Set initial routes and community details
    setTimeout(() => this._onRouteChange(), 0)
  }

  disconnectedCallback(){
    window.removeEventListener('hashchange', this._onRouteChange)
    window.removeEventListener('popstate', this._onRouteChange)
    window.removeEventListener('link', this._onRouteChange)
    // We can leave anonymous listeners as they will be GC'd with the window/element
    // but cleaner to remove if we bound them. Since we used arrow functions in addEventListener above, 
    // we can't easily remove them unless we bind them. 
    // Given nonio-sidebar is a singleton that persists, this is acceptable.
    document.removeEventListener('avatar-updated', this._onAvatarUpdate)
    document.removeEventListener('community-updated', this._onCommunityUpdate)
    this._stopVoicePresenceSocket('disconnected-callback')
  }

  _nextFrame(){
    return new Promise(resolve => requestAnimationFrame(resolve))
  }

  _computeCommunityDescriptionHeight(mdView){
    const mdHidden = !mdView || mdView.style.display === 'none'
    const mdH = mdHidden ? 0 : mdView.getBoundingClientRect().height
    return Math.ceil(mdH + 8)
  }

  _onRouteChange() {
    this._userRouteState = this._resolveUserRouteState()
    if(this._userRouteState) this.setView('user')
    else if(this.getAttribute('view') === 'user') this.setView('community')
    this._notifyUserPanelRouteState()
    this._updateLinks()
    this._checkCommunityChange()
    this._syncActiveChannelFromHash()
    const path = window.location.pathname || ''
    if(/^\/@[\w-]+\/admin(?:\/|$)/.test(path)) this._setActiveNavItem('community-settings')
    // Activate submit nav item if on submit route
    else if(/\/submit\/?$/.test(path)) this._setActiveNavItem('submit')
    else this._setActiveNavItem('none')
    // Re-apply user panel nav state after _setActiveNavItem (which clears all nonio-tag-li[active])
    if(this._userRouteState) this._notifyUserPanelRouteState()
  }

  // Sentinel so the first _checkCommunityChange() always runs on initial load,
  // even when currentCommunity is null/undefined (Nonio/frontpage).
  _lastCommunity = '__init__'
  _userRouteState = null
  _communities = []
  _communitiesLoaded = false

  _resolveUserRouteState() {
    const path = window.location.pathname || ''
    const userMatch = path.match(/^\/user\/([^/]+)\/?$/)
    if(userMatch) {
      const username = decodeURIComponent(userMatch[1] || '')
      if(!username) return null
      return {
        username,
        section: window.location.hash === '#comments' ? 'comments' : 'posts'
      }
    }

    const adminMatch = path.match(/^\/admin\/(settings|financials)\/?$/)
    if(adminMatch) {
      const username = window.nonio?.username || ''
      if(!username) return null
      return {
        username,
        section: adminMatch[1]
      }
    }
    return null
  }

  _notifyUserPanelRouteState() {
    this.querySelector('#user-panel')?.setRouteState?.(this._userRouteState)
  }

  _checkCommunityChange() {
    let community = this.currentCommunity
    if(this._lastCommunity === community) return

    if(this._voiceRoom && this._voiceCommunity !== community) this._voiceDisconnect()
    this._lastCommunity = community
    if(this.authToken) this._loadSubscribedTags()
    this._loadCommonTags()
    this._updateCommunitySelection(community)
    this._updateCommunityAvatar(community)
    this._toggleCommunityHeaderVisible(community)
    this._toggleVoiceChannelsVisible(community)
    this._populateCommunityDetails()
    this._loadChannels()
    this._startVoicePresenceSocket('community-change')
    this._syncActiveChannelFromHash()
  }

  _syncActiveChannelFromHash(){
    const path = window.location.pathname || ''
    const m = path.match(/^\/@([\w-]+):([^/]+)$/)
    if(!m) {
      this._setActiveTextChannelInList(null)
      return
    }
    const routeCommunity = m[1]
    const routeChannel = decodeURIComponent(m[2] || '')
    if(routeCommunity !== this.currentCommunity) {
      this._setActiveTextChannelInList(null)
      return
    }
    this._setActiveTextChannelInList(routeChannel)
  }

  _toggleVoiceChannelsVisible(communityUrl){
    const section = this.select('#voice-channels')
    if(!section) return
    section.style.display = communityUrl ? 'block' : 'none'
  }

  async _loadChannels(){
    const community = this.currentCommunity
    const list = this.select('#channel-list')
    if(!community || !this.authToken || !list) {
      if(list) list.innerHTML = ''
      return
    }
    try {
      const res = await window.api.channels.list(community)
      const channels = res?.channels || []
      list.innerHTML = ''
      channels.forEach(ch => {
        if(ch.kind === 'voice') {
          const li = document.createElement('nonio-voice-channel-li')
          li.setAttribute('channel', ch.slug)
          list.appendChild(li)
        } else {
          const li = document.createElement('nonio-text-channel-li')
          li.setAttribute('channel', ch.slug)
          li.setAttribute('name', ch.name || ch.slug)
          list.appendChild(li)
        }
      })
      // Route sync can run before channels finish loading on refresh.
      // Re-apply active text channel state now that channel items exist.
      this._syncActiveChannelFromHash()
      this._updateVoiceUI()
      this._renderVoicePresenceParticipants()
    } catch (e) {
      console.warn('NonioSidebar: failed to load channels', e)
      list.innerHTML = ''
    }
  }

  openCreateChannelModal(){
    const community = this.currentCommunity
    if(!community || !this.authToken) {
      window.nonio?.requireLogin?.('create a channel')
      return
    }
    const btn = this.select('#channel-create-btn')
    if(btn && btn.style.display === 'none') return
    nonioModalManager.open('createChannel')
  }

  openTextChannel(slug){
    const community = this.currentCommunity
    if(!community) return
    const encodedSlug = encodeURIComponent(slug)
    const path = `/@${community}:${encodedSlug}`
    if(window.location.pathname !== path || window.location.hash) {
      window.history.pushState(null, null, path)
      window.dispatchEvent(new CustomEvent('link'))
    }
  }

  _setActiveTextChannelInList(slug){
    const list = this.select('#channel-list')
    if(!list) return
    list.querySelectorAll('nonio-text-channel-li').forEach(li => {
      const ch = li.getAttribute('channel')
      li.toggleAttribute('active', !!slug && ch === slug)
    })
  }

  _toggleCommunityHeaderVisible(communityUrl){
    // Hide the community-specific header (avatar/subscribe/description) when on Nonio/frontpage.
    const header = this.select('#community header')
    if(!header) return
    header.style.display = communityUrl ? '' : 'none'
  }

  _updateCommunityAvatar(communityUrl){
    const img = this.select('#community-avatar-img')
    if(!img) return

    if(communityUrl) {
      img.src = `${config.AVATAR_HOST}/@${communityUrl}.webp`
      img.alt = `@${communityUrl}`
      img.style.display = ''
      img.onerror = () => { img.style.display = 'none' }
    } else {
      img.src = `/lib/favicon.svg`
      img.alt = 'Nonio'
      img.style.display = ''
      img.onerror = null
    }
  }

  async _populateCommunityDetails() {
    let community = this.currentCommunity
    let container = this.select('#community-description')
    
    if(!community) {
        this._toggleCommunityHeaderVisible(null)
        this._animateSection(container, false)
        const settingsLi = this.select('#sidebar-community-settings')
        if(settingsLi) settingsLi.style.display = 'none'
        const createChannelBtn = this.select('#channel-create-btn')
        if(createChannelBtn) createChannelBtn.style.display = 'none'
        return
    }

    try {
        let res = await this.getData(`/communities/${community}`, this.authToken)
        
        const settingsLi = this.select('#sidebar-community-settings')
        if(settingsLi) {
            settingsLi.style.display = res?.isAdmin ? '' : 'none'
        }
        
        const createChannelBtn = this.select('#channel-create-btn')
        if(createChannelBtn) createChannelBtn.style.display = res?.isAdmin ? '' : 'none'
        
        // Update description
        let quillView = container.querySelector('nonio-markdown-view')
        if(res?.description || res?.isAdmin) {
            await quillView.render(res?.description || '')
            await this._nextFrame()
            this._animateSection(container, true, this._computeCommunityDescriptionHeight(quillView))
        } else {
            this._animateSection(container, false)
        }
    } catch(e) {
        console.error('NonioSidebar: Error loading community details', e)
        this._animateSection(container, false)
        const settingsLi = this.select('#sidebar-community-settings')
        if(settingsLi) settingsLi.style.display = 'none'
        const createChannelBtn = this.select('#channel-create-btn')
        if(createChannelBtn) createChannelBtn.style.display = 'none'
    }
  }
  
  _animateSection(el, show, height = 0) {
    if(show) {
        el.style.height = el.style.minHeight = height + 'px'
        el.style.opacity = 1
        el.style.marginBottom = 0
    } else {
        el.style.height = el.style.minHeight = 0
        el.style.opacity = 0
        el.style.marginBottom = '-12px'
    }
  }
  
  _updateCommunitySelection(communityUrl) {
    if(this.getAttribute('view') !== 'community') return
    let select = this.select('nonio-select')
    if(!select) return
    const subscribeBtn = this.select('#community-subscribe')

    // On initial load the community panel can render before the communities/options have been populated.
    // In that case, bail out and let _populateCommunitySelect() establish the options first.
    if(!select.querySelector('nonio-option')) return
    
    // Remove any previously added temporary options
    let tempOptions = select.querySelectorAll('nonio-option[temporary]')
    tempOptions.forEach(opt => opt.remove())

    let options = Array.from(select.querySelectorAll('nonio-option'))
    
    // If the community is not in our list (not subscribed), we need to add a temp option
    let existingOption = options.find(opt => {
      if(communityUrl) return opt.getAttribute('value') == communityUrl
      return opt.getAttribute('value') == ""
    })
    
    // Clear previous selection
    options.forEach(o => o.removeAttribute('slot'))

    if(existingOption) {
      existingOption.setAttribute('slot', 'selected')
      // It's a subscribed community (or frontpage)
      if(subscribeBtn) subscribeBtn.hidden = true
    } else {
      // Frontpage/Nonio with no existing option loaded yet — don't try to synthesize a community option.
      if(!communityUrl) {
        if(subscribeBtn) subscribeBtn.hidden = true
        return
      }

      // Not in list, so we are viewing a community we aren't subscribed to
      // Create a temporary option for it
      let tempOption = document.createElement('nonio-option')
      tempOption.setAttribute('temporary', '')
      tempOption.setAttribute('value', communityUrl)
      tempOption.setAttribute('slot', 'selected')
      tempOption.innerHTML = this._communityAvatar(communityUrl) + (communityUrl.charAt(0).toUpperCase() + communityUrl.slice(1))
      select.insertBefore(tempOption, select.firstChild)
      
      // Also fetch the community details to get proper casing/name if possible, though route context might suffice
      // But more importantly, show the subscribe button
      // Only show subscribe button if communities have loaded. 
      // If they haven't loaded, we can't be sure if it's a new subscription or just not loaded yet.
      if (this._communitiesLoaded) {
        if(subscribeBtn) {
          subscribeBtn.hidden = false
          subscribeBtn.innerText = "Subscribe"
          subscribeBtn.removeAttribute('subscribed')
        }
      } else {
        if(subscribeBtn) subscribeBtn.hidden = true
      }
    }
  }

  _updateLinks() {
    let community = this.currentCommunity
    let prefix = community ? `/@${community}` : ''

    // Update static "All posts" + "Submit post" links
    this.select(`nonio-tag-li[href$="#all"]`)?.setAttribute('href', `${prefix}/#all`)
    this.select(`#sidebar-submit-post`)?.setAttribute('href', `${prefix}/submit`)
    this.select(`#sidebar-community-settings`)?.setAttribute('href', `${prefix}/admin`)
  }

  // Logic for the tag lists
  _subscribedTags = [] 
  _commonTags = []
  _subscribedTagsLoaded = false
  _commonTagsLoaded = false

  async _loadSubscribedTags(){
    if(!this.authToken) {
      this._subscribedTags = []
      this._subscribedTagsLoaded = true
      this._toggleSubscribedTagsVisible(false)
      this._populateTags()
      return
    }
    let url = '/subscriptions'
    if(this.currentCommunity) url += `?community=${this.currentCommunity}`
    let tags = await this.getData(url, this.authToken)
    this._subscribedTags = tags?.subscriptions?.map(t=>t.tag) || []
    this._subscribedTagsLoaded = true
    this._toggleSubscribedTagsVisible(this._subscribedTags.length > 0)
    this._populateTags()
  }
  async _loadCommonTags(){
    let url = '/tags'
    if(this.currentCommunity) url += `?community=${this.currentCommunity}`
    let tags = await this.getData(url, this.authToken)
    this._commonTags = tags?.tags?.map(t=>t.tag) || []
    this._commonTagsLoaded = true
    this._populateTags()
  }

  async _loadCommunities(){
    try {
      const endpoint = window.nonio?.accessToken ? 'communities/subscribed' : 'communities'
      const response = await window.nonio.getData(endpoint)
      this._communities = response.communities || []
      this._populateCommunitySelect(this._communities)
    } catch (err) {
      console.error('Failed to load communities', err)
    }
  }

  _communityAvatar(url) {
    return url ? `<img src="${config.AVATAR_HOST}/@${url}.webp" onerror="this.style.display='none'">` : ''
  }

  _populateCommunitySelect(communities){
    if(this.getAttribute('view') !== 'community') return
    this._communitiesLoaded = true
    let select = this.select('nonio-select')
    if(!select) return
    
    let html = `<nonio-option id="nonio-community" value="">
      <svg style="margin-left: calc(50% - 47px);" width="94" height="14" viewBox="0 0 94 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path opacity="0.8" d="M13.5 0.999999V15H10.84L3.86 6.5V15H0.66V0.999999H3.34L10.3 9.5V0.999999H13.5ZM29.2564 15.24C27.8031 15.24 26.4897 14.9267 25.3164 14.3C24.1564 13.6733 23.2431 12.8133 22.5764 11.72C21.9231 10.6133 21.5964 9.37333 21.5964 8C21.5964 6.62667 21.9231 5.39333 22.5764 4.3C23.2431 3.19333 24.1564 2.32667 25.3164 1.7C26.4897 1.07333 27.8031 0.76 29.2564 0.76C30.7097 0.76 32.0164 1.07333 33.1764 1.7C34.3364 2.32667 35.2497 3.19333 35.9164 4.3C36.5831 5.39333 36.9164 6.62667 36.9164 8C36.9164 9.37333 36.5831 10.6133 35.9164 11.72C35.2497 12.8133 34.3364 13.6733 33.1764 14.3C32.0164 14.9267 30.7097 15.24 29.2564 15.24ZM29.2564 12.48C30.0831 12.48 30.8297 12.2933 31.4964 11.92C32.1631 11.5333 32.6831 11 33.0564 10.32C33.4431 9.64 33.6364 8.86667 33.6364 8C33.6364 7.13333 33.4431 6.36 33.0564 5.68C32.6831 5 32.1631 4.47333 31.4964 4.1C30.8297 3.71333 30.0831 3.52 29.2564 3.52C28.4297 3.52 27.6831 3.71333 27.0164 4.1C26.3497 4.47333 25.8231 5 25.4364 5.68C25.0631 6.36 24.8764 7.13333 24.8764 8C24.8764 8.86667 25.0631 9.64 25.4364 10.32C25.8231 11 26.3497 11.5333 27.0164 11.92C27.6831 12.2933 28.4297 12.48 29.2564 12.48ZM57.8555 0.999999V15H55.1955L48.2155 6.5V15H45.0155V0.999999H47.6955L54.6555 9.5V0.999999H57.8555ZM66.8319 0.999999H70.0719V15H66.8319V0.999999ZM85.8384 15.24C84.3851 15.24 83.0718 14.9267 81.8984 14.3C80.7384 13.6733 79.8251 12.8133 79.1584 11.72C78.5051 10.6133 78.1784 9.37333 78.1784 8C78.1784 6.62667 78.5051 5.39333 79.1584 4.3C79.8251 3.19333 80.7384 2.32667 81.8984 1.7C83.0718 1.07333 84.3851 0.76 85.8384 0.76C87.2918 0.76 88.5984 1.07333 89.7584 1.7C90.9184 2.32667 91.8318 3.19333 92.4984 4.3C93.1651 5.39333 93.4984 6.62667 93.4984 8C93.4984 9.37333 93.1651 10.6133 92.4984 11.72C91.8318 12.8133 90.9184 13.6733 89.7584 14.3C88.5984 14.9267 87.2918 15.24 85.8384 15.24ZM85.8384 12.48C86.6651 12.48 87.4118 12.2933 88.0784 11.92C88.7451 11.5333 89.2651 11 89.6384 10.32C90.0251 9.64 90.2184 8.86667 90.2184 8C90.2184 7.13333 90.0251 6.36 89.6384 5.68C89.2651 5 88.7451 4.47333 88.0784 4.1C87.4118 3.71333 86.6651 3.52 85.8384 3.52C85.0118 3.52 84.2651 3.71333 83.5984 4.1C82.9318 4.47333 82.4051 5 82.0184 5.68C81.6451 6.36 81.4584 7.13333 81.4584 8C81.4584 8.86667 81.6451 9.64 82.0184 10.32C82.4051 11 82.9318 11.5333 83.5984 11.92C84.2651 12.2933 85.0118 12.48 85.8384 12.48Z" fill="currentColor"></path>
      </svg>
      <img src="/lib/favicon.svg">
      <span>Nonio</span>
    </nonio-option>`
    
    communities.forEach(c => {
        html += `<nonio-option value="${c.url}">${this._communityAvatar(c.url)}${c.name}</nonio-option>`
    })
    
    html += `<nonio-option value="__create__" style="border-top: 1px solid var(--bg-secondary); color: var(--text-brand);">+ Create Community</nonio-option>`
    
    // Prevent flickering by pre-calculating the state based on current community
    // BEFORE setting innerHTML
    const currentCommunity = this.currentCommunity
    const subscribed = !currentCommunity || communities.some(c => c.url == currentCommunity)

    const communitySubscribe = this.select('#community-subscribe')
    if(communitySubscribe && !subscribed && currentCommunity){
        html = `<nonio-option value="${currentCommunity}" slot="selected" temporary>${this._communityAvatar(currentCommunity)}${currentCommunity.charAt(0).toUpperCase() + currentCommunity.slice(1)}</nonio-option>` + html
        communitySubscribe.hidden = false
        communitySubscribe.innerText = "Subscribe"
        communitySubscribe.removeAttribute('subscribed')
        communitySubscribe.style.display = ''
    } else if(communitySubscribe) {
        communitySubscribe.hidden = true
        communitySubscribe.style.display = 'none'
    }

    select.innerHTML = html
    
    // Restore selection if it is subscribed
    if(subscribed) {
        let value = currentCommunity || ""
        let option = select.querySelector(`nonio-option[value="${value}"]`)
        if(option) option.setAttribute('slot', 'selected')
    }
  }
  
  openCreateCommunity(){
    // Opens the create-community modal (used by the community selector "__create__" option)
    if(!this.authToken) return window.nonio?.requireLogin?.('create a community')
    this.showCreateCommunity()
  }
  
  async toggleSubscribe() {
    if(!this.currentCommunity) return
    
    let button = this.select('#community-subscribe')
    button.wait()
    
    try {
      let response = await window.nonio.postData('community/subscribe', {
        community: this.currentCommunity
      })
      
      if(response.success) {
        button.success()
        button.innerText = "Subscribed"
        button.setAttribute('subscribed', '')
        setTimeout(() => {
             this._loadCommunities() // Reload list which will include the new subscription
             button.hidden = true // Hide button after successful subscription
        }, 1000)
      } else {
        button.error()
      }
    } catch(e) {
      button.error()
      console.error(e)
    }
  }

  _populateTags(){
    if(this._subscribedTagsLoaded && this._commonTagsLoaded){
      if(!this.select('#tags tags')) return
      if(this._subscribedTags.length){
        this._createTags(this._subscribedTags, this.select('#subscribed-tags tags'), true)
      }
      this._toggleSubscribedList(this._subscribedTags.length != 0)
      this._commonTags = this._commonTags.filter(t=>{
        return this._subscribedTags.indexOf(t) == -1
      })
      this._createTags(this._commonTags, this.select('#tags tags'))
    }
  }

  _toggleSubscribedTagsVisible(visible) {
    const section = this.select('#subscribed-tags')
    if(!section) return
    section.style.display = visible ? 'block' : 'none'
    if(!visible) {
      // reset any prior animation remnants
      section.style.height = section.style.minHeight = '0px'
      section.style.opacity = '0'
    }
  }

  _createTags(data, dom, subscribed=false){
    let prefix = this.currentCommunity ? `/@${this.currentCommunity}` : ''
    let tags = ` 
      ${data.map((tag) => `
        <nonio-tag-li tag=${tag} href="${prefix}/#${tag}" ${subscribed ? 'subscribed' : ''} ${this._activeTag == tag ? 'active' : ''}></nonio-tag-li>
      `).join('')}
    `
    dom.innerHTML = tags
  }

  // Unified nav item activation - clears all active states and sets the appropriate one
  _setActiveNavItem(type, value = null) {
    this.toggleAttribute('overlay', false)
    this.querySelectorAll('nonio-tag-li[active]').forEach(li => li.toggleAttribute('active', false))

    if(type === 'submit') {
      this.select('#sidebar-submit-post')?.toggleAttribute('active', true)
      this._activeTag = null
    } else if(type === 'community-settings') {
      this.select('#sidebar-community-settings')?.toggleAttribute('active', true)
      this._activeTag = null
    } else if(type === 'tag' && value) {
      if(value === 'all') this.select(`nonio-tag-li[href$="#all"]`)?.toggleAttribute('active', true)
      else this.select(`nonio-tag-li[tag="${value}"]`)?.toggleAttribute('active', true)
      this._activeTag = value
    } else {
      this._activeTag = null
    }
  }

  activateTag(tag){
    this._setActiveNavItem('tag', tag)
  }

  _createSubscribedTag(e){
    const tagName = e.detail.tag
    const isNew = this._subscribedTags.indexOf(tagName) == -1
    const willBeFirst = isNew && this._subscribedTags.length == 0

    const appendSubscribedTag = () => {
      let tag = document.createElement('nonio-tag-li')
      tag.setAttribute('tag', tagName)
      tag.toggleAttribute('load-in', true)
      tag.toggleAttribute('subscribed', true)

      this._subscribedTags.push(tagName)
      const commonIdx = this._commonTags.indexOf(tagName)
      if(commonIdx != -1) this._commonTags.splice(commonIdx, 1)

      const container = this.select('#subscribed-tags tags')
      container?.appendChild(tag)
    }

    if(isNew) {
      // If this is the first subscribed tag, the entire section starts at `display:none`.
      // Remove display-none *before* we append/animate so the load-in animation is visible.
      if(willBeFirst) {
        this._toggleSubscribedTagsVisible(true)
        requestAnimationFrame(() => {
          appendSubscribedTag()
          this._toggleSubscribedList(true)
        })
      } else {
        appendSubscribedTag()
      }
    } else if(this._subscribedTags.length) {
      // Safety: if somehow hidden while already subscribed, make it visible.
      this._toggleSubscribedTagsVisible(true)
    }

    e.detail.dom.toggleAttribute('load-out', true)
    setTimeout(()=>{
      e.detail.dom.remove()
    }, 200)
  }

  _removeSubscribedTag(e){
    console.log(this._subscribedTags)
    this._subscribedTags.splice(this._subscribedTags.indexOf(e.detail.tag), 1)
    console.log(this._subscribedTags)

    if(this._commonTags.indexOf(e.detail.tag) == -1){
      let tag = document.createElement('nonio-tag-li')
      tag.setAttribute('tag', e.detail.tag)
      tag.toggleAttribute('load-in', true)
      this._commonTags.push(e.detail.tag)
      this.select('#tags tags').prepend(tag)
    }
    e.detail.dom.toggleAttribute('load-out', true)
    if(this._subscribedTags.length == 0){
      this._toggleSubscribedList(false)
    }
    setTimeout(()=>{
      e.detail.dom.remove()
    }, 200)
  }

  _onAvatarUpdate(e){
    const community = e.detail?.community
    if(!community) return
    const value = community.replace('@', '')
    const select = this.select('nonio-select')
    if(!select) return
    const url = `${config.AVATAR_HOST}/@${value}.webp?${Date.now()}`
    select.querySelectorAll(`nonio-option[value="${value}"] img`).forEach(img => {
      img.src = url
      img.style.display = ''
    })

    // Also update the dedicated community avatar (if we are viewing that community)
    if(this.currentCommunity === value) {
      const big = this.select('#community-avatar-img')
      if(big) {
        big.src = url
        big.style.display = ''
      }
    }
  }

  _onCommunityUpdate(e){
    const detail = e.detail || {}
    const community = detail.community
    if(!community) return
    const value = community.replace('@', '')
    const select = this.select('nonio-select')
    if(select){
      select.querySelectorAll(`nonio-option[value="${value}"]`).forEach(opt => {
        const imgHtml = opt.querySelector('img')?.outerHTML || this._communityAvatar(value)
        const name = detail.name || opt.textContent || value
        opt.innerHTML = `${imgHtml}${name}`
      })
    }

    if(this.currentCommunity === value){
      const container = this.select('#community-description')
      const quillView = container?.querySelector('nonio-markdown-view')
      if(quillView){
        Promise.resolve(quillView.render(detail.description || '')).then(() => {
          requestAnimationFrame(() => {
            const show = !!detail.description || (this.select('#sidebar-community-settings')?.style.display !== 'none')
            this._animateSection(container, show, this._computeCommunityDescriptionHeight(quillView))
          })
        })
      }
    }
  }

  _toggleSubscribedList(revealed){
    let list = this.select('#subscribed-tags')
    if(!list) return
    
    // Guard against multiple simultaneous calls
    if(revealed && this._subscribedListAnimating) return
    
    list.style.overflow = 'hidden'
    if(revealed) {
      this._subscribedListAnimating = true
      
      // Clear inline styles to measure natural height
      list.style.height = list.style.minHeight = ''
      list.style.opacity = ''
      void list.offsetHeight
      
      // Measure actual natural height
      const targetHeight = list.offsetHeight + 'px'
      
      // Set starting state
      list.style.height = list.style.minHeight = '0px'
      list.style.opacity = '0'
      void list.offsetHeight
      
      // Animate to measured height
      list.style.height = list.style.minHeight = targetHeight
      list.style.opacity = '1'
      
      setTimeout(() => {
        list.style.overflow = list.style.height = list.style.minHeight = list.style.opacity = ''
        this._subscribedListAnimating = false
      }, 220)
    } else {
      list.style.height = list.style.minHeight = list.offsetHeight + 'px'
      void list.offsetHeight
      list.style.height = list.style.minHeight = '0px'
      list.style.opacity = '0'
    }
  }

  _toggleAuth(e){
    e?.preventDefault?.()
    if(this.authToken) return this.logout()
    return this.showLogin()
  }

  _onSidebarClick(e){
    const logoutBtn = e.target?.closest?.('#logout-btn')
    if(logoutBtn) {
      e.preventDefault?.()
      return this.logout()
    }

    const login = e.target?.closest?.('#login-link')
    if(login) {
      e.preventDefault?.()
      return this.showLogin()
    }

    const signup = e.target?.closest?.('#signup-link')
    if(signup) {
      e.preventDefault?.()
      return this.showCreateAccount()
    }
  }

  closeSidebarAuthModals(){
    nonioModalManager.closeAll()
  }

  _syncAuthUI(){
    // Toggle bottom user section (rendered inside community panel)
    const loggedIn = this.select('#sidebar-user-logged-in')
    const loggedOut = this.select('#sidebar-user-logged-out')
    if(loggedIn) loggedIn.toggleAttribute('hidden', !this.authToken)
    if(loggedOut) loggedOut.toggleAttribute('hidden', !!this.authToken)

    // Subscribe-to-community requires auth
    const subscribe = this.select('#community-subscribe')
    if(subscribe) {
      if(!this.authToken) {
        subscribe.hidden = true
        subscribe.style.display = 'none'
      } else {
        // let existing selection logic decide hidden vs shown; just restore display if applicable
        subscribe.style.display = subscribe.hidden ? 'none' : ''
      }
    }
  }

  logout(){
    nonio.clearToken()
    this.showCommunity()

    // Logged-out: keep community + common tags visible, hide subscribed section.
    this._subscribedTags = []
    this._subscribedTagsLoaded = true
    this._toggleSubscribedTagsVisible(false)
    this._stopVoicePresenceSocket('logout')
    this._voicePresenceByChannel = {}
    this._renderVoicePresenceParticipants()

    this._syncAuthUI()

    // Refresh public data (and clear any stale auth-only data)
    this._loadCommunities()
    this._loadCommonTags()
  }

  _closeMobileOverlay(){
    this.toggleAttribute('overlay', false)
  }

  // --- Voice (LiveKit) ---
  _voiceRoom = null
  _voiceChannel = null
  _voiceCommunity = null
  _voiceParticipantEls = new Map()
  _voiceRemoteAudioEls = new Map()
  _voicePresenceByChannel = {}
  _voicePresenceSocket = null
  _voicePresenceSocketCommunity = null
  _voicePresenceReconnectTimer = null
  _voicePresenceReconnectAttempt = 0
  _voiceTalkingPollTimer = null
  _voiceTalkingPollMs = 3000
  _localVADSpeaking = false
  _vadInstance = null
  _vadLoadPromise = null

  _voiceAudioContext = null

  _loadVAD() {
    if (this._vadLoadPromise) return this._vadLoadPromise
    this._vadLoadPromise = new Promise((resolve, reject) => {
      if (window.vad?.MicVAD) {
        resolve(window.vad)
        return
      }
      const onnx = document.createElement('script')
      onnx.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.wasm.min.js'
      onnx.crossOrigin = 'anonymous'
      onnx.onload = () => {
        const vadScript = document.createElement('script')
        vadScript.src = 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/bundle.min.js'
        vadScript.crossOrigin = 'anonymous'
        vadScript.onload = () => resolve(window.vad)
        vadScript.onerror = () => reject(new Error('VAD script failed to load'))
        document.head.appendChild(vadScript)
      }
      onnx.onerror = () => reject(new Error('ONNX script failed to load'))
      document.head.appendChild(onnx)
    })
    return this._vadLoadPromise
  }

  async _startVAD() {
    try {
      const vad = await this._loadVAD()
      this._vadInstance = await vad.MicVAD.new({
        onSpeechStart: () => {
          this._localVADSpeaking = true
          this._updateVoiceTalkingIndicators()
        },
        onSpeechEnd: () => {
          this._localVADSpeaking = false
          this._updateVoiceTalkingIndicators()
        },
        onnxWASMBasePath: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',
        baseAssetPath: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/'
      })
      this._vadInstance.start()
    } catch (err) {
      console.warn('[Voice] VAD failed to start, using server speaking state:', err)
    }
  }

  _stopVAD() {
    this._localVADSpeaking = false
    if (this._vadInstance) {
      try {
        this._vadInstance.pause()
        if (typeof this._vadInstance.destroy === 'function') this._vadInstance.destroy()
      } catch (_) {}
      this._vadInstance = null
    }
  }

  _playVoiceTone(frequency, durationMs = 80) {
    try {
      const ctx = this._voiceAudioContext || (this._voiceAudioContext = new (window.AudioContext || window.webkitAudioContext)())
      if (ctx.state === 'suspended') ctx.resume()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = frequency
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationMs / 1000)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + durationMs / 1000)
    } catch (_) {}
  }

  _playVoiceJoined() {
    console.log('[Voice] Joined channel – playing join sound (low → high)')
    this._playVoiceTone(220, 70)
    setTimeout(() => this._playVoiceTone(440, 70), 90)
  }

  _playVoiceLeft() {
    console.log('[Voice] Left channel – playing leave sound (high → low)')
    this._playVoiceTone(440, 70)
    setTimeout(() => this._playVoiceTone(220, 70), 90)
  }

  _startVoiceTalkingPolling(){
    this._stopVoiceTalkingPolling()
    this._voiceTalkingPollTimer = setInterval(() => {
      this._enforceVoiceTalkingIndicators()
    }, this._voiceTalkingPollMs)
  }

  _stopVoiceTalkingPolling(){
    if(this._voiceTalkingPollTimer) clearInterval(this._voiceTalkingPollTimer)
    this._voiceTalkingPollTimer = null
  }

  _enforceVoiceTalkingIndicators(){
    if(!this._voiceRoom || !this._voiceParticipantEls.size) return
    const activeSpeakers = this._voiceRoom.activeSpeakers || []
    const hasActiveSpeaker = activeSpeakers.length > 0 || this._localVADSpeaking
    if(!hasActiveSpeaker) {
      this._voiceParticipantEls.forEach(user => user.toggleAttribute('talking', false))
      return
    }

    this._voiceParticipants().forEach(p => {
      const key = this._voiceParticipantKey(p)
      const user = this._voiceParticipantEls.get(key)
      if(!user) return
      const isInActiveSpeakers = activeSpeakers.some(s => s.sid === p.sid)
      const speaking = p.isLocal
        ? this._localVADSpeaking
        : (p.isSpeaking || isInActiveSpeakers)
      user.toggleAttribute('talking', !!speaking)
    })
  }

  _stopVoicePresenceSocket(reason = 'unspecified'){
    if(this._voicePresenceReconnectTimer) clearTimeout(this._voicePresenceReconnectTimer)
    this._voicePresenceReconnectTimer = null
    this._voicePresenceReconnectAttempt = 0
    this._voicePresenceSocketCommunity = null
    const socket = this._voicePresenceSocket
    this._voicePresenceSocket = null
    if(socket) {
      console.info('[VoicePresenceWS] closing socket', {
        reason,
        community: socket._voicePresenceCommunity || this.currentCommunity,
        readyState: socket.readyState
      })
    }
    if(socket) {
      try {
        socket.close()
      } catch (_) {}
    }
  }

  _startVoicePresenceSocket(trigger = 'unspecified'){
    this._stopVoicePresenceSocket(`restart:${trigger}`)
    if(!this.authToken || !this.currentCommunity) {
      console.info('[VoicePresenceWS] skipped start (missing auth/community)', {
        trigger,
        hasAuthToken: !!this.authToken,
        community: this.currentCommunity || null
      })
      this._voicePresenceByChannel = {}
      this._renderVoicePresenceParticipants()
      return
    }

    const community = this.currentCommunity
    console.info('[VoicePresenceWS] opening socket', {
      trigger,
      community,
      reconnectAttempt: this._voicePresenceReconnectAttempt
    })
    const socket = new WebSocket(window.api.voice.presenceWsUrl(community, this.authToken))
    socket._voicePresenceCommunity = community
    this._voicePresenceSocket = socket
    this._voicePresenceSocketCommunity = community

    socket.addEventListener('open', () => {
      if(this._voicePresenceSocket !== socket) return
      console.info('[VoicePresenceWS] socket open', {
        community,
        reconnectAttempt: this._voicePresenceReconnectAttempt
      })
      this._voicePresenceReconnectAttempt = 0
    })

    socket.addEventListener('message', (event) => {
      if(this._voicePresenceSocket !== socket) return
      this._handleVoicePresenceSocketMessage(event.data, community)
    })

    socket.addEventListener('close', (event) => {
      if(this._voicePresenceSocket !== socket) return
      console.warn('[VoicePresenceWS] socket closed', {
        community,
        code: event?.code,
        reason: event?.reason || '',
        wasClean: !!event?.wasClean,
        readyState: socket.readyState
      })
      this._voicePresenceSocket = null
      this._voicePresenceSocketCommunity = null
      this._scheduleVoicePresenceReconnect(community)
    })

    socket.addEventListener('error', (event) => {
      console.warn('[VoicePresenceWS] socket error', {
        community,
        readyState: socket.readyState,
        eventType: event?.type
      })
      try {
        socket.close()
      } catch (_) {}
    })
  }

  _scheduleVoicePresenceReconnect(community){
    if(this._voicePresenceReconnectTimer) clearTimeout(this._voicePresenceReconnectTimer)
    if(!this.authToken || this.currentCommunity !== community) {
      console.info('[VoicePresenceWS] reconnect skipped', {
        community,
        hasAuthToken: !!this.authToken,
        currentCommunity: this.currentCommunity || null
      })
      return
    }

    const attempt = Math.min(this._voicePresenceReconnectAttempt + 1, 6)
    this._voicePresenceReconnectAttempt = attempt
    const delay = Math.min(1000 * (2 ** (attempt - 1)), 30000)
    console.info('[VoicePresenceWS] scheduling reconnect', { community, attempt, delay })
    this._voicePresenceReconnectTimer = setTimeout(() => {
      this._voicePresenceReconnectTimer = null
      if(!this.authToken || this.currentCommunity !== community) return
      this._startVoicePresenceSocket('reconnect')
    }, delay)
  }

  _handleVoicePresenceSocketMessage(rawData, expectedCommunity){
    try {
      const msg = JSON.parse(rawData)
      if(msg?.community !== expectedCommunity || this.currentCommunity !== expectedCommunity) return
      if(msg?.type !== 'voice.presence.snapshot' && msg?.type !== 'voice.presence.update') return
      this._voicePresenceByChannel = msg?.channels || {}
      this._renderVoicePresenceParticipants()
    } catch (err) {
      console.warn('Voice presence message parse failed:', err)
    }
  }

  async _refreshVoicePresence(){
    // On-demand refresh for immediate local UI updates; websocket handles steady-state updates.
    if(!this.authToken || !this.currentCommunity) return
    const community = this.currentCommunity
    try {
      const res = await window.api.voice.presence(community)
      if(res?.error) {
        console.warn('Voice presence failed:', res.error)
        return
      }
      if(this.currentCommunity !== community) return
      this._voicePresenceByChannel = res?.channels || {}
      this._renderVoicePresenceParticipants()
    } catch (err) {
      console.warn('Voice presence request failed:', err)
    }
  }

  _renderVoicePresenceParticipants(){
    const list = this.select('#channel-list')
    if(!list) return

    const activeChannel = this._voiceRoom && this._voiceCommunity === this.currentCommunity
      ? this._voiceChannel
      : null

    list.querySelectorAll('nonio-voice-channel-li').forEach(li => {
      const channel = li.getAttribute('channel')
      li.querySelectorAll('nonio-user[voice-preview]').forEach(el => el.remove())

      if(activeChannel && channel === activeChannel) {
        li.toggleAttribute('has-participants', false)
        return
      }

      const identities = this._voicePresenceByChannel?.[channel]
      const names = Array.isArray(identities) ? identities : []
      names.forEach(identity => {
        const user = document.createElement('nonio-user')
        user.setAttribute('voice-preview', '')
        if(identity === window.nonio?.username) user.toggleAttribute('self', true)
        else user.setAttribute('name', identity)
        li.appendChild(user)
      })
      li.toggleAttribute('has-participants', names.length > 0)
    })
  }

  async joinVoiceChannel(channel){
    const community = this.currentCommunity
    if(!community || !this.authToken) {
      if(!this.authToken) window.nonio?.requireLogin?.('join voice')
      return
    }
    if(this._voiceRoom && this._voiceChannel === channel && this._voiceCommunity === community) return

    await this._voiceDisconnect()
    const res = await window.api.voice.join(community, channel)
    if(res?.error) {
      console.error('Voice join failed:', res.error)
      return
    }
    const { token, wsUrl, roomName } = res
    if(!token || !wsUrl) return

    try {
      const { Room, RoomEvent } = await import('https://cdn.jsdelivr.net/npm/livekit-client@2/dist/livekit-client.esm.mjs')
      const room = new Room()
      this._voiceRoom = room
      this._voiceChannel = channel
      this._voiceCommunity = community

      room.on(RoomEvent.Connected, () => {
        room.localParticipant.setMicrophoneEnabled(true).catch(() => {})
        this._playVoiceJoined()
        this._updateVoiceUI()
        this._syncVoiceParticipantElements()
        this._updateVoiceTalkingIndicators()
        this._startVAD()
        this._syncVoiceRemoteAudioElements()
        this._refreshVoicePresence()
        this._startVoiceTalkingPolling()
      })
      room.on(RoomEvent.Disconnected, () => {
        this._stopVAD()
        this._stopVoiceTalkingPolling()
        this._playVoiceLeft()
        this._voiceRoom = null
        this._voiceChannel = null
        this._voiceCommunity = null
        this._updateVoiceUI()
        this._clearVoiceParticipantElements()
        this._clearVoiceRemoteAudioElements()
        this._refreshVoicePresence()
      })
      room.on(RoomEvent.ParticipantConnected, () => {
        this._syncVoiceParticipantElements()
        this._refreshVoicePresence()
      })
      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        this._syncVoiceParticipantElements()
        this._removeVoiceRemoteAudioForParticipant(participant)
        this._refreshVoicePresence()
      })
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        this._attachVoiceRemoteAudio(track, publication, participant)
        this._syncVoiceParticipantElements()
      })
      room.on(RoomEvent.TrackUnsubscribed, (track, publication) => {
        this._detachVoiceRemoteAudio(track, publication)
        this._syncVoiceParticipantElements()
      })
      room.on(RoomEvent.IsSpeakingChanged, () => this._updateVoiceTalkingIndicators())
      room.on(RoomEvent.ActiveSpeakersChanged, () => this._updateVoiceTalkingIndicators())

      await room.connect(wsUrl, token)
    } catch (err) {
      console.error('Voice connect error:', err)
      this._voiceRoom = null
      this._voiceChannel = null
      this._voiceCommunity = null
      this._updateVoiceUI()
    }
  }

  async disconnectVoice(){
    await this._voiceDisconnect()
    this._updateVoiceUI()
    this._clearVoiceParticipantElements()
  }

  async _voiceDisconnect(){
    if(!this._voiceRoom) {
      this._clearVoiceParticipantElements()
      this._clearVoiceRemoteAudioElements()
      this._stopVoiceTalkingPolling()
      return
    }
    this._stopVAD()
    this._stopVoiceTalkingPolling()
    const room = this._voiceRoom
    this._voiceRoom = null
    this._voiceChannel = null
    this._voiceCommunity = null
    this._clearVoiceParticipantElements()
    this._clearVoiceRemoteAudioElements()
    try {
      room.disconnect()
    } catch (_) {}
  }

  _voiceRemoteTrackKey(track, publication){
    return publication?.trackSid || track?.sid || null
  }

  _attachVoiceRemoteAudio(track, publication, participant){
    if(!track || track.kind !== 'audio') return
    const key = this._voiceRemoteTrackKey(track, publication)
    if(!key) return

    const existing = this._voiceRemoteAudioEls.get(key)
    if(existing?.el?.isConnected) return

    const el = document.createElement('audio')
    el.autoplay = true
    el.playsInline = true
    el.volume = 1
    el.style.display = 'none'
    this.appendChild(el)

    try {
      track.attach(el)
      const p = el.play?.()
      if(p?.catch) p.catch(() => {})
    } catch (err) {
      console.warn('[Voice] Failed to attach remote audio track:', err)
      el.remove()
      return
    }

    this._voiceRemoteAudioEls.set(key, { el, track, participantSid: participant?.sid || null })
  }

  _detachVoiceRemoteAudio(track, publication){
    const key = this._voiceRemoteTrackKey(track, publication)
    if(!key) return

    const entry = this._voiceRemoteAudioEls.get(key)
    if(!entry) return

    try {
      entry.track?.detach?.(entry.el)
    } catch (_) {}
    entry.el?.remove()
    this._voiceRemoteAudioEls.delete(key)
  }

  _removeVoiceRemoteAudioForParticipant(participant){
    const sid = participant?.sid
    if(!sid) return
    this._voiceRemoteAudioEls.forEach((entry, key) => {
      if(entry?.participantSid !== sid) return
      try {
        entry.track?.detach?.(entry.el)
      } catch (_) {}
      entry.el?.remove()
      this._voiceRemoteAudioEls.delete(key)
    })
  }

  _syncVoiceRemoteAudioElements(){
    if(!this._voiceRoom) return
    this._voiceRoom.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((publication) => {
        const track = publication?.track
        if(track) this._attachVoiceRemoteAudio(track, publication, participant)
      })
    })
  }

  _clearVoiceRemoteAudioElements(){
    this._voiceRemoteAudioEls.forEach((entry) => {
      try {
        entry.track?.detach?.(entry.el)
      } catch (_) {}
      entry.el?.remove()
    })
    this._voiceRemoteAudioEls.clear()
  }

  _updateVoiceUI(){
    const list = this.select('#channel-list')
    const strip = this.select('#voice-connection-strip')
    if(!list) return
    list.querySelectorAll('nonio-voice-channel-li').forEach(li => {
      const ch = li.getAttribute('channel')
      const active = this._voiceRoom && this._voiceChannel === ch && this._voiceCommunity === this.currentCommunity
      li.toggleAttribute('active', !!active)
      if(active) li.querySelectorAll('nonio-user[voice-preview]').forEach(el => el.remove())
    })
    if(strip) strip.style.display = this._voiceRoom ? 'block' : 'none'
    this._renderVoicePresenceParticipants()
  }

  _activeVoiceChannelLi(){
    return this._voiceRoom && this._voiceChannel
      ? this.select(`#channel-list nonio-voice-channel-li[channel="${this._voiceChannel}"]`)
      : null
  }

  _voiceParticipants(){
    if(!this._voiceRoom) return []
    return [this._voiceRoom.localParticipant, ...this._voiceRoom.remoteParticipants.values()]
  }

  _voiceParticipantKey(p){
    if(p?.isLocal) return 'local'
    if(p?.sid) return `sid:${p.sid}`
    const identity = p?.identity || p?.name || 'Unknown'
    return `identity:${identity}`
  }

  _createVoiceParticipantEl(p){
    const identity = p.identity || p.name || 'Unknown'
    const user = document.createElement('nonio-user')
    user.toggleAttribute('self', !!p.isLocal)
    if(!p.isLocal) user.setAttribute('name', identity)
    return user
  }

  _clearVoiceParticipantElements(){
    this._voiceParticipantEls.forEach(el => el.remove())
    this._voiceParticipantEls.clear()
    this._renderVoicePresenceParticipants()
  }

  _syncVoiceParticipantElements(){
    const activeChannelLi = this._activeVoiceChannelLi()
    if(!activeChannelLi) {
      this._clearVoiceParticipantElements()
      return
    }

    const participants = this._voiceParticipants()
    const currentKeys = new Set()

    participants.forEach(p => {
      const key = this._voiceParticipantKey(p)
      currentKeys.add(key)
      let user = this._voiceParticipantEls.get(key)
      if(!user) {
        user = this._createVoiceParticipantEl(p)
        this._voiceParticipantEls.set(key, user)
      } else if(!p.isLocal) {
        const identity = p.identity || p.name || 'Unknown'
        if(user.getAttribute('name') !== identity) user.setAttribute('name', identity)
      }
      if(user.parentElement !== activeChannelLi) activeChannelLi.appendChild(user)
    })

    this._voiceParticipantEls.forEach((user, key) => {
      if(currentKeys.has(key)) return
      user.remove()
      this._voiceParticipantEls.delete(key)
    })

    this._updateVoiceTalkingIndicators()
  }

  _updateVoiceTalkingIndicators(){
    if(!this._voiceRoom || !this._voiceParticipantEls.size) return
    const activeSpeakers = this._voiceRoom.activeSpeakers || []
    this._voiceParticipants().forEach(p => {
      const key = this._voiceParticipantKey(p)
      const user = this._voiceParticipantEls.get(key)
      if(!user) return
      const isInActiveSpeakers = activeSpeakers.some(s => s.sid === p.sid)
      const speaking = p.isLocal
        ? this._localVADSpeaking
        : (p.isSpeaking || isInActiveSpeakers)
      user.toggleAttribute('talking', !!speaking)
    })
  }

  _renderVoiceParticipants(){
    this._syncVoiceParticipantElements()
  }
}