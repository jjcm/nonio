import SociComponent from './soci-component.js'

export default class SociNotificationBadge extends SociComponent {
  constructor() {
    super()
  }

  css(){
    return `
      :host {
        display: inline-flex;
        border: 0;
        border-radius: 3px;
        height: 20px;
        min-height: 20px;
        line-height: 20px;
        padding: 0 4px;
        font-size: 12px;
        margin-right: 4px;
        cursor: pointer;
        position: relative;
        float: right;
        user-select: none;
        text-align: center;
        box-sizing: border-box;
        background: var(--bg-secondary-hover);
        color: var(--text-secondary);
        gap: 0px;
        --transition-time: 0.1s;
        transition: all var(--transition-time) ease;
      }
      svg { transform: translateY(2px); }
      :host(:hover) { color: var(--text-secondary-hover); }
      :host([loaded]) { --transition-time: 0.2s; }
      :host([count]) { color: var(--text-danger); gap: 4px; padding: 0 8px; }
      :host([count]) span { transform: translateY(0); opacity: 1; }
      :host([count]:hover) { color: var(--text-danger-hover); }
      :host([count]:hover) span { color: var(--text-danger-hover); }
      span {
        transform: translateY(8px);
        opacity: 0;
        transition: opacity var(--transition-time) ease, transform var(--transition-time) ease;
        color: var(--text-danger);
      }
      soci-link { display: contents; }
    `
  }

  html(){ return `
    <soci-link href="/notifications" fresh>
      ${SociIcon?.icon('mail', 16)}
      <span></span>
    </soci-link>
  `}

  static get observedAttributes() {
    return ['count']
  }

  attributeChangedCallback(name, oldValue, newValue){
    switch(name){
      case 'count':
        this.select('span').innerHTML = newValue
        break
    }
  }

  async connectedCallback(){
    // Start checking every 10s
    this.exponentialBackoff = 10000

    if(this.authToken) {
      await this.checkNotifications()
      setTimeout(() => {
        this.toggleAttribute('loaded', true)
      }, 100)
    }

    // Triggers when you switch tabs back to nonio 
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState == 'visible'){
        this.checkNotifications()
        this.exponentialBackoff = 10000
      }
    })

    // Creating posts and comments triggers this
    document.addEventListener('activitychange', () => {
      this.checkNotifications()
      this.exponentialBackoff = 10000
    })

    document.addEventListener('login', () => {
      this.checkNotifications()
      this.exponentialBackoff = 10000
    })
  }

  async checkNotifications(){
    if(this.nextCheck) clearTimeout(this.nextCheck)
    let count = await this.getData('/notifications/unread-count', this.authToken)
    if(count == "Authorization required") return null
    soci.notificationCount = count
    if(count == 0) this.removeAttribute('count')
    else this.setAttribute('count', count)
    this.nextCheck = setTimeout(this.checkNotifications.bind(this), this.exponentialBackoff)
    this.exponentialBackoff = Math.min(this.exponentialBackoff * 1.3, 1800000 /* 30 minutes */)
  }
}
