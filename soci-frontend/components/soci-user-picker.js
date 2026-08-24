import SociComponent from './soci-component.js'

export default class SociUserPicker extends SociComponent {
  constructor() {
    super()
    this._searchTimer = null
    this._results = []
    this._selectedIndex = -1
    this._closeSuggestions = this._closeSuggestions.bind(this)
  }

  css() { return `
    :host {
      display: block;
      width: 100%;
    }
    .wrapper {
      position: relative;
    }
    .field {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--bg-secondary);
      border: 1px solid var(--bg-secondary);
      border-radius: 8px;
      padding: 8px 10px;
    }
    input {
      flex: 1;
      border: 0;
      background: transparent;
      color: var(--text);
      font-size: 14px;
      outline: none;
    }
    soci-button {
      flex-shrink: 0;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 4px;
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: var(--bg);
      border: 1px solid var(--bg-secondary);
      border-radius: 8px;
      box-shadow: 0 8px 16px var(--shadow-light);
      max-height: 220px;
      overflow: auto;
      display: none;
      z-index: 10;
    }
    ul[open] {
      display: block;
    }
    soci-user {
      display: block;
      padding: 8px 10px;
      border-radius: 6px;
      cursor: pointer;
    }
    soci-user[selected] {
      background: var(--bg-secondary);
    }
  `}

  html() { 
    const label = this.getAttribute('action-label') || 'Add'
    const placeholder = this.getAttribute('placeholder') || 'Search users'
    return `
      <div class="wrapper">
        <div class="field">
          <input type="text" autocomplete="off" placeholder="${placeholder}" @input=_onInput @keydown=_onKeyDown />
          <soci-button type="button" @click=_submit>${label}</soci-button>
        </div>
        <ul id="results"></ul>
      </div>
    `
  }

  connectedCallback() {
    this._input = this.select('input')
    this._list = this.select('#results')
    this._wrapper = this.select('.wrapper')
    this._input.addEventListener('focus', ()=> this._toggleList(this._results.length > 0))
  }

  disconnectedCallback() {
    document.removeEventListener('click', this._closeSuggestions)
  }

  _onInput(e) {
    const query = e.target.value.trim()
    clearTimeout(this._searchTimer)
    if(query.length < 2) {
      this._results = []
      this._renderResults('')
      this._toggleList(false)
      return
    }
    this._searchTimer = setTimeout(()=> this._search(query), 150)
  }

  async _search(query) {
    this._activeQuery = query
    let res = await this.getData(`/users/search?q=${encodeURIComponent(query)}`, this.authToken)
    if(this._activeQuery !== query) return
    let users = Array.isArray(res?.users) ? res.users : []
    this._results = users.map(u => typeof u === 'string' ? {username: u} : u)
    this._renderResults(query)
  }

  _renderResults(query) {
    this._list.innerHTML = ''
    this._selectedIndex = -1
    const suggestions = (this._results && this._results.length) ? this._results : (query ? [{username: query, isNew: true}] : [])
    suggestions.forEach((user, idx) => {
      const item = document.createElement('soci-user')
      item.setAttribute('name', user.username)
      item.setAttribute('data-username', user.username)
      item.addEventListener('click', () => {
        this._setSelection(idx)
        this._submit()
      })
      if(idx === 0) {
        item.setAttribute('selected', '')
        this._selectedIndex = 0
      }
      this._list.appendChild(item)
    })
    this._toggleList(suggestions.length > 0)
  }

  _toggleList(open) {
    this._list.toggleAttribute('open', !!open)
    if(open) {
      document.addEventListener('click', this._closeSuggestions)
    } else {
      document.removeEventListener('click', this._closeSuggestions)
    }
  }

  _closeSuggestions(e) {
    if(e && (this.contains(e.target) || this.shadowRoot.contains(e.target))) return
    this._toggleList(false)
  }

  _setSelection(index) {
    const items = Array.from(this._list.querySelectorAll('soci-user'))
    if(!items.length) return
    if(index < 0) index = items.length - 1
    if(index >= items.length) index = 0
    items.forEach(li => li.removeAttribute('selected'))
    items[index].setAttribute('selected', '')
    this._selectedIndex = index
    this._input.value = items[index].dataset.username
  }

  _onKeyDown(e) {
    if(e.key === 'Enter') {
      e.preventDefault()
      this._submit()
      return
    }
    if(e.key === 'ArrowDown') {
      e.preventDefault()
      this._setSelection(this._selectedIndex + 1)
      return
    }
    if(e.key === 'ArrowUp') {
      e.preventDefault()
      this._setSelection(this._selectedIndex - 1)
      return
    }
    if(e.key === 'Escape') {
      this._toggleList(false)
    }
  }

  _submit() {
    const username = (this._input.value || '').trim()
    if(!username) return
    this.dispatchEvent(new CustomEvent('userselected', {detail: {username}, bubbles: true, composed: true}))
    this._input.value = ''
    this._results = []
    this._selectedIndex = -1
    this._renderResults('')
  }
}

