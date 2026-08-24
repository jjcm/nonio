import SociComponent from './soci-component.js'
import { routeReady } from './soci-loader.js'

export default class SociRouter extends SociComponent {
  constructor() {
    super()
  }

  css(){
    return `
      :host {
        display: none;
      }
      :host([activating]),
      :host([active]) {
        display: contents;
      }
    `
  }

  connectedCallback(){
    this.currentDom = []
    /* Routes have two copies of their DOM. One is a simple string representation
    *  of the DOM, the other is the detached children in their current state. The 
    *  first is great if we need a fresh copy of the route, but the second is good
    *  If we want to preserve the state of things like input fields and js listeners
    */
    this.domCopy = this.innerHTML
    this._detachChildren()

    let path = this.getAttribute('path') || ''
    this.path = new RegExp(path)

    let parentRoute = this.parentElement.closest('soci-route')
    if(parentRoute) {
      parentRoute.addEventListener('routeactivate', ()=>{
        if(this.test()) {
          this.activate()
        }
      })
    }
  }

  get active() {
    return this.hasAttribute('active')
  }

  activate(fresh){
    fresh = fresh || this.hasAttribute('fresh')
    if(this.hasAttribute('active')) {
      if(!fresh) return 0
      else this.removeAttribute('active')
    }
    // If fresh is true, we load a fresh copy of the route. Otherwise we load
    // the previous state.
    if(fresh) {
      // Fresh routes never drain currentDom, so the children detached on
      // every deactivate accumulated there forever - each feed visit
      // retained a full detached post list.
      this.currentDom = []
      this.innerHTML = this.domCopy
    }
    else this._attachChildren()

    // Very briefly add the activating class, followed immediately by the active
    // class. This allows us to bind animation transitions easily for page loads.
    //
    // `active` and routeactivate wait for the route's lazy element pack, so
    // page scripts listening to routeactivate can call component methods
    // without racing customElements.define. The token guards against a
    // navigation away (or a re-activation) while the pack is in flight.
    this.setAttribute('activating', '')
    const token = this._activationToken = Symbol()
    routeReady(this.id).then(()=>{
      if(this._activationToken !== token) return
      setTimeout(()=>{
        if(this._activationToken !== token) return
        this.removeAttribute('activating')
        this.setAttribute('active', '')
        let e = new CustomEvent('routeactivate', {bubbles: false})
        this.dispatchEvent(e)
      },1)
    })
  }

  deactivate(){
    this._activationToken = null
    const wasActivating = this.hasAttribute('activating')
    this.removeAttribute('activating')
    if(this.hasAttribute('active') || wasActivating){
      this.removeAttribute('active')
      this._detachChildren()

      let e = new CustomEvent('routedeactivate', {bubbles: false})
      this.dispatchEvent(e)
    }
  }

  test(){
    let routePath = this.getAttribute('path')
    if(!routePath) return 0
    let path
    switch(this.getAttribute('test')) {
      case 'hash':
        path = window.location.hash
        break
      case 'both':
        path = window.location.pathname + window.location.hash
        break
      default:
        path = window.location.pathname
        break
    }

    if(routePath.charAt(0) == '/') return this.getAttribute('path') == path
    return this.path.test(path)
  }

  _detachChildren(){
    while(this.children.length){
      this.currentDom.push(this.removeChild(this.children[0]))
    }
  }

  _attachChildren(){
    while(this.currentDom.length){
      this.appendChild(this.currentDom.shift())
    }
  }
}