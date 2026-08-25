import SociComponent from './soci-component.js'
import config from '../config.js'
import { polyfill, unpolyfill, relayout, SUPPORTS_GRID_LANES } from '../lib/grid-lanes-polyfill.js'
import { filterToType } from '../lib/post-filter.js'

export default class SociPostList extends SociComponent {
  constructor() {
    super()
    this._postsData = null
    this._fetchController = null // incremental merge request
    this._loadController = null // main list load request
    this._renderGeneration = 0
    this._items = null
    this._masonryDebugTimers = []
    this._initializing = false

    this._onCardLoaded = () => {
      if(this.getAttribute('view') === 'lanes' && this._items) relayout(this._items)
    }
    this._onHashChange = () => this._syncFromLocation()
    this._onVotesLoaded = () => this._applyVotes()
  }

  css(){
    return `
      :host {
        display: block;
        width: 100%;
        height: 100dvh;
        overflow: hidden;
        background: var(--bg-bold);
        box-sizing: border-box;
        container-type: inline-size;
      }

      scroll-container {
        overflow: auto;
        width: 100%;
        height: 100%;
        display: block;
        scrollbar-width: none;
        &::-webkit-scrollbar { display: none; }
      }
      content { display: block; }

      header {
        background-color: var(--bg);
        position: sticky;
        top: 0;
        height: 40px;
        width: 100%;
        z-index: 2;
        display: flex;
        padding: 0 12px;
        box-sizing: border-box;
        gap: 8px;
        align-items: center;
        box-shadow: 0 1px 2px var(--shadow);
      }

      #tag-input-container {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 100px;
        max-width: 278px;
        width: 100%;
        margin-right: -8px;
        position: relative;
      }
      #tag-input {
        height: 28px;
        box-sizing: border-box;
        padding: 0 10px 2px 28px;
        border: 1px solid color-mix(in srgb, var(--bg-bold) 50%, transparent);
        border-radius: 4px;
        background: color-mix(in srgb, var(--bg-bold) 50%, transparent);
        color: var(--text);
        font-size: 14px;
        font-family: inherit;
        outline: none;
        width: 100%;
        &::placeholder { color: var(--text-tertiary); }
        &:focus {
          border-color: var(--bg-secondary);
          background: color-mix(in srgb, var(--bg-bold) 70%, transparent);
        }
      }
      #hash {
        position: absolute;
        left: 6px;
        top: 6px;
        pointer-events: none;
        width: 16px;
        height: 16px;
        background: var(--bg-brand);
        color: var(--text-inverse);
        border-radius: 3px;
      }

      .divider {
        width: 1px;
        height: 20px;
        background: var(--bg-secondary);
        margin: 0 4px;
      }
      #tag-input-divider {
        opacity: 0;
        transition: opacity 0.4s var(--soci-ease);
      }
      #header-spacer { flex: 1; }
      #controls {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      soci-select {
        --height: 30px;
        --color: var(--text-secondary);
        display: none;
      }
      soci-option[slot="selected"] {
        border-radius: 3px;
        white-space: nowrap;
      }
      soci-radio-button-group { display: flex; }

      soci-radio-button-group soci-radio-button[selected]::after {
        content:'';
        display: block;
        position: absolute;
        top: 32px;
        width: 16px;
        height: 3px;
        border-radius: 0 0 2px 2px;
        background: var(--bg);
        box-shadow: 0 1px 1px var(--shadow);
      }

      #menu {
        display: none;
        cursor: pointer;
        border-radius: 3px;
        flex-shrink: 0;
        &:hover { background-color: var(--bg-secondary); }
      }

      #view-buttons, #filter-buttons {
        padding: 4px;
        soci-radio-button {
          width: 24px;
          height: 24px;
          padding: 0 2px;
          margin-right: 2px;
          &:last-child { margin-right: 0px; }
        }
        soci-icon {
          width: 16px;
          height: 16px;
        }
      }

      #items {
        padding: 12px 12px 28px;
        box-sizing: border-box;
        opacity: 0;
        transform: translateY(6px);
      }
      /* In lanes view we animate cards individually; keep the container visible. */
      :host([view="lanes"]) #items {
        opacity: 1;
        transform: none;
      }
      :host([loaded]) #items {
        transform: translateY(0);
        opacity: 1;
        transition: transform 0.175s cubic-bezier(0.15, 0, 0.2, 1), opacity 0.175s var(--soci-ease-out);
      }
      #items::slotted(soci-post-li) {
        margin-top: 8px;
      }
      #items::slotted(soci-post-li:first-child) {
        margin-top: 0;
      }

      /* Grid lanes layout - future native CSS */
      :host([view="lanes"]) #items {
        display: grid-lanes;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 12px;
        --grid-lanes: true;
      }
      /* Prevent vertical-list flash before grid-lanes polyfill positions children (slotted). */
      :host([view="lanes"]) #items[data-grid-lanes-container]::slotted(*) {
        opacity: 0;
        transform: translateY(6px);
        pointer-events: none;
        transition: opacity 0.125s var(--soci-ease), transform 0.125s var(--soci-ease);
      }
      :host([view="lanes"]) #items[data-grid-lanes-container]::slotted([data-grid-lanes-positioned]) {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }
      :host([view="lanes"]) #items[data-grid-lanes-container]::slotted([data-grid-lanes-positioned][unloaded]) {
        opacity: 0;
        transform: translateY(6px);
        pointer-events: none;
      }

      @media (max-width: 480px) {
        .divider { display: none; }
      }
      @media (max-width: 820px) {
        #filter-buttons { display: none; }
        #filter-select { display: block; }
      }
      @media (max-width: 768px) {
        #menu { display: block; }
        #filter-buttons { display: flex; }
        #filter-select { display: none; }
      }
      @media (max-width: 620px) {
        #filter-buttons { display: none; }
        #filter-select { display: block; }
      }
      @media (max-width: 1024px) {
        #tag-input-container { max-width: 100%; }
        #sort-buttons { display: none; }
        #sort-select { display: block; }
      }
      @media (max-width: 1128px) {
        #tag-input-divider { opacity: 1; }
      }
    `
  }

  html(){
    return `
      <scroll-container>
        <content>
          <header>
            <soci-icon id="menu" glyph="menu" @click=_menuClick></soci-icon>
            <div id="tag-input-container">
              <input id="tag-input" type="text" placeholder="Viewing all tags" @keydown=_tagKeydown @blur=_tagBlur>
              <soci-icon id="hash" glyph="hash"></soci-icon>
            </div>
            <div id="header-spacer"></div>
            <div id="controls">
              <div class="divider" id="tag-input-divider"></div>
              <soci-select id="sort-select">
                <soci-option slot="selected" value="popular">Popular</soci-option>
                <soci-option value="new">New</soci-option>
                <soci-option value="day">Top - Day</soci-option>
                <soci-option value="week">Top - Week</soci-option>
                <soci-option value="month">Top - Month</soci-option>
                <soci-option value="year">Top - Year</soci-option>
                <soci-option value="all">Top - All Time</soci-option>
              </soci-select>
              <soci-radio-button-group id="sort-buttons">
                <soci-radio-button value="popular" selected>popular</soci-radio-button>
                <soci-radio-button value="new">new</soci-radio-button>
                <soci-radio-button value="week">week</soci-radio-button>
                <soci-radio-button value="month">month</soci-radio-button>
                <soci-radio-button value="year">year</soci-radio-button>
                <soci-radio-button value="all">all</soci-radio-button>
              </soci-radio-button-group>
              <div class="divider"></div>
              <soci-select id="filter-select" dropdown-horizontal-position="right">
                <soci-option slot="selected" value="all">All</soci-option>
                <soci-option value="links">Links</soci-option>
                <soci-option value="images">Images</soci-option>
                <soci-option value="videos">Videos</soci-option>
                <soci-option value="blogs">Blogs</soci-option>
              </soci-select>
              <soci-radio-button-group id="filter-buttons">
                <soci-radio-button value="all" selected>
                  <soci-icon glyph="allPosts"></soci-icon>
                </soci-radio-button>
                <soci-radio-button value="images">
                  <soci-icon glyph="filterImages"></soci-icon>
                </soci-radio-button>
                <soci-radio-button value="videos">
                  <soci-icon glyph="filterVideos"></soci-icon>
                </soci-radio-button>
                <soci-radio-button value="blogs">
                  <soci-icon glyph="filterBlogs"></soci-icon>
                </soci-radio-button>
                <soci-radio-button value="links">
                  <soci-icon glyph="filterLinks"></soci-icon>
                </soci-radio-button>
              </soci-radio-button-group>
              <div class="divider"></div>
              <soci-radio-button-group id="view-buttons">
                <soci-radio-button value="list" title="List view" selected>
                  <soci-icon glyph="viewList"></soci-icon>
                </soci-radio-button>
                <soci-radio-button value="lanes" title="Grid lanes view">
                  <soci-icon glyph="viewLanes"></soci-icon>
                </soci-radio-button>
              </soci-radio-button-group>
            </div>
          </header>
          <div id="items"><slot></slot></div>
        </content>
      </scroll-container>
    `
  }

  static get observedAttributes() {
    return ['tag', 'filter', 'sort', 'view', 'community', 'data', 'user']
  }

  attributeChangedCallback(name, oldValue, newValue){
    if(oldValue === newValue) return
    switch(name){
      case 'tag':
      case 'sort':
      case 'community':
      case 'data':
      case 'user':
        this._syncTagInput()
        this._updateTitle()
        this._refreshData()
        break
      case 'filter':
        this._applyFilter(newValue)
        // Skip while initializing: connectedCallback's _refreshData() is about
        // to load this exact URL, and fetchAndMerge has no dedupe guard, so
        // reacting here would request it a second time on every navigation.
        if(!this._initializing) this._refreshFilterFetch()
        break
      case 'view':
        this._updateView(newValue)
        break
    }
  }

  connectedCallback() {
    this._items = this.select('#items')
    this._itemsSlot = this.select('#items slot')

    this.select('#sort-select')?.addEventListener('selected', this._sortChanged.bind(this))
    this.select('#filter-select')?.addEventListener('selected', this._filterChanged.bind(this))
    this.select('#sort-buttons')?.addEventListener('change', this._sortGroupChanged.bind(this))
    this.select('#filter-buttons')?.addEventListener('change', this._filterGroupChanged.bind(this))
    this.select('#view-buttons')?.addEventListener('change', this._viewGroupChanged.bind(this))

    this.addEventListener('card-loaded', this._onCardLoaded)
    window.addEventListener('hashchange', this._onHashChange)
    document.addEventListener('votesloaded', this._onVotesLoaded)

    this._initializeControls()
    this._syncFromLocation()
    this._refreshData()
  }

  disconnectedCallback() {
    if(this._itemsSlot) unpolyfill(this._itemsSlot)
    this.removeEventListener('card-loaded', this._onCardLoaded)
    window.removeEventListener('hashchange', this._onHashChange)
    document.removeEventListener('votesloaded', this._onVotesLoaded)
    if(this._fetchController) this._fetchController.abort()
    if(this._loadController) this._loadController.abort()
  }

  _menuClick(){
    document.querySelector('soci-sidebar')?.toggleAttribute('overlay', true)
  }

  _initializeControls(){
    this._initializing = true
    const savedSort = localStorage.getItem('soci-column-sort')
    const savedFilter = localStorage.getItem('soci-column-filter')
    const savedView = localStorage.getItem('soci-column-view')

    const sort = this.getAttribute('sort') || savedSort || 'popular'
    const filter = this.getAttribute('filter') || savedFilter || 'all'
    const view = this.getAttribute('view') || savedView || 'list'

    this._currentSort = sort
    this._currentFilter = filter
    this._currentView = view

    this._updateSortUI(sort)
    this._updateFilterUI(filter)
    this.select('#view-buttons')?.setAttribute('value', view)

    this.setAttribute('sort', sort)
    this.setAttribute('filter', filter)
    this.setAttribute('view', view)
    this._initializing = false
  }

  _updateSortUI(sort){
    this.select('#sort-buttons')?.setAttribute('value', sort)
    this._syncSelectValue(this.select('#sort-select'), sort)
  }

  _updateFilterUI(filter){
    this.select('#filter-buttons')?.setAttribute('value', filter)
    this._syncSelectValue(this.select('#filter-select'), filter)
  }

  _syncSelectValue(select, value){
    if(!select) return
    const options = Array.from(select.querySelectorAll('soci-option'))
    const normalizedValue = String(value || '').toLowerCase()
    const target = options.find(option => {
      const optionValue = (option.getAttribute('value') || option.textContent.trim()).toLowerCase()
      return optionValue === normalizedValue
    })
    if(!target) return
    options.forEach(option => option.removeAttribute('slot'))
    target.setAttribute('slot', 'selected')
  }

  _sortChanged(){
    this.setAttribute('sort', this.select('#sort-select')?.value)
    localStorage.setItem('soci-column-sort', this.getAttribute('sort') || 'popular')
  }

  _filterChanged(){
    this.setAttribute('filter', this.select('#filter-select')?.value)
    localStorage.setItem('soci-column-filter', this.getAttribute('filter') || 'all')
  }

  _sortGroupChanged(e){
    const sort = e.detail?.value
    if(sort) {
      this.setAttribute('sort', sort)
      localStorage.setItem('soci-column-sort', sort)
    }
  }

  _filterGroupChanged(e){
    const filter = e.detail?.value
    if(filter) {
      this.setAttribute('filter', filter)
      localStorage.setItem('soci-column-filter', filter)
    }
  }

  _viewGroupChanged(e){
    const view = e.detail?.value
    if(!view) return
    this.setAttribute('view', view)
    localStorage.setItem('soci-column-view', view)
  }

  _syncTagInput(){
    const input = this.select('#tag-input')
    if (!input) return
    const tag = this.getAttribute('tag') || ''
    input.value = tag === 'all' ? '' : `${tag}`
  }

  _tagKeydown(e){
    if (e.key !== 'Enter') return
    e.preventDefault()
    this._navigateToTag()
  }

  _tagBlur(){
    this._syncTagInput()
  }

  _navigateToTag(){
    const input = this.select('#tag-input')
    if (!input) return

    let tag = input.value.trim().replace(/^#/, '')
    if (!tag) tag = 'all'

    const community = this.getAttribute('community') || window.soci?.routeContext?.community
    const basePath = community ? `/@${community}` : ''
    const hashPath = tag === 'all' ? '#all' : `#${encodeURIComponent(tag)}`

    window.history.pushState(null, null, basePath + '/' + hashPath)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }

  _syncFromLocation(){
    const raw = window.location.hash.replace(/^#/, '')
    const first = raw.split('+')[0]
    const tag = decodeURIComponent(first || 'all')
    if(tag && tag !== this.getAttribute('tag')) this.setAttribute('tag', tag)
    this._syncTagInput()
    if(!/^\/user\//.test(window.location.pathname || '')) document.querySelector('soci-sidebar')?.activateTag(tag)
  }

  _updateTitle(){
    let filter = this.getAttribute('filter') || 'all'
    if(!filter || filter === 'all') filter = 'Posts'
    else filter = filter.charAt(0).toUpperCase() + filter.slice(1)
    const tag = this.getAttribute('tag') || 'all'
    if(tag === 'all') document.title = (this.getAttribute('filter') && this.getAttribute('filter') !== 'all') ? `All ${this.getAttribute('filter')}` : 'All posts'
    else document.title = filter + ' in #' + tag
  }

  _buildPostsUrl(){
    const dataAttr = this.getAttribute('data')
    if(dataAttr) {
      const url = new URL(dataAttr, 'http://x')
      const sort = this.getAttribute('sort') || this._currentSort || 'popular'
      const filter = this.getAttribute('filter') || this._currentFilter || 'all'
      if(sort === 'new') {
        url.searchParams.set('sort', 'new')
        url.searchParams.delete('time')
      } else if(['day','week','month','year'].includes(sort)) {
        url.searchParams.set('sort', 'top')
        url.searchParams.set('time', sort)
      } else {
        url.searchParams.set('sort', sort || 'popular')
      }
      const type = filterToType(filter)
      if(type) url.searchParams.set('type', type)
      else url.searchParams.delete('type')
      return url.pathname + (url.search || '')
    }

    let params = []
    const sort = this.getAttribute('sort') || this._currentSort || 'popular'
    const filter = this.getAttribute('filter') || this._currentFilter || 'all'

    switch(sort){
      case 'new':
        params.push('sort=new')
        break
      case 'day':
        params.push('sort=top', 'time=day')
        break
      case 'week':
        params.push('sort=top', 'time=week')
        break
      case 'month':
        params.push('sort=top', 'time=month')
        break
      case 'year':
        params.push('sort=top', 'time=year')
        break
    }

    const tag = this.getAttribute('tag')
    if(tag && tag !== 'all') params.push(`tag=${encodeURIComponent(tag)}`)

    const community = this.getAttribute('community') || window.soci?.routeContext?.community
    if(community) params.push(`community=${encodeURIComponent(community)}`)

    const user = this.getAttribute('user')
    if(user) params.push(`user=${encodeURIComponent(user)}`)

    const type = filterToType(filter)
    if(type) params.push(`type=${encodeURIComponent(type)}`)

    return '/posts' + (params.length ? `?${params.join('&')}` : '')
  }

  async _refreshData(){
    // Attributes set before insertion (pages create the list, set tag or
    // community, then append) would otherwise start a fetch that the sort
    // and filter applied in connectedCallback immediately abort and redo.
    if(!this.isConnected) return
    const url = this._buildPostsUrl()
    if(url === this._currentDataUrl) return
    this._currentDataUrl = url
    await this._loadPosts(url)
  }

  _refreshFilterFetch(){
    if(!this.isConnected) return
    this._updateTitle()
    this.fetchAndMerge(this._buildPostsUrl())
  }

  // Upvote chrome is stamped at render time from soci.votes; when /votes
  // resolves after the feed has painted, re-mark in place (additive only, so
  // a vote the user just clicked is never stripped by a stale response).
  _applyVotes(){
    const votes = window.soci?.votes || {}
    this.querySelectorAll('soci-post-li, soci-post-card').forEach(post => {
      const upvoted = votes[post.getAttribute('post-id')]
      if(!upvoted?.length) return
      post.querySelectorAll('soci-tag[tag-id]').forEach(tag => {
        if(upvoted.includes(parseInt(tag.getAttribute('tag-id')))) tag.toggleAttribute('upvoted', true)
      })
    })
  }

  async _loadPosts(url){
    if(this._loadController) this._loadController.abort()
    this._loadController = new AbortController()
    const signal = this._loadController.signal

    this.toggleAttribute('loaded', false)
    try {
      const options = { signal }
      if(this.authToken) options.headers = { Authorization: 'Bearer ' + this.authToken }

      // The shell may have started this exact request before any module
      // loaded (index.pug __preFetch); consuming it saves a network round
      // trip on cold loads. Anonymous only, so responses are identical.
      const pre = !this.authToken && window.__preFetch?.[url]
      if(pre) delete window.__preFetch[url]
      const data = await (pre
        ? pre.catch(() => fetch(config.API_HOST + url, options).then(r => r.json()))
        : fetch(config.API_HOST + url, options).then(r => r.json()))
      if(signal.aborted) return

      this._postsData = data.posts || []
      this._dedupePostsData()
      this._applyFilter(this.getAttribute('filter'))
    } catch(e) {
      if(e.name !== 'AbortError') throw e
    } finally {
      if(!signal.aborted) this.toggleAttribute('loaded', true)
    }
  }

  _applyFilter(filter){
    this._renderGeneration++
    if(!this._postsData) return

    const type = filterToType(filter)
    if(!type) {
      this.createPosts([...this._postsData])
      return
    }

    this.createPosts(this._postsData.filter(p => p.type === type))
  }

  _dedupePostsData(){
    if(!this._postsData?.length) return
    const seen = new Set()
    this._postsData = this._postsData.filter(p => {
      const id = String(p.ID)
      if(seen.has(id)) return false
      seen.add(id)
      return true
    })
  }

  async fetchAndMerge(url){
    if(this._fetchController) this._fetchController.abort()
    this._fetchController = new AbortController()

    const currentFilter = this.getAttribute('filter')

    try {
      const options = { signal: this._fetchController.signal }
      if(this.authToken) options.headers = { Authorization: 'Bearer ' + this.authToken }

      const response = await fetch(config.API_HOST + url, options)
      const data = await response.json()

      if(this.getAttribute('filter') !== currentFilter) return
      if(!data.posts?.length) return

      const domIds = new Set(
        Array.from(this.querySelectorAll('soci-post-li, soci-post-card'))
          .map(el => el.getAttribute('post-id'))
      )
      const cacheIds = new Set((this._postsData || []).map(p => String(p.ID)))
      const existingIds = new Set([...domIds, ...cacheIds])

      const newPosts = data.posts.filter(post => !existingIds.has(String(post.ID)))
      if(!newPosts.length) return

      this._postsData = [...(this._postsData || []), ...newPosts]
      this._dedupePostsData()

      const isLanes = this.getAttribute('view') === 'lanes'
      const renderFn = isLanes ? this.renderPostCard.bind(this) : this.renderPostLi.bind(this)

      newPosts.forEach((post, i) => {
        const tempDom = document.createElement('div')
        tempDom.innerHTML = renderFn(post)
        const postEl = tempDom.firstElementChild
        if(!postEl) return

        postEl.style.opacity = '0'
        postEl.style.transform = 'translateY(12px)'
        this.appendChild(postEl)

        setTimeout(() => {
          postEl.style.transition = 'opacity 0.3s var(--soci-ease), transform 0.3s var(--soci-ease)'
          postEl.style.opacity = '1'
          postEl.style.transform = 'translateY(0)'
        }, i * 50)
      })

      if(isLanes && this._itemsSlot) relayout(this._itemsSlot)
    } catch(e) {
      if(e.name !== 'AbortError') throw e
    }
  }

  _updateView(view) {
    if(this._itemsSlot) unpolyfill(this._itemsSlot)
    if(this._postsData) this._applyFilter(this.getAttribute('filter'))
  }

  async createPosts(data){
    const generation = ++this._renderGeneration
    const isLanes = this.getAttribute('view') === 'lanes'
    const renderFn = isLanes ? this.renderPostCard.bind(this) : this.renderPostLi.bind(this)
    if(!this._itemsSlot) return

    if(isLanes) this._scheduleMasonryFlashDebug(generation, 'createPosts(start)')

    if(isLanes) {
      // Ensure our shadow-scoped "hide until positioned" CSS applies immediately (prevents pre-polyfill flash).
      if(!SUPPORTS_GRID_LANES) this._items.setAttribute('data-grid-lanes-container', '')

      this.innerHTML = ''

      this._masonryFlashDebug('polyfill(call)')
      polyfill(this._itemsSlot, true)
      this._masonryFlashDebug('polyfill(return)')

      await this._renderPostCardsSequential(data, generation)
      return
    }

    let numberToRender = Math.ceil(window.innerHeight / 104)
    this.innerHTML = data.splice(0, numberToRender).map(renderFn).join('')

    const renderNextPost = (remainingPosts) => {
      if (remainingPosts.length === 0) return
      if (this._renderGeneration !== generation) return

      const ric = window.requestIdleCallback || (cb => setTimeout(cb, 0))
      ric(() => {
        if (this._renderGeneration !== generation) return
        if(!this._itemsSlot) return

        const temp = document.createElement('div')
        temp.innerHTML = renderFn(remainingPosts[0])
        this.appendChild(temp.firstElementChild)
        renderNextPost(remainingPosts.slice(1))
      })
    }

    renderNextPost(data)
  }

  async _renderPostCardsSequential(posts, generation){
    while(posts.length) {
      if(this._renderGeneration !== generation) return
      if(!this._itemsSlot) return

      const tempDom = document.createElement('div')
      tempDom.innerHTML = this.renderPostCard(posts.shift())
      const el = tempDom.firstElementChild
      if(!el) continue

      el.setAttribute('unloaded', '')
      this.appendChild(el)

      // Trigger layout; the polyfill will mark `[data-grid-lanes-positioned]` when done.
      relayout(this._itemsSlot)

      if(SUPPORTS_GRID_LANES) {
        await new Promise(requestAnimationFrame)
      } else {
        await this._waitForGridLanesPositioned(el, generation)
      }

      if(this._renderGeneration !== generation) return
      el.removeAttribute('unloaded')

      // Yield to avoid locking the main thread (lets paint/input happen between cards).
      await new Promise(r => setTimeout(r, 1))
    }
  }

  _waitForGridLanesPositioned(el, generation){
    if(el.hasAttribute('data-grid-lanes-positioned')) return Promise.resolve()
    return new Promise(resolve => {
      if(this._renderGeneration !== generation) return resolve()

      let done = false
      let timer = null
      const finish = () => {
        if(done) return
        done = true
        clearTimeout(timer)
        mo.disconnect()
        resolve()
      }

      const mo = new MutationObserver(() => {
        if(this._renderGeneration !== generation) return finish()
        if(el.hasAttribute('data-grid-lanes-positioned')) finish()
      })
      mo.observe(el, { attributes: true, attributeFilter: ['data-grid-lanes-positioned'] })

      // Safety: don't deadlock if something goes wrong; still allow the feed to appear.
      timer = setTimeout(finish, 2500)
    })
  }

  _masonryFlashDebug(label){
    if(localStorage.getItem('soci-debug-masonry-flash') !== '1') return
    if(!this._items) return

    const children = Array.from(this.querySelectorAll('soci-post-li, soci-post-card'))
    const positioned = this.querySelectorAll('[data-grid-lanes-positioned]').length

    const itemsOpacity = getComputedStyle(this._items).opacity
    const first = children[0]
    const firstOpacity = first ? getComputedStyle(first).opacity : '(none)'
    const firstVis = first ? getComputedStyle(first).visibility : '(none)'

    console.log('[soci-post-list][masonry-flash]', {
      t: Math.round(performance.now()),
      label,
      view: this.getAttribute('view'),
      loaded: this.hasAttribute('loaded'),
      containerAttr: this._items.hasAttribute('data-grid-lanes-container'),
      childCount: children.length,
      positioned,
      itemsOpacity,
      firstOpacity,
      firstVis,
    })
  }

  _scheduleMasonryFlashDebug(generation, label){
    if(localStorage.getItem('soci-debug-masonry-flash') !== '1') return

    this._masonryDebugTimers.forEach(id => clearTimeout(id))
    this._masonryDebugTimers = []

    const logIfCurrent = (tLabel) => {
      if(this._renderGeneration !== generation) return
      this._masonryFlashDebug(tLabel)
    }

    logIfCurrent(label)
    ;[2000, 4000, 6000, 8000].forEach(ms => {
      this._masonryDebugTimers.push(setTimeout(() => logIfCurrent(`${label}+${ms}ms`), ms))
    })
  }

  renderPostLi(post, i){
    // First screen of rows (the initial synchronous batch) loads media
    // eagerly for LCP; everything rendered later is below the fold and
    // lazy-loads on scroll.
    return`
      <soci-post-li ${i !== undefined && i < 12 ? 'eager ' : ''}post-title="${post.title.replaceAll('"', '&quot;')}" url="${post.url}" post-id="${post.ID}" score=${post.score || 0} comments=${post.commentCount || 0} type=${post.type || 'image'} time=${post.time} ${post.link ? `link=${post.link}` : ''} ${post.community ? `community="${post.community}"` : ''} ${post.type == 'video' && post.width ? `width=${post.width} height=${post.height}` : ''}>
        <soci-user name="${post.user}" slot="user"></soci-user>
        <soci-tag-group slot="tags">
          ${this.sortTags(post.tags).map(tag => `<soci-tag tag="${tag.tag}" score="${tag.score}" tag-id="${tag.tagID}" ${soci.votes[post.ID]?.includes(tag.tagID) ? 'upvoted':''}></soci-tag>`).join('')}
        </soci-tag-group>
      </soci-post-li>
    `
  }

  renderPostCard(post){
    const desc = post.content ? `<soci-markdown-view slot="description" markdown="${this._escapeAttr(post.content)}"></soci-markdown-view>` : ''
    return`
      <soci-post-card post-title="${post.title.replaceAll('"', '&quot;')}" url="${post.url}" post-id="${post.ID}" score=${post.score || 0} comments=${post.commentCount || 0} type=${post.type || 'image'} time=${post.time} ${post.link ? `link="${post.link}"` : ''} ${post.community ? `community="${post.community}"` : ''}>
        ${desc}
        <soci-user name="${post.user}" slot="user"></soci-user>
        <soci-tag-group slot="tags">
          ${this.sortTags(post.tags).map(tag => `<soci-tag tag="${tag.tag}" score="${tag.score}" tag-id="${tag.tagID}" ${soci.votes[post.ID]?.includes(tag.tagID) ? 'upvoted':''}></soci-tag>`).join('')}
        </soci-tag-group>
      </soci-post-card>
    `
  }

  _escapeAttr(s){
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('\n', '&#10;')
  }
}
