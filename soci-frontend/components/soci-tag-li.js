import SociComponent from './soci-component.js'

export default class SociTagLi extends SociComponent {
  constructor() {
    super()
  }

  css(){
    return `
      :host {
        line-height: 32px;
        position: relative;
        display: block;
        overflow: hidden;
        border-radius: 4px;
      }

      :host([active]) a {
        color: var(--text-brand-bold);
        font-weight: 600;
        background: var(--bg-brand-secondary);
      }

      :host([active]) a:hover {
        background: var(--bg-brand-secondary-hover);
      }

      :host(:hover) {
        box-shadow: 0 0 0 1px inset var(--bg-secondary);
      }

      :host([active]:hover) {
        box-shadow: none;
      }
      
      a {
        display: block;
        padding-left: 42px;
        text-decoration: none;
        color: var(--text);
        position: relative;
        cursor: pointer;
        box-sizing: border-box;
      }

      a:hover {
        background: var(--bg-hover);
      }

      ::slotted(svg),
      ::slotted(soci-icon),
      #hash {
        position: absolute;
        left: 12px;
        top: 8px;
        width: 16px;
        height: 16px;
      }

      #hash {
        border-radius: 3px;
        background: var(--bg-inverse);
        color: var(--text-inverse);
      }

      :host([subscribed]) #hash {
        background: var(--bg-brand);
      }

      #toggleSubscribe {
        width: 24px;
        height: 24px;
        position: absolute;
        right: 8px;
        top: 4px;
        border-radius: 3px;
        cursor: pointer;
        display: none;
      }

      :host(:hover) #toggleSubscribe {
        display: block;
      }

      :host([hide-subscribe]) #toggleSubscribe {
        display: none !important;
      }

      #toggleSubscribe:hover {
        background: var(--bg-hover);
      }

      :host([active]) #toggleSubscribe:hover {
        background: #1357a018;
      }

      :host([subscribed]) #toggleSubscribe svg {
        transform: rotate(45deg);
      }

      :host([load-in]){
        animation: load-in 0.2s var(--soci-ease) forwards;
      }

      :host([load-in][subscribed]) a {
        animation: load-in-up 0.2s var(--soci-ease) forwards;
      }
      :host([load-in]:not([subscribed])) a {
        animation: load-in-down 0.2s var(--soci-ease) forwards;
      }

      :host([load-out]){
        animation: load-out 0.2s var(--soci-ease) forwards;
      }

      :host([load-out][subscribed]) a {
        animation: load-out-down 0.2s var(--soci-ease) forwards;
      }
      :host([load-out]:not([subscribed])) a {
        animation: load-out-up 0.2s var(--soci-ease) forwards;
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

      @keyframes load-out {
        from {
          height: 32px;
          opacity: 1;
        }

        to {
          height: 0;
          opacity: 0;
        }
      }

      @keyframes load-in-up {
        from { transform: translateY(10px) }
        to { transform: translateY(0px) }
      }

      @keyframes load-out-up {
        from { transform: translateY(0px) }
        to { transform: translateY(-42px) }
      }

      @keyframes load-in-down {
        from { transform: translateY(-42px) }
        to { transform: translateY(0px) }
      }

      @keyframes load-out-down {
        from { transform: translateY(0px) }
        to { transform: translateY(10px) }
      }
    `
  }

  html(){ return `
    <a @click=_tagClick>
      <slot name="icon">
        <svg id="hash" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <g clip-path="url(#clip0)">
          <path d="M7 1.62366L5.5 13.3395" stroke="currentColor" stroke-width="1.25"/>
          <path d="M10.5 1.62366L9 13.3395" stroke="currentColor" stroke-width="1.25"/>
          <path d="M3 10H12.5" stroke="currentColor" stroke-width="1.25"/>
          <path d="M3.5 6H13" stroke="currentColor" stroke-width="1.25"/>
          </g>
          <defs>
          <clipPath id="clip0">
          <rect width="10" height="10" fill="white" transform="translate(3 3)"/>
          </clipPath>
          </defs>
        </svg>
      </slot>
      <slot></slot>
    </a>
    <div id="toggleSubscribe" @click=_toggleSubscribe>
      <svg viewBox="0 0 24 24" fill="currentColor"><rect x="8" y="11.5" width="8" height="1" rx="0.5" fill="currentColor"></rect><rect x="11.5" y="8" width="1" height="8" rx="0.5" fill="currentColor"></rect></svg>
    </div>
  `}

  static get observedAttributes() {
    return ['tag', 'href']
  }

  attributeChangedCallback(name, oldValue, newValue){
    if(name == 'tag') {
      this.innerHTML = newValue
      // Only set default href if not explicitly set
      if(!this.hasAttribute('href')) {
        this.select('a').href = `/#${newValue}`
      }
    }
    else if(name == 'href') {
      this.select('a').href = newValue
    }
  }

  get tag(){
    return this.getAttribute('tag')
  }

  set tag(val){
    return this.setAttribute('tag', val)
  }

  _toggleSubscribe(e){
    e.preventDefault()
    let subscribing = !this.hasAttribute('subscribed')
    this.fire(subscribing ? 'subscribe' : 'unsubscribe', {
      dom: this,
      tag: this.innerHTML
    })

    this.postData(`/subscription/${subscribing ? 'create' : 'delete'}`, {
      tag: this.innerHTML,
      community: window.soci.routeContext.community
    })
  }

  _tagClick(e){
    e.preventDefault()
    let href = this.select('a').href
    window.history.pushState(null, null, href)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }
}
