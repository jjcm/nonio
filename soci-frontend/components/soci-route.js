import SociComponent from './soci-component.js'

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
    if(fresh) this.innerHTML = this.domCopy
    else this._attachChildren()

    // TODO
    // Hypothesis: we could dynamically load tags and match them to files, potentially speeding up first page load time. 
    // Definitely would need to be benchmarked to see if this works. 
    /*
    this.innerHTML.match(/<soci-(\w+)[^>]*>/g).forEach(tag => {
      let name = tag.match(/<soci-(\w+)[^>]*>/)[1]
      console.log(name)
      import(`./soci-${name}.js`).then(module => {
        window.customElements.define(`soci-${name}`, module.default)
      })

    })
    */

    // Very briefly add the activating class, followed immediately by the active
    // class. This allows us to bind animation transitions easily for page loads.
    this.setAttribute('activating', '')
    setTimeout(()=>{
      this.removeAttribute('activating')
      this.setAttribute('active', '')
      let e = new CustomEvent('routeactivate', {bubbles: false})
      this.dispatchEvent(e)
    },1)
  }

  deactivate(){
    if(this.hasAttribute('active')){
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