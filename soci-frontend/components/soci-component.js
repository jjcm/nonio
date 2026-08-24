import config from '../config.js'

export default class SociComponent extends HTMLElement {
  constructor() {
    super()
    let css, html
    if(this.css) css = this.css()
    if(this.html) html = this.html()
    if(html || css){
      this.attachShadow({'mode':'open'})
      this.shadowRoot.innerHTML = `
        ${css ? `<style>${css}</style>` : ''}
        ${html ? html : '<slot></slot>'}
      `
    }


    this.shadowRoot?.querySelectorAll('*').forEach(el=> {
      Array.from(el.attributes).forEach(attr => {
        const prefix = attr.name.charAt(0)
        if(prefix == '@'){
          this[attr.value] = this[attr.value].bind(this)
          el.addEventListener(attr.name.slice(1), this[attr.value])
          el.removeAttribute(attr.name)
        }
        if(prefix == '?'){
          el.toggleAttribute(attr.name.slice(1), attr.value != 'false')
          el.removeAttribute(attr.name)
        }
      })
    })

    setTimeout(()=>{
      this._initialRenderComplete = true
    }, 1)
  }

  select(s){
    return this.shadowRoot.querySelector(s)
  }

  selectAll(s){
    return this.shadowRoot.querySelectorAll(s)
  }

  async postData(url, data = {}) {
    const response = await fetch(config.API_HOST + url, {
      method: 'POST', 
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + this.authToken
      },
      redirect: 'follow', 
      referrer: 'no-referrer', 
      body: JSON.stringify(data) 
    })
    return await response.json()
  }

  async getData(url, auth){
    let options = {}
    if(auth) options.headers = { 
      Authorization: 'Bearer ' + auth
    }

    // The shell may have started this exact anonymous GET before any module
    // loaded (index.pug __preFetch); consuming it saves a round trip.
    const pre = !auth && window.__preFetch?.[url]
    if(pre){
      delete window.__preFetch[url]
      return pre.catch(() => fetch(config.API_HOST + url, options).then(r => r.json()))
    }

    const response = await fetch(config.API_HOST + url, options)
    return await response.json()
  }

  fire(event, detail, attr){
    if(!attr) attr = 'on' + event
    let tempAttr = this.getAttribute(attr)
    if(tempAttr) eval(tempAttr)
    this.removeAttribute(attr)
    let e = new CustomEvent(event, {detail: detail, bubbles: true})
    this.dispatchEvent(e)
    setTimeout(()=>{
      if(tempAttr) this.setAttribute(attr, tempAttr)
    },1)
  }

  log(message, type){
    let color = ['deebff', '0747ac']
    if(type == 'warning') color = ['fffae5', 'ee6900']
    if(type == 'error') color = ['ffbdad', 'bf2600']
    let name = this.tagName.toLowerCase()
    let groupLabel = `%csoci%c${name}%c${message}`
    let style = ['padding:4px 8px;border-radius: 3px 0 0 3px;background:#0052cc;color:#fff','padding: 4px 8px;background:#4c9aff;color:#172b4d;', `padding: 4px 8px;border-radius:0 3px 3px 0;background:#${color[0]};color:#${color[1]};border-left:1px solid #${color[1]}`]
    console.group(groupLabel, style[0], style[1], style[2])
    console.info(this)
    console.groupEnd(groupLabel)
  }

  localLink(e){
    e.preventDefault()
    window.history.pushState(null, null, e.currentTarget.href)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }

  get authToken(){
    let token = localStorage.getItem('accessToken')
    if(!token) return false
    try {
      let expiry = parseInt(JSON.parse(atob(token.split('.')[1])).expiresAt)
      if(expiry > Date.now() / 1000) return token
      return false
    }
    catch(err) {
      return false
    }
  }

  updateTime(time, dom){
    if(this._updateTimer) clearTimeout(this._updateTimer)

    const secondsPerUnit = [
      ['s', 1],
      ['m', 60],
      ['h', 3600],
      ['d', 86400],
      ['w', 604800],
      ['mo', 2629746],
      ['y', 31556952],
      ['decade', 315569520],
      ['century', 3155695200]
    ]

    const secondsAgo = Math.floor((Date.now() - parseInt(time)) / 1000) + 1

    for(let i = 1; i < secondsPerUnit.length; i++){
      if(secondsAgo < secondsPerUnit[i][1]){
        let unit = secondsPerUnit[i - 1][0]
        let interval = secondsPerUnit[i - 1][1]
        dom.innerHTML = Math.floor(secondsAgo / interval) + unit
        if(secondsAgo > secondsPerUnit[4][1]) return
        this._updateTimer = setTimeout(()=>{this.updateTime(time, dom)}, interval * 1000)
        break
      }
    }
  }

  sortTags(tags){
    const currentTag = this.closest('[tag]')?.getAttribute('tag')
    const nsfwWeight = 3
    const currentTagWeight = 10000
    function weightScore(tag){
      let score = parseInt(tag.score)
      if(tag.tag == currentTag) score *= currentTagWeight
      if(tag.tag.match(/nsfw|nsfl/)) score *= nsfwWeight
      return score
    }
    let sorted = tags.sort((a, b) => weightScore(b) - weightScore(a))
    return sorted
  }
}
