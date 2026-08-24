import SociComponent from './soci-component.js'

export default class SociInput extends HTMLElement {
  static get formAssociated() {
    return true
  }

  constructor() {
    super()
    this._internals = this.attachInternals()
  }

  css(){

    let css = `
      :host {
        --min-height: 0;
        --padding: 12px 16px;
        min-height: var(--min-height);
        position: relative;
        display: flex;
        transition: padding 0.1s ease-out, border-color 0.5s ease;
        padding-bottom: 0px;
        box-sizing: border-box;
      }
    `
    return css
  }

  html(){
    return `
      <div id="editorjs"></div>
    `
  }

  connectedCallback(){
    this.innerHTML = this.css() + this.html()
    this.editor = new EditorJS('editorjs')
  }

  checkValidity() {
    return this._internals.checkValidity()
  }

  setUpEditor(){
    this.editor = new EditorJS('editor')
  }
}