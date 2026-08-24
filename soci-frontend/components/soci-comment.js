import SociComponent from './soci-component.js'

export default class SociComment extends SociComponent {
  constructor() {
    super()
  }

  css(){
    return `
      :host {
        --border-color: transparent
        --upvote-bg: var(--bg-secondary);
        --upvote-bg-hover: var(--bg-secondary-hover);
        margin-top: 4px;
        display: block;
        position: relative;
        padding-left: 3%; 
        margin: 12px 0 8px;
        min-height: 0px;
        transition: height 0.1s var(--soci-ease);
        &:last-child { margin-bottom: 0; }
      }
      :host(:not([edited])) .edited { display: none; }
      :host([expanded]) #replies { height: auto; }
      :host(:not([self])) .user-control { display: none; }
      :host([inserting]) {
        position: absolute;
        margin: 0;
        opacity: 0;
        transform: translateY(-8px);
      }
      comment { display: block; position: relative; }
      top { display: flex; align-items: flex-start; }
      soci-user { color: var(--text-brand); }
      .edited, time {
        color: var(--text-secondary);
        display: inline;
        font-size: 12px;
        line-height: 18px;
        margin-left: 18px;
        position: relative;
        &::before {
          content: '';
          display: block;
          width: 4px;
          height: 4px;
          border-radius: 2px;
          background: var(--text-secondary);
          position: absolute;
          top: 8px;
          left: -13px;
        }
      }
      .edited { margin-left: 24px; font-style: italic; }
      #comment { margin-top: 4px; font-size: 14px; max-width: 900px; }
      #actions {
        display: flex;
        font-weight: 500;
        font-size: 11px;
        margin-top: 6px;
        align-items: center;
        max-width: 900px;
        user-select: none;
        color: var(--text-secondary);
        > div {
          cursor: pointer;
          &:hover { text-decoration: underline; }
          &:not(:first-child) { margin-left: 12px; }
        }
        .confirmable:hover { text-decoration: none; }
      }
      #view-replies { position: relative; }
      #vote-container { display: flex; position: relative; margin-left: 8px; }
      #upvote {
        display: flex;
        align-items: center;
        height: 20px;
        line-height: 20px;
        padding-right: 6px;
        border-radius: 3px;
        font-size: 12px;
        background: var(--upvote-bg);
        cursor: pointer;
        user-select: none;
        --fill-color: transparent;
        margin-right: 2px;
        soci-icon { color: var(--text-secondary); height: 20px; width: 20px; }
        &:hover { background: var(--upvote-bg-hover); color: var(--text-secondary-hover); }
        &:active { filter: brightness(0.9); }
        &[upvoted] {
          background: var(--bg-success);
          color: var(--text-inverse);
          --fill-color: var(--text-inverse);
          soci-icon { color: transparent; }
        }
      }
      soci-icon[glyph=downvote] {
        cursor: pointer;
        color: var(--text-secondary);
        --fill-color: transparent;
        height: 20px;
        width: 20px;
        &:hover { color: var(--text-secondary-hover); }
        &:active { color: var(--text-secondary-active); --fill-color: var(--text-secondary-active); }
        &[downvoted] { color: var(--text-danger); --fill-color: var(--text-danger); }
      }
      #replies { position: relative; height: auto; }
      .confirmable {
        display: flex;
        &[active] > span:hover { text-decoration: none; }
        &[active] .confirm-controls { display: flex; margin-left: 4px; }
        span:hover { text-decoration: underline; }
      }
      .confirm-controls {
        display: none;
        span:first-child { margin-right: 4px; color: var(--text-danger); }
      }
      #comment-edit, #comment-reply {
        height: 0px;
        position: relative;
        border: 1px solid transparent;
        transition: height 0.1s ease-out;
        margin-top: 0;
        pointer-events: none;
        &.active {
          height: auto;
          margin-top: 10px;
          pointer-events: all;
          actions { margin: 4px 0 -8px; display: flex; justify-content: flex-end; }
        }
      }
      actions soci-button:last-child { margin-right: 0; }
      ::slotted(soci-input:not([readonly])) {
        border: 1px solid var(--bg-secondary);
        border-radius: 4px;
        --min-height: 140px !important;
      }
      @media (max-width: 768px) {
        #actions { font-size: 13px; line-height: 24px; }
      }
    `
  }

  html(){ return `
    <comment>
      <top>
        <soci-user size="small"></soci-user>
        <div id="vote-container">
          <div id="upvote" @click=_upvote>
            <soci-icon glyph="upvote"></soci-icon>
            <div id="score"></div>
          </div>
          <soci-icon glyph="downvote" @click=_downvote></soci-icon>
        </div>
        <time>0s ago</time>
        <span class="edited">edited</span>
      </top>
      <div id="comment">
        <slot name="content"></slot>
      </div>
      <div id="actions">
        <div id="reply" @click=_reply>reply</div>
        <div id="view-replies" @click=_toggleReplies></div>
        <div id="edit" class="user-control" @click=_edit>edit</div>
        <div id="delete" class="user-control confirmable">
          <span @click=_promptDelete>delete</span>
          <div class="confirm-controls">
            <span @click=_delete>yes</span>
            <span @click=_cancelDelete>no</span>
          </div>
        </div>
        <div id="abandon" class="user-control confirmable">
          <span @click=_promptAbandon>abandon</span>
          <div class="confirm-controls">
            <span @click=_abandon>yes</span>
            <span @click=_cancelAbandon>no</span>
          </div>
        </div>
      </div>
    </comment>
    <div id="comment-edit"></div>
    <div id="comment-reply"></div>
    <div id="replies">
      <slot>
      </slot>
    </div>
    <guide></guide>
  `}

  static get observedAttributes() {
    return ['score', 'user', 'replies', 'date', 'content', 'edited']
  }

  attributeChangedCallback(name, oldValue, newValue){
    switch(name) {
      case 'score':
        this.select('#score').innerHTML = newValue
        break
      case 'user':
        this.select('soci-user').setAttribute('name', newValue)
        this.toggleAttribute('self', newValue == soci.username) 
        break
      case 'date':
        this.updateTime(newValue, this.select('time'))
        break
    }
  }

  connectedCallback(){
    let numberOfReplies = this.querySelectorAll('soci-comment').length
    if(numberOfReplies)
      this.select('#view-replies').innerHTML = `view ${this.querySelectorAll('soci-comment').length} replies`
    else this.select('#view-replies').style.display = "none"

    if(this.hasAttribute('date')) this.updateTime(this.getAttribute('date'), this.select('time'))

    if(!this.quillView){
      this.quillView = document.createElement('soci-markdown-view')
      this.quillView.setAttribute('slot', 'content')
      this.appendChild(this.quillView)
    }
    this._renderContent()

    let user = this.select('soci-user')
    user.toggleAttribute('op', user.getAttribute('name') == this.closest('soci-post')?.getAttribute('user')) 
  }

  disconnectedCallback(){
    if(this._updateTimer){
      clearTimeout(this._updateTimer)
    } 
  }

  get score(){
    return parseInt(this.getAttribute('score'))
  }

  set score(val){
    this.setAttribute('score', val)
  }

  get content() {
    return this._content
  }

  set content(val){
    this._content = val
    this._renderContent()
  }

  get url(){
    return this.closest('[url]').getAttribute('url')
  }

  get community(){
    return this.closest('soci-comment-list')?.getAttribute('community') || window.soci.routeContext.community || ''
  }

  factory(user, score, lineageScore, date, id, content, edited){
    let comment = document.createElement('soci-comment')
    comment.setAttribute('user', user)
    comment.setAttribute('score', score)
    comment.setAttribute('lineage-score', lineageScore)
    comment.setAttribute('date', date)
    comment.setAttribute('comment-id', id)
    comment.toggleAttribute('edited', Boolean(edited))
    comment.content = content
    return comment
  }

  prependToElement(el){
    this.toggleAttribute('inserting', true)
    this.style.transition = 'height 0.1s ease-out 0.1s, transform 0.2s ease-in-out, opacity 0.2s ease-out'
    el.prepend(this)
    setTimeout(()=>{
      let finalHeight = this.offsetHeight
      this.style.position = ''
      this.style.height = '0'
      setTimeout(()=>{
        this.style.height = finalHeight + 'px'
        this.toggleAttribute('inserting', false)
        setTimeout(()=>{
          this.style.height = ''
        }, 100)
      }, 1)
    }, 1)
  }

  _renderContent(){
    let contentContainer = this.querySelector('soci-markdown-view[slot="content"]')
    contentContainer?.render(this._content)
  }

  _reply(){
    let replyInput = document.createElement('soci-input')
    replyInput.setAttribute('placeholder', 'Enter reply')
    replyInput.setAttribute('slot', 'reply')
    this.appendChild(replyInput)

    let replyContainer = this.select('#comment-reply')
    replyContainer.innerHTML = `
      <slot name="reply"></slot>
      <actions>
        <soci-button>submit</soci-button>
        <soci-button subtle>cancel</soci-button>
      </actions>`
    replyContainer.querySelector('soci-button').addEventListener('click', this._submitReply.bind(this))
    replyContainer.querySelector('soci-button[subtle]').addEventListener('click', this._cancelReply.bind(this))
    replyContainer.classList.add('active')
    replyContainer.style.height = '172px'
    replyContainer.style.overflow = 'hidden'
    setTimeout(()=>{
      replyContainer.style.height = ''
      replyContainer.style.overflow = ''
      this.querySelector('soci-input')?.focus()
    }, 100)

    this.select('#actions').style.display = 'none'
    if(!this.hasAttribute('expanded')) this._toggleReplies()
  }

  _cancelReply(){
    let replyContainer = this.select('#comment-reply')
    replyContainer.innerHTML = ''
    replyContainer.classList.remove('active')
    this.select('#actions').style.display = ''
    this.querySelector('soci-input').remove()
  }

  _toggleReplies(e){
    this.toggleAttribute('expanded')
    let button = this.select('#view-replies')
    if(this.hasAttribute('expanded')){
      button.innerHTML = "hide replies"
    }
    else {
      button.innerHTML = `view ${this.querySelectorAll('soci-comment').length} replies`
    }
  }

  showVote(upvote){
    if(upvote){
      let upvote = this.select('#upvote')
      upvote.toggleAttribute('upvoted', true)
    }
    else {
      let downvote = this.select('soci-icon[glyph="downvote"]')
      downvote.toggleAttribute('downvoted', true)
    }
  }

  _upvote(){
    let upvote = this.select('#upvote')
    let downvote = this.select('soci-icon[glyph="downvote"]')
    upvote.toggleAttribute('upvoted')
    if(upvote.hasAttribute('upvoted')){
      this.score += downvote.hasAttribute('downvoted') ? 2 : 1
      downvote.removeAttribute('downvoted')
      this.postData('/comment/add-vote', {
        id: parseInt(this.getAttribute('comment-id')),
        upvoted: true
      })
    }
    else {
      this.postData('/comment/remove-vote', {
        id: parseInt(this.getAttribute('comment-id')),
      })
      this.score--
    }
  }

  _downvote(){
    let upvote = this.select('#upvote')
    let downvote = this.select('soci-icon[glyph="downvote"]')
    downvote.toggleAttribute('downvoted')
    if(downvote.hasAttribute('downvoted')){
      this.score -= upvote.hasAttribute('upvoted') ? 2 : 1
      upvote.removeAttribute('upvoted')
      this.postData('/comment/add-vote', {
        id: parseInt(this.getAttribute('comment-id')),
        upvoted: false
      })
    }
    else {
      this.postData('/comment/remove-vote', {
        id: parseInt(this.getAttribute('comment-id')),
      })
      this.score++
    }
  }

  _submitReply(){
    this.postData('/comment/create', {
      post: this.url,
      content: this.querySelector('soci-input').value,
      parent: parseInt(this.getAttribute('comment-id')),
      community: this.community
    }).then(res=>{
      if(res.id){
        // TODO - fix the animation here. Should animate smoothly.
        //this.select('#submit').success()
        let comment = document.createElement('soci-comment')
        comment = comment.factory(res.user, 0, 0, Date.now(), res.id, res.content)
        comment.prependToElement(this)
        this._cancelReply()

        this.fire('activitychange')
      }
      else {
        //this.select('#submit').error()
      }
    })
  }

  _delete(){
    this.postData('/comment/delete', {
      id: parseInt(this.getAttribute('comment-id'))
    })
    
    this.remove()
  }

  _cancelDelete(){
    this.select('#delete').toggleAttribute('active', false)
    this.select('#delete span').innerHTML = 'delete'
  }

  _promptDelete(){
    this.select('#delete').toggleAttribute('active', true)
    this.select('#delete span').innerHTML = 'confirm delete?'
  }

  _abandon(){
    this.postData('/comment/abandon', {
      id: parseInt(this.getAttribute('comment-id'))
    })

    this.setAttribute('user', 'Anonymous coward')
    this.toggleAttribute('self', false)
  }

  _cancelAbandon(){
    this.select('#abandon').toggleAttribute('active', false)
    this.select('#abandon span').innerHTML = 'abandon'
  }

  _promptAbandon(){
    this.select('#abandon').toggleAttribute('active', true)
    this.select('#abandon span').innerHTML = 'confirm abandon?'
  }

  _edit(){
    let editInput = document.createElement('soci-input')
    editInput.setAttribute('placeholder', 'Enter comment')
    editInput.setAttribute('slot', 'edit')
    this.appendChild(editInput)
    editInput.value = this.querySelector('soci-markdown-view').value

    this.style.minHeight = this.offsetHeight
    this.select('#comment').style.display = 'none'
    let editContainer = this.select('#comment-edit')
    editContainer.innerHTML = `
      <slot name="edit"></slot>
      <actions>
        <soci-button async>save</soci-button>
        <soci-button subtle>cancel</soci-button>
      </actions>`
    editContainer.querySelector('soci-button').addEventListener('click', this._submitEdit.bind(this))
    editContainer.querySelector('soci-button[subtle]').addEventListener('click', this._cancelEdit.bind(this))
    editContainer.classList.add('active')
    let input = this.querySelector('soci-input')
    setTimeout(()=>{
      input?.toggleAttribute('subtle', false)
      input?.focus()
      input?.setSelection(Number.MAX_SAFE_INTEGER)
    }, 1)

    this.select('#actions').style.display = 'none'
  }

  _cancelEdit(){
    this.select('#comment').style.display = ''
    let editContainer = this.select('#comment-edit')
    editContainer.innerHTML = ''
    editContainer.classList.remove('active')
    this.select('#actions').style.display = ''
    this.querySelector('soci-input').remove()
  }

  _submitEdit(){
    let content = this.querySelector('soci-input').value
    this.postData('/comment/edit', {
      id: parseInt(this.getAttribute('comment-id')),
      content: content
    }).then(()=>{
      this.select('#comment-edit soci-button').success()
      setTimeout(()=>{
        this.querySelector('soci-markdown-view').value = content
        this._cancelEdit()
      }, 1000)
    })
  }
}