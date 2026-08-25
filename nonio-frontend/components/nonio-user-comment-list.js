import NonioComponent from './nonio-component.js'

export default class NonioCommentList extends NonioComponent {
  constructor() {
    super()
  }

  css(){
    return `
      :host {
        display: block;
        padding: 2px 8px;
        opacity: 0;
        transform: translateY(12px);
      }
      :host([loaded]) {
        transform: translateY(0);
        opacity: 1;
        transition: transform 0.35s cubic-bezier(0.15, 0, 0.2, 1), opacity 0.35s var(--nonio-ease);
      }
      content {
        display: block;
        padding: 0 20px 24px;
        margin: 0 auto;
        box-sizing: border-box;
      }
      ::slotted(nonio-comment) {
        padding-left: 0;
        padding: 12px 20px;
        margin: 8px 0;
        border-radius: 8px;
        background: var(--bg);
        box-shadow: 0px 1px 3px var(--shadow);
      }
    `
  }

  static get observedAttributes() {
    return ['data']
  }

  async attributeChangedCallback(name, oldValue, newValue){
    switch(name) {
      case 'data':
        this.renderComments(newValue)
        break
    }
  }

  async renderComments(path){
    this.toggleAttribute('loaded', false)
    let comments = await this.getData(path, this.authToken)
    comments = comments.comments || comments.notifications

    comments?.forEach(comment => {
      let newComment = document.createElement('nonio-user-comment')
      let unread = path.includes('notifications') && comment.read === false
      newComment = newComment.factory(comment.user, comment.upvotes - comment.downvotes, comment.lineage_score, comment.date, comment.comment_id || comment.id, comment.content, comment.edited, comment.post, comment.post_title, unread)
      if(path.includes('notifications')) newComment.setAttribute('notification-id', comment.id)
      this.appendChild(newComment)
    })

    this.toggleAttribute('loaded', true)

    let votes = await this.getData(path.replace(/^\/comments/, '/comment-votes'), this.authToken)
    votes = votes.commentVotes

    votes?.forEach(vote => {
      let comment = this.querySelector(`nonio-comment[comment-id="${vote.comment_id}`)
      comment.showVote(vote.upvote)
    })
  }
}
