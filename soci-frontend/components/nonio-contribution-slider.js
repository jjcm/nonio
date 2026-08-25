import NonioComponent from './nonio-component.js'
const DEFAULT_SUBSCRIPTION_VALUE = 5

export default class NonioContributionSlider extends NonioComponent {
  static get formAssociated() {
    return true
  }

  constructor() {
    super()
    this._internals = this.attachInternals()
  }

  css(){
    return `
      :host { margin: 18px 0 36px; display: block; }
      slider { position: relative; display: block; margin: 8px 0 16px; }
      slider-track {
        height: 4px;
        width: 100%;
        background: var(--bg-brand-secondary);
        display: block;
        position: relative;
        &::before {
          content: '';
          width: 30px;
          height: 4px;
          background: var(--bg-secondary);
          border-right: 2px solid var(--bg);
          display: block;
        }
      }
      slider-handle {
        width: 16px;
        height: 16px;
        background: var(--bg-brand);
        display: block;
        position: absolute;
        top: -6px;
        left: calc(50% - 8px);
        border-radius: 8px;
        cursor: pointer;
        transition: box-shadow 0.1s var(--nonio-ease-out);
        &:focus { outline: 0; }
        &:focus:not(:active) { box-shadow: 0 0 0 2px var(--bg-brand-bold) inset; }
      }
      info { display: flex; }
      amount { display: block; font-size: 22px; font-weight: bold; }
      label { font-size: 11px; color: var(--text-secondary); }
      server {
        max-width: 42px;
        amount { color: var(--text-secondary); }
      }
      contribution {
        max-width: 80px;
        margin-right: auto;
        margin-left: 8px;
        amount { color: var(--text-brand); }
      }
      total {
        min-width: 110px;
        text-align: right;
        span { font-weight: 100; color: var(--text-secondary); }
      }
    `
  }

  html(){
    return `
      <slider>
        <slider-track></slider-track>
        <slider-handle @mousedown=_mouseDown tabindex="0"></slider-handle>
      </slider>
      <info>
        <server>
          <amount>$1</amount>
          <label>server fee</label>
        </server>
        <contribution>
          <amount>$4</amount>
          <label>artist contribution</label>
        </contribution>
        <total>
          <amount>$5<span>/month</span></amount>
        </total>
      </info>
    `
  }

  connectedCallback(){
    this.state = {}
    this.state.xDown = this.state.mouseClientX = 0
    this._contributionHandle = this.select('slider-handle')
    this._contributionAmount = this.select('contribution amount')
    this._totalAmount = this.select('total amount')
  }

  checkValidity() {
    return this._internals.checkValidity()
  }

  get value(){
    return this._value
  }

  set value(val){
    if(val < 2) val = 2
    if(val > 10) val = 10
    this._value = val
  }

  _computeDraggedValue(){
    let rect = this.getBoundingClientRect()
    let val = (this._dragOffset - 58) / ((rect.width - 58) / 9)
    return Math.floor(val + 2) || DEFAULT_SUBSCRIPTION_VALUE
  }

  _relativeXPos(e){
    let x = e.clientX
    let rect = this.getBoundingClientRect()
    let xMin = rect.left
    return Math.min(Math.max(x - xMin, 0), rect.width)
  }

  get _dragOffset(){
    let leftOffset = this.state.x - (this.state.xDown - this.state.mouseClientX)
    let rect = this.getBoundingClientRect()
    leftOffset = Math.min(rect.width, Math.max(58, leftOffset))
    return leftOffset
  }

  _mouseDown(e){
    document.body.toggleAttribute('dragging', true)
    this.state.xDown = this._relativeXPos(e)
    this.state.x = this._contributionHandle.offsetLeft
    this._mouseMove = this._mouseMove.bind(this)
    this._mouseUp = this._mouseUp.bind(this)
    document.addEventListener('mousemove', this._mouseMove)
    document.addEventListener('mouseup', this._mouseUp)
  }

  _mouseMove(e){
    document.body.setAttribute('dragging', '')
    this.state.mouseClientX = this._relativeXPos(e)
    this._contributionHandle.style.left = this._dragOffset + 'px'
    this.value = this._computeDraggedValue()
    this._contributionAmount.innerHTML = '$' + (this.value - 1)
    this._totalAmount.innerHTML = `$${this.value}<span>/month</span>`
    let message = ''
    switch(this.value) {
      case 2: 
        message = 'I\'m a starving artist'
        break;
      case 3: 
      case 4: 
        message = 'I\'m a regular joe'
        break;
      case 5: 
      case 6: 
        message = 'I support the arts!'
        break;
      case 7: 
      case 8: 
        message = 'I\'m a philanthropist!!!'
        break;
      case 9: 
        message = 'Epstein didn\'t kill himself'
        break;
      case 10: 
        message = '<3 <3 <3'
        break;
    }
    this.previousElementSibling.innerHTML = message
  }

  _mouseUp(){
    document.body.removeAttribute('dragging')
    document.removeEventListener('mousemove', this._mouseMove)
    document.removeEventListener('mouseup', this._mouseUp)
    this.state.x = this._dragOffset
    this.previousElementSibling.innerHTML = 'Contribution'
    this._contributionHandle.blur()
  }
}
