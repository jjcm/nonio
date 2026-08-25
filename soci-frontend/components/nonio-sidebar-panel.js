import NonioComponent from './nonio-component.js'

export class NonioSidebarPanel extends NonioComponent {
  constructor() {
    super()
  }

  html(){ return `
    <slot></slot>
  `}

  activeHTML(){ return `
  `}

  static get observedAttributes() {
    return ['active']
  }

  connectedCallback(){
  }

  activatedCallback(){
  }

  deactivatedCallback(){
  }

  attributeChangedCallback(name, oldValue, newValue){
    if(name !== 'active' || oldValue === newValue) return
    const active = newValue !== null && newValue !== 'false'
    if(active) {
      this.innerHTML = this.activeHTML()
      this.activatedCallback()
    } else {
      setTimeout(()=>{
        this.innerHTML = ''
        this.deactivatedCallback()
      }, 200)
    }
  }
}

export class NonioSidebarCommunityPanel extends NonioSidebarPanel {
  activeHTML(){ return `
    <div class="panel-header">
      <nonio-sidebar-switcher id="community-switcher"><nonio-select></nonio-select></nonio-sidebar-switcher>
    </div>
    <header>
      <div id="community-avatar">
        <img id="community-avatar-img" alt="">
      </div>
      <nonio-button id="community-subscribe" style="display: none;">Subscribe</nonio-button>
      <div id="community-description">
        <nonio-markdown-view></nonio-markdown-view>
      </div>
    </header>
    <div id="tag-container">
      <content>
        <section id="all-tags">
          <nonio-tag-li href="/#all" hide-subscribe>
            All posts
            <nonio-icon slot="icon" glyph="allPosts"></nonio-icon>
          </nonio-tag-li>
          <nonio-tag-li id="sidebar-submit-post" href="/submit" hide-subscribe>
            Submit post
            <nonio-icon slot="icon" glyph="addPosts"></nonio-icon>
          </nonio-tag-li>
          <nonio-tag-li id="sidebar-community-settings" href="/community/admin" hide-subscribe style="display: none;">
            Community settings
            <nonio-icon slot="icon" glyph="settings"></nonio-icon>
          </nonio-tag-li>
        </section>
        <section id="voice-channels">
          <div class="channels-header">
            <h2>Channels</h2>
            <nonio-button id="channel-create-btn" subtle title="Create channel" style="display: none;">
              <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="7" width="9" height="1" rx="0.5" fill="currentColor"></rect><rect x="7" y="3" width="1" height="9" rx="0.5" fill="currentColor"></rect>'
              </svg>
            </nonio-button>
          </div>
          <div id="channel-list"></div>
        </section>
        <section id="subscribed-tags" style="height: 0px; opacity: 0; display: none;">
          <h2>Subscribed Tags</h2>
          <tags></tags>
        </section>
        <section id="tags">
          <h2>Tags</h2>
          <tags></tags>
        </section>
      </content>
    </div>
    <section id="voice-connection-strip" style="display: none;">
      <div class="voice-connection-row">
        <span class="voice-connection-label">Voice</span>
        <nonio-button id="voice-disconnect" subtle>Connected</nonio-button>
      </div>
    </section>
    <section id="sidebar-user">
      <div id="sidebar-user-logged-in">
        <div class="footer-bar">
          <nonio-user self></nonio-user>
          <div id="sidebar-user-actions">
            <nonio-notification-badge></nonio-notification-badge>
            <nonio-button id="logout-btn" subtle>
              <nonio-icon glyph="logout" size="16"></nonio-icon><span>logout</span>
            </nonio-button>
          </div>
        </div>
      </div>
      <div id="sidebar-user-logged-out" hidden>
        <div class="footer-bar">
          <nonio-link id="login-link" href="#">login</nonio-link>
          <nonio-link id="signup-link" href="#">signup</nonio-link>
          <nonio-link id="about-link" href="/about">about</nonio-link>
        </div>
      </div>
    </section>
  `}

  activatedCallback(){
    const sidebar = this.closest('nonio-sidebar')
    if(!sidebar) return

    this.querySelector('#community-subscribe')?.addEventListener('click', () => sidebar.toggleSubscribe())
    this.querySelector('content')?.addEventListener('subscribe', (e) => sidebar._createSubscribedTag(e))
    this.querySelector('content')?.addEventListener('unsubscribe', (e) => sidebar._removeSubscribedTag(e))

    this.querySelector('#channel-list')?.addEventListener('voice-join', (e) => {
      if (e.detail?.channel) sidebar.joinVoiceChannel(e.detail.channel)
    })
    this.querySelector('#channel-list')?.addEventListener('text-channel-open', (e) => {
      if (e.detail?.channel) sidebar.openTextChannel(e.detail.channel)
    })
    this.querySelector('#channel-create-btn')?.addEventListener('click', () => sidebar.openCreateChannelModal())
    this.querySelector('#voice-disconnect')?.addEventListener('click', () => sidebar.disconnectVoice())

    sidebar._syncAuthUI()
    sidebar._loadCommunities()
    sidebar._loadCommonTags()
    if(sidebar.authToken) sidebar._loadSubscribedTags()
    sidebar._onRouteChange()
    sidebar._loadChannels?.()
    sidebar._updateVoiceUI?.()
    sidebar._renderVoiceParticipants?.()

    // Panel re-renders on activation; repopulate community-dependent DOM even if route didn't change.
    sidebar._updateCommunitySelection?.(sidebar.currentCommunity)
    sidebar._updateCommunityAvatar?.(sidebar.currentCommunity)
    sidebar._toggleCommunityHeaderVisible?.(sidebar.currentCommunity)
    sidebar._populateCommunityDetails?.()
    sidebar._updateLinks?.()
  }
}

export class NonioSidebarUserPanel extends NonioSidebarPanel {
  constructor() {
    super()
    this._routeState = null
    this._currentUsername = ''
    this._currentType = 'posts'
  }

  activeHTML(){ return `
    <div class="panel-header">
      <nonio-sidebar-switcher id="user-switcher">
        <nonio-select>
          <nonio-option slot="selected" value="__user__">
            <nonio-user id="selected-user"></nonio-user>
          </nonio-option>
        </nonio-select>
      </nonio-sidebar-switcher>
    </div>

    <div id="user-panel-header">

      <div id="user-description" hidden>
        <nonio-markdown-view></nonio-markdown-view>
      </div>

      <div class="stats">
        <div class="stat-row">
          <div class="stat">
            <div class="value" value="posts"></div>
            <label>Posts</label>
          </div>
          <div class="stat">
            <div class="value" value="karma"></div>
            <label>Post Karma</label>
          </div>
        </div>
        <div class="stat-row">
          <div class="stat">
            <div class="value" value="comments"></div>
            <label>Comments</label>
          </div>
          <div class="stat">
            <div class="value" value="comment_karma"></div>
            <label>Comment Karma</label>
          </div>
        </div>
      </div>

      <section id="user-content-nav">
        <h2>Content</h2>
        <nonio-tag-li class="type" data-type="posts" hide-subscribe>
          Posts
          <nonio-icon slot="icon" glyph="allPosts" size="16"></nonio-icon>
        </nonio-tag-li>
        <nonio-tag-li class="type" data-type="comments" hide-subscribe>
          Comments
          <nonio-icon slot="icon" glyph="comments" size="16"></nonio-icon>
        </nonio-tag-li>
      </section>

      <section class="admin-links">
        <h2>Admin</h2>
        <nonio-tag-li class="self-action" data-type="settings" href="/admin/settings" hide-subscribe>
          edit profile
          <nonio-icon slot="icon" glyph="create" size="16"></nonio-icon>
        </nonio-tag-li>
        <nonio-tag-li class="self-action" data-type="financials" href="/admin/financials" hide-subscribe>
          view financials
          <nonio-icon slot="icon" glyph="cash" size="16"></nonio-icon>
        </nonio-tag-li>
        <nonio-tag-li class="self-action" data-type="emojis" href="/admin/emojis" hide-subscribe>
          emojis
          <nonio-icon slot="icon" glyph="emoji" size="16"></nonio-icon>
        </nonio-tag-li>
      </section>


      <div class="admin-actions">
        <nonio-button class="nuke-user" danger async><strong>nuke user</strong></nonio-button>
        <nonio-button danger>ban user</nonio-button>
      </div>
    </div>
  `}

  activatedCallback(){
    const sidebar = this.closest('nonio-sidebar')
    if(!sidebar) return
    this._loaded = false

    this.querySelector('#user-content-nav')?.addEventListener('click', (e) => this._onTypeClick(e))
    this.querySelector('.nuke-user')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('user-nuke'))
    })

    sidebar._loadCommunities().then(() => this.querySelector('#user-switcher')?.populate(sidebar._communities))
    this.setRouteState(sidebar._userRouteState)
  }

  setRouteState(routeState){
    this._routeState = routeState || null
    if(this.hasAttribute('active')) this._refreshFromRouteState()
  }

  _renderNavState(){
    this.querySelectorAll('#user-content-nav nonio-tag-li.type').forEach(li => {
      li.toggleAttribute('active', li.dataset.type === this._currentType)
    })
    this.querySelectorAll('.self-action').forEach(li => {
      li.toggleAttribute('active', li.dataset.type === this._currentType)
    })
  }

  _onTypeClick(e){
    const li = e.target.closest('nonio-tag-li.type')
    if(!li?.dataset.type) return
    this._currentType = li.dataset.type
    this._renderNavState()
    window.dispatchEvent(new CustomEvent('user-tab', { detail: { type: li.dataset.type } }))
  }

  _updateTypeHrefs(username){
    const posts = this.querySelector('#user-content-nav nonio-tag-li[data-type="posts"]')
    const comments = this.querySelector('#user-content-nav nonio-tag-li[data-type="comments"]')
    if(posts) posts.setAttribute('href', `/user/${username}`)
    if(comments) comments.setAttribute('href', `/user/${username}#comments`)
  }

  async _refreshFromRouteState(){
    const username = this._routeState?.username || ''
    if(!username) return

    const section = this._routeState?.section
    this._currentType = section === 'comments' || section === 'settings' || section === 'financials'
      ? section
      : 'posts'
    const shouldLoadUser = !this._loaded || this._currentUsername !== username
    this._currentUsername = username

    const selectedUser = this.querySelector('#selected-user')
    if(selectedUser) selectedUser.setAttribute('name', username)

    const sidebar = this.closest('nonio-sidebar')
    this.querySelector('#user-switcher')?.populate(sidebar?._communities || [])
    this._updateTypeHrefs(username)
    this._renderNavState()

    const isSelf = username === window.nonio.username
    this.querySelector('.admin-links')?.toggleAttribute('active', isSelf)
    const isAdmin = !!window.nonio.roles?.includes('admin') && !isSelf
    this.querySelector('.admin-actions')?.toggleAttribute('active', isAdmin)
    if(!shouldLoadUser) return

    this._loaded = true
    const response = await window.nonio.getData(`users/${username}`).catch(() => ({}))
    ;['posts', 'karma', 'comments', 'comment_karma'].forEach(k => {
      const node = this.querySelector(`.value[value="${k}"]`)
      if(node) node.textContent = response?.[k] ?? 0
    })
    const description = (response?.description || '').trim()
    const descriptionWrap = this.querySelector('#user-description')
    const md = descriptionWrap?.querySelector('nonio-markdown-view')
    if(md && description) {
      descriptionWrap.hidden = false
      md.render(description)
    } else if(descriptionWrap) {
      descriptionWrap.hidden = true
    }
  }
}