import NonioComponent from './nonio-component.js'
import config from '../config.js'

export default class NonioSidebarSwitcher extends NonioComponent {
  css(){ return `:host { display: contents; }` }
  html(){ return `<slot></slot>` }

  connectedCallback(){
    this.addEventListener('selected', this._onSelect)
  }

  disconnectedCallback(){
    this.removeEventListener('selected', this._onSelect)
  }

  populate(communities = []){
    const select = this.querySelector('nonio-select')
    if(!select) return
    const selected = select.querySelector('nonio-option[slot="selected"]')?.outerHTML || ''
    select.innerHTML = selected + NonioSidebarSwitcher.optionsHtml(communities)
  }

  static communityAvatar(url){
    return url ? `<img src="${config.AVATAR_HOST}/@${url}.webp" onerror="this.style.display='none'">` : ''
  }

  static optionsHtml(communities = []){
    return `<nonio-option id="nonio-community" value=""><img src="/lib/favicon.svg"><span>Nonio</span></nonio-option>`
      + communities.filter(c => c?.url).map(c =>
        `<nonio-option value="${c.url}">${NonioSidebarSwitcher.communityAvatar(c.url)}${c.name || c.url}</nonio-option>`
      ).join('')
      + `<nonio-option value="__create__" style="border-top: 1px solid var(--bg-secondary); color: var(--text-brand);">+ Create Community</nonio-option>`
  }

  _onSelect = (e) => {
    const val = e.target.getAttribute('value')
    if(val === '__user__') return
    const sidebar = this.closest('nonio-sidebar')
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
