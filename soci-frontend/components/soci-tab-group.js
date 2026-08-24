import SociComponent from './soci-component.js'

export default class SociTabGroup extends SociComponent {
  constructor() {
    super()
  }

  css(){
    return `
      :host {
        --max-width: 920px;
      }

      tabs {
        display: flex;
        color: var(--text);
        padding-top: 4px;
        margin-bottom: 10px;
        user-select: none;
        position: relative;
        max-width: var(--max-width);
        margin: 0 auto;
      }

      tab {
        display: block;
        padding: 8px;
        text-transform: capitalize;
        position: relative;
        padding: 0 12px 2px;
        cursor: pointer;
        font-weight: 500;
        font-size: 12px;
        line-height: 18px;
        position: relative;
        z-index: 2;
        color: var(--text-secondary);
        border-radius: 3px;
        margin-right: 8px;
      }

      tab:before {
        position: absolute;
        content: ''; 
        left: 0;
        top: -10px;
        height: 40px;
        width: 100%;
        background: transparent;
      }
      tab:hover {
        color: var(--text-hover);
      }
      tab[active] {
        opacity: 1;
        color: var(--text-brand-bold);
        background: var(--bg-secondary);
      }
      tab[active]:hover {
        color: var(--text-brand-hover);
      }
    ` 
  }

  html(){ return `
      <tabs @click=_tabClick>
        ${this._createTabs()}
      </tabs>
      <slot></slot>
    `
  }

  connectedCallback(){
    this.addEventListener('tabactivate', this._tabActivated)
  }

  _createTabs(){
    let tabs = Array.from(this.querySelectorAll('soci-tab'))
    return `
      ${tabs.map((tab, i) => {
        let name = tab.getAttribute('name')
        if(!name) this.log('Tab is missing a name')
        return `<tab name=${name} ${i==0 ? 'active' : ''}>${name}</tab>`
      }).join('')}
    `
  }

  async _tabClick(e){
    let tab = e.target
    if(tab.tagName != 'TAB') return 0
    let name = tab.innerText
    let tabs = Array.from(this.querySelectorAll('soci-tab'))
    const targetTab = tabs.find(t => t.getAttribute('name') == name)
    if (targetTab) {
      await targetTab.activate()
    }
    tabs.forEach(t => {
      if (t.getAttribute('name') != name) {
        t.deactivate()
      }
    })
  }

  _tabActivated(e){
    let prevTab = this.select('[active]')
    if(prevTab) prevTab.removeAttribute('active')

    let name = e.target.getAttribute('name')
    this.select(`tab[name=${name}]`).setAttribute('active', '')
  }

  async activateTab(tabName){
    const tabs = Array.from(this.querySelectorAll('soci-tab'))
    const targetTab = tabs.find(tab => tab.getAttribute('name') === tabName)
    
    if (!targetTab) {
      throw new Error(`Tab "${tabName}" not found`)
    }

    // Deactivate all other tabs
    tabs.forEach(tab => {
      if (tab.getAttribute('name') !== tabName) {
        tab.deactivate()
      }
    })

    // Activate the target tab and wait for it to complete
    await targetTab.activate()
  }
}