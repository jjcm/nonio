import NonioComponent from './nonio-component.js'

export default class NonioModal extends NonioComponent {
  constructor() {
    super()
  }

  static get observedAttributes() {
    return ['title']
  }

  css() { return `
    :host {
      display: flex;
      position: fixed;
      width: 100vw;
      height: 100vh;
      box-sizing: border-box;
      top: 0;
      left: 0;
      pointer-events: none;
      opacity: 0;
      z-index: 100;
      justify-content: center;
      align-items: center;
      padding: 20px;
      transition: opacity 0.25s var(--nonio-ease);
    }
    :host([active]) { pointer-events: all; opacity: 1; }
    :host([active]) #modal { transform: translateY(0); }
    :host([deactivating]) { transition: opacity 0.15s var(--nonio-ease); }
    :host([deactivating]) #modal { transform: translateY(-16px); transition: transform 0.15s var(--nonio-ease); }
    #blanket {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      background: var(--shadow);
      z-index: 5;
      display: none;
    }
    #modal {
      position: relative;
      z-index: 10;
      padding: 16px;
      min-width: 300px;
      max-width: 600px;
      background: var(--bg);
      border-radius: 4px;
      box-shadow: 0 0 0 1px var(--shadow), 0 4px 8px var(--shadow), 0 0 0 1px rgba(255,255,255,0.1) inset;
      transform: translateY(16px);
      transition: transform 0.25s var(--nonio-ease);
      display: none
    }
    :host([active]) #modal { display: block; }
    :host([deactivating]) #modal { display: block; }
    :host([active]) #blanket { display: block; }
    :host([deactivating]) #blanket { display: block; }
    h2 { margin-top: 0; }
  `}

  html(){ return `
    <div @click=deactivate id="blanket"></div>
    <div id="modal">
      <h2 id="title"></h2>
      <slot></slot>
    </div>
  `}

  attributeChangedCallback(name, oldValue, newValue){
    if(name == 'title') this.select('#title').innerHTML = newValue
  }

  deactivate(){
    this.toggleAttribute('deactivating', true)
    this.removeAttribute('active')
    this.dispatchEvent(new CustomEvent('modaldeactivate', { bubbles: true }))
    setTimeout(()=>{
      this.removeAttribute('deactivating')
    }, 400)
  }
  
  activate(){
    this.toggleAttribute('active', true)
    this.dispatchEvent(new CustomEvent('modalactivate', { bubbles: true }))
  }
}
