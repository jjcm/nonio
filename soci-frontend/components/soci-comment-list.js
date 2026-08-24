import SociComponent from './soci-component.js'

export default class SociCommentList extends SociComponent {
  constructor() {
    super()
  }

  css(){
    return `
      :host {
        display: block;
        background: linear-gradient(var(--shadow-dark) 0px, var(--shadow-light) 1px, var(--bg) 30px);
      }
      controls {
        display: flex;
        width: 100%;
        max-width: 840px;
        margin: 0 auto;
        justify-content: space-between;
        color: var(--text-secondary);
        font-weight: 500;
        font-size: 12px;
        box-sizing: border-box;
        height: 30px;
        line-height: 30px;
        padding: 0 22px;
      }
      filtering { display: flex; }
      filter {
        margin-left: 32px;
        position: relative;
        cursor: pointer;
        &:hover, &[active] { color: var(--text); }
        &[active]::after {
          content: '';
          display: block;
          position: absolute;
          top: -2px;
          left: calc(50% - 8px);
          width: 16px;
          height: 4px;
          border-radius: 2px;
          background: var(--bg);
          box-shadow: 0 1px 1px var(--shadow-light);
        }
      }
      comment-count { white-space: nowrap; margin-right: 6px; }
      content {
        display: block;
        padding: 0 20px 24px;
        max-width: 840px;
        margin: 0 auto;
        box-sizing: border-box;
      }
      soci-input { --min-height: 82px; }
      comment-input {
        display: block;
        padding: 0 18px;
        max-width: 840px;
        box-sizing: border-box;
        margin: 0 auto;
        &[active] {
          ::slotted(soci-input) { --min-height: 200px !important; margin-bottom: 8px; }
          button-container { height: 20px; }
        }
      }
      ::slotted(soci-input) {
        --min-height: 82px !important;
        margin-bottom: 8px;
        border: 1px solid var(--bg-secondary);
        border-radius: 4px;
        margin: 2px auto 20px;
      }
      button-container {
        display: block;
        height: 0;
        overflow: hidden;
        position: relative;
        padding-left: 12px;
        transition: all 0.1s var(--soci-ease);
        max-width: 840px;
        margin: 0 auto;
      }
      ::slotted(soci-comment) { padding-left: 0; }
    `
  }

  html(){ return `
      <controls>
        <comment-count>0 comments</comment-count>
        <filtering @click=_filter>
          <filter active data-sort="lineage-score">Best</filter>
          <filter data-sort="score">Top</filter>
          <filter data-sort="date">New</filter>
        </filtering>
      </controls>
      <comment-input>
        <slot name="comment-input"></slot>
        <button-container>
          <soci-button @click=cancelComment subtle>cancel</soci-button>
          <soci-button id="submit" @click=addComment async>submit</soci-button>
        </button-container>
      </comment-input>
      <content>
        <slot></slot>
      </content>
    `
  }

  connectedCallback(){
    let commentInput = document.createElement('soci-input')
    commentInput.setAttribute('placeholder', 'Enter comment')
    commentInput.setAttribute('slot', 'comment-input')
    commentInput.addEventListener('focusin', this._onFocus.bind(this))
    this.appendChild(commentInput)
  }

  static get observedAttributes() {
    return ['url', 'community']
  }

  attributeChangedCallback(name, oldValue, newValue){
    switch(name) {
      case 'url':
        this.renderComments(newValue)
        break
      case 'community':
        if(this.url) this.renderComments(this.url)
        break
    }
  }

  _onFocus(){
    this.select('comment-input').toggleAttribute('active', true)
    this.querySelector('soci-input').toggleAttribute('active', true)
  }

  cancelComment(){
    this.querySelector('soci-input').clear()
    this.select('comment-input').toggleAttribute('active', false)
    this.querySelector('soci-input').toggleAttribute('active', false)
  }

  _filter(e){
    if(e.target.tagName != 'FILTER') return 0
    let current = this.select('filter[active]')
    if(current) current.removeAttribute('active')
    e.target.toggleAttribute('active')

    let sort = e.target.dataset.sort
    let comments = Array.from(this.children)

    let sortComments = (parent, comments, sort) => {
      comments = comments.sort((a,b)=>{
        return parseInt(b.getAttribute(sort)) - parseInt(a.getAttribute(sort))
      })
      comments.forEach(comment => {
        parent.appendChild(comment)
        if(comment.children.length > 2){
          sortComments(comment, Array.from(comment.children), sort)
        }
      })
    }

    sortComments(this, comments, sort)
  }

  async renderComments(url){
    const community = this.community
    const communityQuery = community ? `&community=${community}` : ''
    let comments = await this.getData('/comments?post=' + url + communityQuery)
    comments = comments.comments
    this.select('comment-count').innerHTML = comments.length + (comments.length == 1 ? ' comment' : ' comments')

    comments.sort((a,b)=>{
      if(b.lineage_score = a.lineage_score) return a.parent - b.parent
      else return b.lineage_score - a.lineage_score
    })

    comments.forEach(comment => {
      let newComment = document.createElement('soci-comment')
      newComment = newComment.factory(comment.user, comment.upvotes - comment.downvotes, comment.lineage_score, comment.date, comment.id, comment.content, comment.edited)
      let parent = comment.parent > 0 ? this.querySelector(`soci-comment[comment-id="${comment.parent}"]`) : this
      parent?.appendChild(newComment)
    })

    // Votes only decorate comments that are already on screen, and only exist
    // for a signed-in reader, so they must not gate the tree render. Previously
    // this round trip was awaited first and returned 401 for anonymous
    // visitors, costing every one of them a full RTT before any comment
    // appeared.
    if(!this.authToken) return
    const votes = (await this.getData('/comment-votes?post=' + url + communityQuery, this.authToken))?.commentVotes
    votes?.forEach(vote => {
      let comment = this.querySelector(`soci-comment[comment-id="${vote.comment_id}`)
      comment?.showVote(vote.upvote)
    })
  }

  addComment(){
    let value = this.querySelector('soci-input').value
    this.postData('/comment/create', {
      post: this.url,
      content: value,
      community: this.community
    }).then(res=>{
      if(res.id){
        this.select('#submit').success()
        let comment = document.createElement('soci-comment')
        comment = comment.factory(res.user, 0, 0, Date.now(), res.id, res.content)
        comment.prependToElement(this)
        setTimeout(() => {
          this.cancelComment()
        }, 100)
      }
      else {
        this.select('#submit').error()
      }
    })
  }

  get url(){
    return this.getAttribute('url')
  }

  get community(){
    return this.getAttribute('community') || window.soci.routeContext.community || ''
  }
}
