import SociPostLi from './soci-post-li.js'
import config from '../config.js'

export default class SociPostCard extends SociPostLi {
  constructor() {
    super()
  }

  css() {
    return `
      :host {
        background: var(--bg);
        display: flex;
        flex-direction: column;
        padding: 0;
        border-radius: 8px;
        box-shadow: 0px 1px 3px var(--shadow);
        box-sizing: border-box;
        height: auto;
        transition: opacity 0.25s var(--soci-ease), transform 0.25s var(--soci-ease);
      }
      :host([unloaded]) {
        opacity: 0;
        transform: translateY(12px);
      }

      :host(.no-image) #media {
        display: none;
      }

      #title-row {
        padding: 12px 12px 6px;
        order: 1;
      }

      .title {
        font-size: 15px;
        color: var(--text-bold);
        letter-spacing: -0.08px;
        line-height: 20px;
        font-weight: 600;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .title:hover {
        text-decoration: underline;
      }

      #media {
        width: calc(100% - 24px);
        margin: 0 12px 8px;
        overflow: hidden;
        background: var(--bg-secondary);
        border-radius: 4px;
        order: 2;
      }

      #media-link {
        display: block;
        text-decoration: none;
        color: inherit;
      }

      #media img {
        width: 100%;
        max-height: 320px;
        object-fit: cover;
        display: block;
      }

      #body {
        padding: 0 12px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        order: 3;
      }

      #description {
        display: block;
        max-height: 200px;
        overflow: hidden;
        position: relative;
      }

      #description::after {
        content: '';
        position: absolute;
        top: 160px;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(transparent, var(--bg));
        pointer-events: none;
      }

      :host(.no-description) #description {
        display: none;
      }

      #details {
        display: flex;
        gap: 8px;
        font-size: 12px;
        color: var(--text-tertiary);
        flex-wrap: wrap;
        align-items: center;

        > * {
          display: inline-flex;
          align-items: center;
          gap: 2px;
        }
      }

      #metadata-link {
        display: contents;
        > span {
        display: contents;}
        &:before {
          content: '•';
          display: inline-block;
          color: var(--text-tertiary);
        }
        #votes {
          color: var(--text);
        }
        svg { margin-right: -4px; }
        #time svg { margin-right: -5px; }
      }

      ::slotted(soci-user) {
        --font-size: 12px;
      }

      slot[name="tags"] {
        display: block;
      }

      soci-link {
        color: inherit;
        text-decoration: none;
      }

      #domain {
        display: none;
      }

      :host([type="link"]) #domain {
        display: inline;
      }

      #external-link {
        color: inherit;
        text-decoration: none;
        display: none;
      }

      :host([type="link"]) #external-link {
        display: block;
      }

      :host([type="link"]) #internal-link {
        display: none;
      }
    `
  }

  html() {
    const title = this.getAttribute('post-title')
    const link = this.getAttribute('link')
    const score = this.getAttribute('score')
    const comments = this.getAttribute('comments') || 0
    const url = this.getAttribute('url')
    const community = this.getAttribute('community') || ''
    const postPath = community ? `/@${community}/${url}` : `/${url}`

    return `
      <div id="title-row">
        <soci-link id="internal-link" href="${postPath}">
          <div class="title">${title}</div>
        </soci-link>
        <a id="external-link" href="${link || '#'}">
          <div class="title">${title}</div>
        </a>
      </div>
      <div id="media">
        <soci-link id="media-link" href="${postPath}">
          <picture>
            <img @load=_onImageLoad />
          </picture>
        </soci-link>
      </div>
      <div id="body">
        <div id="description">
          <slot name="description"></slot>
        </div>
        <div id="details">
          <slot name="user"></slot>
          <soci-link id="metadata-link" href="${postPath}">
            <span id="votes">${score} vote${score == 1 ? '' : 's'}</span>
            <span id="comments">
              ${SociIcon?.icon('comments', 16)}
              <span>${comments}</span>
            </span>
            <span id="time">
              ${SociIcon?.icon('time', 16)}
              <span></span>
            </span>
          </soci-link>
          <span id="domain">${link?.replace(/^(?:https?:\/\/)?(?:www\.)?([^\/]+).*$/, '$1') || ''}</span>
        </div>
        <slot name="tags"></slot>
      </div>
    `
  }

  connectedCallback() {
    // Skip soci-post-li's connectedCallback expand logic, just do the basics
    this.loadContent(this.getAttribute('type'))
    
    const time = this.getAttribute('time')
    if (time == 'now') {
      this.select('#time span').innerHTML = "just now"
    } else {
      this.updateTime = this.updateTime.bind(this)
      this.updateTime(time, this.select('#time span'))
    }
    
    const desc = this.querySelector('soci-markdown-view[slot="description"]')
    this.classList.toggle('no-description', !desc || !desc.getAttribute('markdown'))

    // Notify parent for relayout once markdown renders (it renders async after markdown-wasm is ready)
    if (desc && !desc._gridLanesObserved) {
      desc._gridLanesObserved = true
      const mo = new MutationObserver(() => {
        mo.disconnect()
        this.dispatchEvent(new CustomEvent('card-loaded', { bubbles: true }))
      })
      mo.observe(desc, { childList: true, subtree: true })
    }
  }

  _onImageLoad() {
    this.dispatchEvent(new CustomEvent('card-loaded', { bubbles: true }))
  }

  _setImageSource(container, host) {
    const img = container.querySelector('img')
    if (!img) return
    
    img.src = `${host}/${this.url}.webp`
    img.onerror = () => this.classList.add('no-image')
  }

  loadContent(type) {
    // Types that have images/thumbnails
    if (type === 'image' || type === 'link') {
      this._setImageSource(this.select('#media'), config.IMAGE_HOST)
    } else {
      // No image for this type - hide media immediately
      this.classList.add('no-image')
    }
  }

  // Override attributeChangedCallback for card-specific elements
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._initialRenderComplete) return

    switch (name) {
      case 'post-title':
        this.select('#internal-link .title')?.replaceChildren(document.createTextNode(newValue))
        this.select('#external-link .title')?.replaceChildren(document.createTextNode(newValue))
        break
      case 'type':
        this.loadContent(newValue)
        break
      case 'link':
        this.select('#external-link')?.setAttribute('href', newValue)
        const domain = this.select('#domain')
        if (domain) domain.innerHTML = newValue?.replace(/^(?:https?:\/\/)?(?:www\.)?([^\/]+).*$/, '$1') || ''
        break
      case 'time':
        if (newValue == "now") {
          this.select('#time span').innerHTML = "just now"
          return
        }
        this.updateTime = this.updateTime.bind(this)
        this.updateTime(newValue, this.select('#time span'))
        break
      case 'score':
        const votes = this.select('#votes')
        if (votes) votes.innerHTML = newValue + ' vote' + (newValue == 1 ? '' : 's')
        break
      case 'comments':
        this.select('#comments span')?.replaceChildren(document.createTextNode(newValue))
        break
      case 'url':
      case 'community':
        this._updateLinks()
        break
    }
  }

  _updateLinks() {
    const path = this._postPath()
    this.select('#internal-link')?.setAttribute('href', path)
    this.select('#metadata-link')?.setAttribute('href', path)
    this.select('#media-link')?.setAttribute('href', path)
  }
}

