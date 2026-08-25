import NonioComponent from './nonio-component.js'

export default class NonioBanner extends NonioComponent {
  constructor() {
    super()
  }

  css(){
    return `
      :host {
        --banner-bg: var(--bg-secondary);
        --banner-stroke: var(--border);
        --banner-text: var(--text);
        padding: 8px 16px;
        display: flex;
        background: var(--banner-bg);
        color: var(--banner-text);
        border-radius: 4px;
        border: 1px solid var(--banner-stroke);
        margin-bottom: 12px;
        width: 100%;
        position: relative;
        box-sizing: border-box;
      }

      :host([type="info"]) {
        --banner-bg: var(--bg-brand-secondary);
        --banner-stroke: var(--bg-brand-secondary);
      }

      :host([type="success"]) {
        --banner-bg: var(--bg-success);
        --banner-stroke: var(--bg-success);
        --banner-text: var(--text-inverse);
      }

      :host([type="warning"]) {
        --banner-bg: var(--bg-warning);
        --banner-stroke: var(--bg-warning);
        --banner-text: var(--text-inverse);
      }

      #title {
        font-weight: 600;
      }

      nonio-icon {
        display: none;
        margin-top: 4px;
        margin-right: 16px;
      }

      :host([type]) nonio-icon {
        display: block;
      }
    `
  }

  html(){ return `
    <nonio-icon></nonio-icon>
    <div id="content">
      <div id="title"></div>
      <slot></slot>
    </div>
  `}

  static get observedAttributes() {
    return ['title', 'type']
  }

  attributeChangedCallback(name, oldValue, newValue){
    switch(name){
      case 'title':
        this.select('#title').innerHTML = newValue
        break
      case 'type':
        this.select('nonio-icon').setAttribute('glyph', newValue)
        break
    }
  }

}
