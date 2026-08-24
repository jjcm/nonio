import SociComponent from './soci-component.js'

export default class SociTagGroup extends SociComponent {
  constructor() {
    super()
  }

  css(){ return `
    :host {
      --height: 20px;
      --tag-font-size: 10px;
      display: inline-flex;
      align-items: center;
      position: relative;
      max-width: 100%;
      height: var(--height);
      vertical-align: top;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    #tags {
      overflow: hidden;
      height: var(--height);
      line-height: var(--height);
      border-radius: 3px;
      scrollbar-width: none;
      display: inline-block;
      vertical-align: top;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    #tags slot {
      display: inline-flex;
      vertical-align: top;
    }
    :host::-webkit-scrollbar {
      display: none;
    }
    #add-tag {
      border: 1px solid var(--bg-secondary);
      box-sizing: border-box;
      height: var(--height);
      width: 32px;
      min-width: 32px;
      border-radius: 3px;
      text-align: center;
      display: inline-flex;
      align-items: center;
      cursor: pointer;
      position: relative;
    }
    #add-tag:before {
      content: '';
      width: 4px;
      position: absolute;
      left: -5px;
      top: 0;
      height: var(--height);
      background: linear-gradient(90deg, transparent 0%, var(--bg) 100%);
    }
    #add-tag:not([active]):hover {
      background: var(--bg-hover);
    }
    #add-tag input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
      width: calc(100% - 2px);
      border: 0;
      height: 18px;
      padding-left: 28px;
      box-sizing: border-box;
      line-height: 18px;
      background: transparent;
      color: var(--text-secondary);
      right: 0;
    }
    #add-tag svg {
      position: absolute;
      left: 7px;
    }
    #add-tag[active] {
      transition: all 0.1s var(--soci-ease-out);
      width: 150px;
      background: var(--bg-brand-secondary);
      border: 1px solid var(--bg-brand);
    }
    #add-tag[active] input {
      opacity: 1;
      pointer-events: all;
    }
    #add-tag[active] input:focus,
    #add-tag[active] input:active {
      outline: 0;
    }

    #tag-search {
      display: none;
      position: absolute;
      right: 0;
      border: 1px solid var(--bg-brand-secondary);
      border-radius: 3px;
      list-style: none;
      padding: 4px 0;
      line-height: 20px;
      top: 10px;
      z-index: 10;
      background: var(--bg);
      box-shadow: 1px 0 8px var(--shadow-light);
      min-width: 148px;
      overflow: auto;
    }

    #tag-search[active] {
      display: block;
    }
    
    #tag-search li {
      cursor: pointer;
      padding: 0 12px;
      user-select: none;
    }

    #tag-search li[selected] {
      background: var(--bg-brand-secondary);
    }

    #tag-search span {
      color: var(--text);
      opacity: 0.5;
      pointer-events: none;
    }

    #tag-search .count {
      float: right;
      margin-left: 12px;
      color: var(--text);
      opacity: 0.5;
      pointer-events: none;
    }

    :host([size="large"]) {
      --height: 20px;
      --tag-font-size: 14px;
    }

    :host([size="large"]) #arrow {
      width: 12px;
    }

    soci-user {
      --font-weight: 500;
    }

    ::slotted(soci-tag) {
      height: var(--height);
      line-height: var(--height);
      font-size: var(--tag-font-size);
      margin-right: 4px;
    }

    ::slotted(div) {
      font-size: 16px;
      height: calc(var(--height) - 2px);
      line-height: calc(var(--height) - 2px);
      color: var(--text-secondary);
      min-width: 36px;
      padding: 0 6px;
      text-align: center;
      border: 1px solid var(--bg-secondary);
      border-radius: 3px;
      font-weight: 600;
      user-select: none;
      margin-right: 3px;
    }

    :host([upvoted]) ::slotted(div) {
      color: var(--text-inverse);
      background: var(--bg-brand);
      border-color: var(--bg-brand);
    }


  `}

  html(){ return `
    <slot name="score"></slot>
    <ul id="tag-search" @mousemove=_tagSearchHover @click=addTag></ul>
    <div id="tags"><slot></slot></div>
    <div id="add-tag" @click=_addTagClick>
      <input type="text" autocomplete="off" name="tag"></input>
      <svg width="16px" height="17px" viewBox="0 0 24 17" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <g id="Symbols" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
          <g id="icon/tags" transform="translate(-4.000000, -5.000000)">
              <g>
                  <path d="M11.557416,6.29956503 C11.1595912,6.29956503 10.7780604,6.45760029 10.4967558,6.73890486 L6.49675579,10.7389049 C5.91096935,11.3246913 5.91096935,12.2744388 6.49675579,12.8602252 L10.4967558,16.8602252 C10.7780604,17.1415298 11.1595912,17.299565 11.557416,17.299565 L21.2959045,17.299565 C22.1243317,17.299565 22.7959045,16.6279922 22.7959045,15.799565 L22.7959045,7.79956503 C22.7959045,6.9711379 22.1243317,6.29956503 21.2959045,6.29956503 L11.557416,6.29956503 Z" id="Rectangle" stroke="currentColor" transform="translate(14.012447, 11.799565) rotate(135.000000) translate(-14.012447, -11.799565) "></path>
                  <path d="M15.9239992,8.86037916 L17.5218753,11.416981 C17.6682305,11.6511493 17.5970439,11.9596245 17.3628756,12.1059797 C17.2834098,12.1556458 17.191586,12.1819805 17.0978762,12.1819805 L13.9021238,12.1819805 C13.6259814,12.1819805 13.4021238,11.9581229 13.4021238,11.6819805 C13.4021238,11.5882707 13.4284585,11.4964468 13.4781247,11.416981 L15.0760008,8.86037916 C15.222356,8.62621089 15.5308312,8.55502431 15.7649995,8.70137948 C15.829384,8.74161983 15.8837588,8.79599459 15.9239992,8.86037916 Z" id="Triangle" stroke="currentColor" transform="translate(15.500000, 10.181981) rotate(45.000000) translate(-15.500000, -10.181981) "></path>
                  <rect id="Rectangle" fill="currentColor" x="23" y="13" width="5" height="1" rx="0.5"></rect>
                  <rect id="Rectangle" fill="currentColor" transform="translate(25.500000, 13.500000) rotate(-270.000000) translate(-25.500000, -13.500000) " x="23" y="13" width="5" height="1" rx="0.5"></rect>
              </g>
          </g>
      </g>
      </svg>
    </div>
  `}

  connectedCallback(){
    this._cancelAddTag = this._cancelAddTag.bind(this)
    this._inputKeyListener = this._inputKeyListener.bind(this)
    this.addEventListener('vote', this._tagVoted)
    this.toggleAttribute('upvoted', this.querySelectorAll('soci-tag[upvoted]').length)

  }

  get url(){
    return this.getAttribute('url')
  }

  set url(val){
    return this.setAttribute('url', val)
  }

  get score() {
    let score = this.getAttribute('score') || 0
    return parseInt(score)
  }

  set score(val){
    return this.setAttribute('score', val)
  }

  addTag(){
    if(!this.authToken) return window.soci?.requireLogin?.('add tags to posts')
    let input = this.select('#add-tag input')
    let tagName = input.value
    console.log(tagName)
    // Check if this tag already exists on the post
    let existingTag = Array.from(this.querySelectorAll('soci-tag')).find(tag=>tag.getAttribute('tag')==tagName)
    if(existingTag){
      existingTag.vote()
      this.prepend(existingTag)
      this.select('#add-tag input').value = ''
      this._closeTagSearch()
      return
    }
    const url = this.closest('[url]')?.getAttribute('url')
    if(!url) {
      console.warn('No url found when creating tag.')
      return 0
    }
    const community = this.closest('[community]')?.getAttribute('community') || window.soci.routeContext.community || ''

    this.postData('/posttag/create', {
      post: url,
      tag: tagName,
      community
    }).then(res => {
      console.log(res)
      if(res.postID && res.tagID)
        soci.votes[res.postID]?.push(res.tagID)
    })

    if(this.childNodes[0]?.nodeType == 3) this.childNodes[0].remove()
    this.innerHTML = `<soci-tag tag="${tagName}" score="1" upvoted></soci-tag>` + this.innerHTML
    this._tagVoted({detail:{upvoted: true}})
    this.select('#add-tag input').value = ''
    this._closeTagSearch()
  }

  _addTagClick(e){
    let button = this.select('#add-tag')
    if(button.hasAttribute('active')) return 0
    button.toggleAttribute('active')
    let input = this.select('input')
    input.focus()
    document.addEventListener('keydown', this._inputKeyListener)
    setTimeout(()=>{
      document.addEventListener('click', this._cancelAddTag)
    }, 1)
  }

  _cancelAddTag(e){
    this.select('#add-tag').removeAttribute('active')
    this.select('#add-tag input').value = ''
    document.removeEventListener('click', this._cancelAddTag)
    document.removeEventListener('keydown', this._inputKeyListener)
    this._closeTagSearch()
  }

  _tagSearchOpen = false
  _currentlySelectedTag = null

  _openTagSearch(e){
    this.select("#tag-search").toggleAttribute('active', true)
    this._tagSearchOpen = true
  }

  _closeTagSearch(e){
    this.select("#tag-search").removeAttribute('active')
    this._tagSearchOpen = false
  }

  _tagSearchHover(e){
    if(e.target != this._currentlySelectedTag){
      this._changeSearchSelection(e.target)
    }
  }

  _changeSearchSelection(selection){
    this._currentlySelectedTag.removeAttribute('selected')
    selection.toggleAttribute('selected', true)
    this.select('#add-tag input').value = selection.getAttribute('value')
    this._currentlySelectedTag = selection
  }

  _inputKeyListener(e){
    switch(e.key) {
      case 'Enter':
        this.addTag()
        return
      case 'Escape':
        this._cancelAddTag()
        return
      case ' ':
        e.preventDefault()
        let input = this.select('#add-tag input')
        setTimeout(()=>{
          if(input.value.charAt(input.value.length - 1) != '-')
            input.value = input.value + '-'
        }, 1)
      case '#':
      case '=':
      case '<':
      case '>':
      case '"':
      case "'":
      case ".":
      case "/":
      case "|":
      case "\\":
      case 'Shift':
        e.preventDefault()
        return
      case 'ArrowUp':
      case 'ArrowDown':
      case 'Tab':
        e.preventDefault()
        let currentSelected = this.select('#tag-search [selected]')
        let nextSelected = currentSelected[e.key == 'ArrowUp' ? 'previousElementSibling' : 'nextElementSibling']
        if(nextSelected) this._changeSearchSelection(nextSelected)
        return
    }
    
    setTimeout(()=>{
      this._updateTagSearch(this.select('#add-tag input')?.value)
    }, 1)
  }

  async _updateTagSearch(search){
    let dom = this.select("#tag-search")
    const community = this.closest('[community]')?.getAttribute('community') || window.soci.routeContext.community || ''
    const q = community ? `?community=${encodeURIComponent(community)}` : ''
    let tags = await this.getData('/tags/' + encodeURIComponent(search) + q, this.authToken)

    let match = false
    let createLi = `<li selected value=${search}>${search}<div class="count">new tag</div></li>`
    let tagsLis = `
      ${tags.tags.map(tag => {
        if(tag.tag == search) match = true
        if(tag.tag.indexOf(search) == 0) {
          return `<li ${tag.tag == search ? 'selected':''} value=${tag.tag} class="result">${tag.tag.slice(0,search.length)}<span>${tag.tag.slice(search.length)}</span><div class="count">${tag.count}</div></li>`
        }
        return ''
      }).join('\n')}
    `
    dom.innerHTML = (!match ? createLi : '') + tagsLis
    this._currentlySelectedTag = dom.querySelector('[selected]')
    if(search.length) {
      if(!this._tagSearchOpen) this._openTagSearch()
    }
    else this._closeTagSearch()
  }

  _tagVoted(e){
    let numberOfUpvotes = this.querySelectorAll('soci-tag[upvoted]').length
    if(numberOfUpvotes > 0){
      this.toggleAttribute('upvoted', true)
      if(numberOfUpvotes == 1 && e.detail.upvoted){
        this.score++
        this.fire('scoreChanged', {score: this.score})
      }
    }
    else {
      this.toggleAttribute('upvoted', false)
      this.score--
      this.fire('scoreChanged', {score: this.score})
    }

  }
}
