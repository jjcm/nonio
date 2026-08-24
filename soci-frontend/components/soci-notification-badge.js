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

  connectedCallback(){
    // Polling cadence, only used while the websocket is down
    this.exponentialBackoff = 10000
    this._wsBackoff = 1000

    if(this.authToken) this._connect()

    // Triggers when you switch tabs back to nonio. The socket may have been
    // killed while backgrounded; while it's open the server pushes counts.
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState != 'visible' || this._wsOpen()) return
      this.exponentialBackoff = 10000
      this._connect()
    })

    // Creating posts and comments triggers this
    document.addEventListener('activitychange', () => {
      if(this._wsOpen()) return
      this.exponentialBackoff = 10000
      this.checkNotifications()
    })

    document.addEventListener('login', () => {
      this.exponentialBackoff = 10000
      this._wsBackoff = 1000
      // Reconnect with the new token
      if(this._ws){
        this._ws.onclose = null
        this._ws.close()
        this._ws = null
      }
      this._connect()
    })
  }

  _wsOpen(){
    return this._ws?.readyState === WebSocket.OPEN
  }

  // Live count over websocket. The server sends {type: 'notification.count'}
  // on connect and whenever this user's unread count changes, so polling
  // pauses entirely while the socket is open. Any failure falls back to the
  // original polling loop and retries the socket with backoff.
  _connect(){
    if(!this.authToken) return
    if(this._ws && this._ws.readyState <= WebSocket.OPEN) return
    clearTimeout(this._wsRetry)

    let ws
    try { ws = new WebSocket(window.api.notifications.wsUrl(this.authToken)) }
    catch { return this._fallback() }
    this._ws = ws

    ws.onopen = () => {
      this._wsBackoff = 1000
      clearTimeout(this.nextCheck)
    }
    ws.onmessage = e => {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }
      if(msg.type == 'notification.count') this._setCount(msg.count)
    }
    ws.onclose = () => {
      if(this._ws != ws) return
      this._ws = null
      this._fallback()
    }
  }

  _fallback(){
    if(!this.authToken) return
    this.checkNotifications()
    clearTimeout(this._wsRetry)
    this._wsRetry = setTimeout(() => this._connect(), this._wsBackoff)
    this._wsBackoff = Math.min(this._wsBackoff * 2, 60000)
  }

  _setCount(count){
    soci.notificationCount = count
    if(count == 0) this.removeAttribute('count')
    else this.setAttribute('count', count)
    if(!this.hasAttribute('loaded')) setTimeout(() => this.toggleAttribute('loaded', true), 100)
  }

  async checkNotifications(){
    if(this.nextCheck) clearTimeout(this.nextCheck)
    let count = await this.getData('/notifications/unread-count', this.authToken)
    if(count == "Authorization required") return null
    this._setCount(count)
    // The socket reclaims ownership of updates the moment it reopens
    if(this._wsOpen()) return
    this.nextCheck = setTimeout(this.checkNotifications.bind(this), this.exponentialBackoff)
    this.exponentialBackoff = Math.min(this.exponentialBackoff * 1.3, 1800000 /* 30 minutes */)
  }
}
