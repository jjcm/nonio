import SociComponent from './soci-component.js'
import config from '../config.js'

export default class SociUserComment extends SociComponent {
  constructor() {
    super()
  }

  css(){
    return `
      :host {
        display: block;
        padding: 12px;
        margin: 8px 0;
        border-radius: 8px;
        background: var(--bg);
        box-shadow: 0px 1px 3px var(--shadow);
      }

      #post {
        display: flex;
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--bg-secondary-hover);
      }

      img {
        width: 48px;
        min-width: 48px;
        height: 36px;
        border-radius: 3px;
        object-fit: cover;
        margin-right: 12px;
      }

      .container {
        display: flex;
        align-items: center;
        width: 100%;
      }

      #title {
        font-size: 16px;
        color: var(--text-bold);
        letter-spacing: -0.08px;
        line-height: 20px;
        width: 100%;
        max-height: 72px;
        font-weight: 600;
        margin-bottom: 8px;
        margin-top: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      ::slotted(soci-comment) {
        padding-left: 4px;
        border-radius: 4px;
        transition: padding 0.2s ease;
      }
      ::slotted(soci-comment) {
        padding-left: 4px;
        border-radius: 4px;
        transition: padding 0.1s var(--soci-ease);
      }

      :host([unread]) ::slotted(soci-comment) {
        padding: 8px 12px;
        background: var(--bg-brand-secondary);
        --upvote-bg: var(--bg-elevation-tint);
        --upvote-bg-hover: var(--bg-elevation-tint-hover);
      }
    `
  }

  html(){ return `
    <soci-link id="post">
      <div class="container">
        <div id="title"></div>
      </div>
    </soci-link>
    <slot></slot>
  `}

  static get observedAttributes() {
    return ['url', 'post-title', 'score', 'user', 'replies', 'date', 'content']
  }

  attributeChangedCallback(name, oldValue, newValue){
    switch(name) {
      case 'url':
        this.select('#post').setAttribute('href', '/' + newValue)
        let img = document.createElement('img')
        img.setAttribute('src', `${config.THUMBNAIL_HOST}/${newValue}.webp`)
        img.onload = () => {
          img.className = 'thumbnail'
          this.select('.container').prepend(img)
        }
        break
      case 'post-title':
        this.select('#title').innerHTML = newValue
        break
      default:
        this.querySelector('soci-comment').setAttribute(name, newValue)
        break
    }
  }

  connectedCallback(){
    this.addEventListener('click', e => {
      if(this.hasAttribute('unread')){
        this.toggleAttribute('unread', false)
        this.postData('/notification/mark-read', {id: parseInt(this.getAttribute('notification-id'))}).then(response => {
          if(response) {
            this.fire('activitychange')
          }
        })
      }
    })
  }

  factory(user, score, lineageScore, date, id, content, edited, postUrl, postTitle, unread){
    let userComment = document.createElement('soci-user-comment')
    userComment.setAttribute('url', postUrl)
    userComment.setAttribute('post-title', postTitle)
    userComment.toggleAttribute('unread', unread)

    let comment = document.createElement('soci-comment')
    comment = comment.factory(user, score, lineageScore, date, id, content, edited)
    userComment.appendChild(comment)
    return userComment
  }
}