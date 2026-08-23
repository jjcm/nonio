import SociComponent from './soci-component.js'

export default class SociButton extends SociComponent {
  constructor() {
    super()
  }

  css(){
    return `
      :host {
        display: inline-block;
        border: 0;
        border-radius: 3px;
        background: var(--bg-brand);
        height: 20px;
        min-height: 20px;
        line-height: 20px;
        color: var(--text-inverse);
        padding: 0 8px;
        font-size: 12px;
        margin-right: 4px;
        cursor: pointer;
        position: relative;
        float: right;
        user-select: none;
        text-align: center;
        box-sizing: border-box;
      }

      :host:after,
      :host:before {
        content: '';
        display: block;
        position: absolute;
        background: var(--text-inverse);
        width: 0;
        height: 0;
        left: 50%;
        top: 50%;
        transform: none;
      }

      :host(:hover) {
        background: var(--bg-brand-hover);
      }

      :host(:active) {
        background: var(--bg-brand-active);
      }

      :host([subtle]) {
        background: var(--bg-secondary);
        color: var(--text-secondary);
      }

      :host([subtle]:hover) {
        background: var(--bg-secondary-hover);
        color: var(--text-secondary-hover);
      }

      :host([subtle]:active) {
        background: var(--bg-secondary-active);
        color: var(--text-secondary-active);
      }
      
      :host([subtle]):before,
      :host([subtle]):after {
        background: var(--text-secondary);
      }

      :host([subtle]:hover):before, 
      :host([subtle]:hover):after {
        background: var(--text-secondary-hover);
      }

      :host([subtle]:active):before, 
      :host([subtle]:active):after {
        background: var(--text-secondary-active);
      }

      :host([danger]) {
        background: var(--bg-danger);
        color: var(--text-inverse);
      }

      :host([danger]:hover) {
        background: var(--bg-danger-hover);
        color: var(--text-inverse-hover);
      }

      :host([danger]:active) {
        background: var(--bg-danger-active);
        color: var(--text-inverse-active);
      }
      
      :host([danger]):before,
      :host([danger]):after {
        background: var(--text-inverse);
      }

      :host([danger]:hover):before, 
      :host([danger]:hover):after {
        background: var(--text-inverse-hover);
      }

      :host([danger]:active):before, 
      :host([danger]:active):after {
        background: var(--text-inverse-active);
      }

      :host(:focus) {
        outline: none;
      }

      :host(:focus-visible) {
        outline: var(--bg-brand-bold) auto 2px;
      }

      :host([state="error"]) {
        background: var(--bg-danger);
        color: transparent !important;
        animation: error 0.3s var(--soci-ease);
      }

      :host([state="error"]):after,
      :host([state="error"]):before {
        width: 10px;
        height: 2px;
        transform: rotate(45deg);
        transition: all 0.1s var(--soci-ease), transform 0.1s var(--soci-ease-in);
        left: calc(50% - 4px);
        top: calc(50% - 1px);
        animation: inner-error-after 0.3s linear;
        background: var(--text-inverse);
      }

      :host([state="error"]):before {
        transform: rotate(-45deg);
        animation: inner-error-before 0.3s linear;
      }

      @keyframes load-in {
        from {
          height: 0;
          opacity: 0;
        }

        to {
          height: 32px;
          opacity: 1;
        }
      }

      @keyframes error {
        0% { transform: translateX(0px); }
        20% { transform: translateX(-2px); }
        40% { transform: translateX(4px); }
        60% { transform: translateX(-4px); }
        80% { transform: translateX(2px); }
        100% { transform: translateX(0px); }
      }

      @keyframes inner-error-before {
        0% { transform: translateX(0px) rotate(-45deg);}
        20% { transform: translateX(2px) rotate(-45deg); }
        40% { transform: translateX(-4px) rotate(-45deg); }
        60% { transform: translateX(4px) rotate(-45deg); }
        80% { transform: translateX(-2px) rotate(-45deg); }
        100% { transform: translateX(0px) rotate(-45deg); }
      }

      @keyframes inner-error-after {
        0% { transform: translateX(0px) rotate(45deg);}
        20% { transform: translateX(2px) rotate(45deg); }
        40% { transform: translateX(-4px) rotate(45deg); }
        60% { transform: translateX(4px) rotate(45deg); }
        80% { transform: translateX(-2px) rotate(45deg); }
        100% { transform: translateX(0px) rotate(45deg); }
      }

      :host([state="waiting"]) {
        color: transparent;
        cursor: wait;
      }
      :host([state="waiting"]:hover) {
        color: transparent;
      }

      :host([state="waiting"]):before,
      :host([state="waiting"]):after {
        width: 8px;
        height: 8px;
        border-radius: 4px;
        left: calc(50% - 10px);
        top: calc(50% - 4px);
        animation: waiting 0.3s infinite alternate;
      }
      :host([state="waiting"]):after {
        left: calc(50% + 2px);
        animation: waiting 0.3s infinite alternate-reverse var(--soci-ease);
      }

      @keyframes waiting {
        from {
          transform: scale(1);
        }
        to {
          transform: scale(0.7);
        }
      }

      :host([state="success"]) {
        background: var(--bg-success) !important;
        color: transparent !important;
        animation: success 0.2s var(--soci-ease);
      }

      :host([state="success"]):before,
      :host([state="success"]):after {
        width: 2px;
        transition: all 0.1s var(--soci-ease);
        background: var(--text-inverse);
        height: 5px;
        top: calc(50% - 2px);
        left: calc(50% - 2px);
        transform: rotate(-45deg);
      }
      :host([state="success"]):after {
        height: 9px;
        top: calc(50% - 5px);
        left: calc(50% + 2px);
        transform: rotate(45deg);
      }

      @keyframes success {
        0% {
          transform: scaleY(1) scaleX(1);
        }
        40% {
          transform: scaleY(1.13) scaleX(1.07);
        }
        100% {
          transform: scaleY(1) scaleX(1);
        }
      }
    `
  }

  html(){ return `
    <slot></slot>
  `}

  connectedCallback(){
    this.setAttribute('tabindex', 0)
    this.setAttribute('role', 'button')
    this.addEventListener('click', ()=>{
      if(this.hasAttribute('async'))
        this.wait()
    })
    this.lastWait = 0
  }

  wait(){
    this.setAttribute('state', 'waiting')
    this.lastWait = new Date().getTime()
  }

  success(){
    this._changeState('success')
  }

  error(){
    this._changeState('error')
  }

  _changeState(state){
    setTimeout(()=>{
      this.blur()
      let stateTime = new Date().getTime()
      setTimeout(()=>{
        this.setAttribute('state', state)
        setTimeout(()=>{
          this.removeAttribute('state')
        }, 1200)
      }, Math.max(850 - (stateTime - this.lastWait), 0) )
    }, 1)
  }
}
