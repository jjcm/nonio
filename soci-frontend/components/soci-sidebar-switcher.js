import SociComponent from './soci-component.js'
import config from '../config.js'

export default class SociSidebarSwitcher extends SociComponent {
  css(){ return `:host { display: contents; }` }
  html(){ return `<slot></slot>` }

  connectedCallback(){
    this.addEventListener('selected', this._onSelect)
  }

  disconnectedCallback(){
    this.removeEventListener('selected', this._onSelect)
  }

  populate(communities = []){
    const select = this.querySelector('soci-select')
    if(!select) return
    const selected = select.querySelector('soci-option[slot="selected"]')?.outerHTML || ''
    select.innerHTML = selected + SociSidebarSwitcher.optionsHtml(communities)
  }

  static communityAvatar(url){
    return url ? `<img src="${config.AVATAR_HOST}/@${url}.webp" onerror="this.style.display='none'">` : ''
  }

  static optionsHtml(communities = []){
    return `<soci-option id="nonio-community" value=""><img src="/lib/favicon.svg"><span>Nonio</span></soci-option>`
      + communities.filter(c => c?.url).map(c =>
        `<soci-option value="${c.url}">${SociSidebarSwitcher.communityAvatar(c.url)}${c.name || c.url}</soci-option>`
      ).join('')
      + `<soci-option value="__create__" style="border-top: 1px solid var(--bg-secondary); color: var(--text-brand);">+ Create Community</soci-option>`
  }

  _onSelect = (e) => {
    const val = e.target.getAttribute('value')
    if(val === '__user__') return
    const sidebar = this.closest('soci-sidebar')
    if(val === '__create__'){
      sidebar?.openCreateCommunity?.()
      sidebar?._updateCommunitySelection?.(sidebar?.currentCommunity)
      return
    }
    const href = val ? `/@${val}` : '/'
    window.history.pushState(null, null, href)
    window.dispatchEvent(new CustomEvent('link'))
  }
}
