import NonioComponent from './nonio-component.js'

export default class NonioTab extends NonioComponent {
  constructor() {
    super()
  }

  css(){
    return `
      :host {
        display: none;
        padding-top: 8px;
      }
      :host([activating]),
      :host([active]) {
        display: block;
      }
    `
  }

  connectedCallback(){
    this.removeAttribute('active')
    this.dataset.tabData = this.dataset.tabData || this.innerHTML 
    this.innerHTML = ''

    this.activate = this.activate.bind(this)

    if(this.hasAttribute('default')) this.activate()
  }

  activate(){
    if(this.hasAttribute('active')) return Promise.resolve()
    this.innerHTML = this.dataset.tabData
    this.dataset.tabData = ''
    this.setAttribute('activating', '')
    return new Promise(resolve => {
      setTimeout(()=>{
        this.removeAttribute('activating')
        this.setAttribute('active', '')
        this.fire('tabactivate')
        resolve()
      }, 1)
    })
  }

  deactivate(){
    if(this.hasAttribute('active')){
      this.removeAttribute('active')
      this.dataset.tabData = this.dataset.tabData || this.innerHTML 
      this.innerHTML = ''
      this.fire('tabdeactivate')
    }
  }

  get active() {
    return this.hasAttribute('active')
  }
}