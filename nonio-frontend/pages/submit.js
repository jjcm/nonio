let submit = {
  dom: document.currentScript.closest('nonio-route'),
  init() {
    nonio.registerPage(submit)
  },
  form: null, 
  currentCommunity: null,
  onActivate() {
    console.log('Submit onActivate')
    const dom = submit.dom || this
    submit.form = dom.querySelector('form')

    submit.currentCommunity = window.nonio.routeContext.community
    
    console.log('Submit onActivate - path:', window.nonio.routeContext.path, 'currentCommunity:', submit.currentCommunity)

    document.title = submit.currentCommunity 
      ? `Submit to ${submit.currentCommunity}` 
      : 'Submit post to Nonio'
    
    let title = dom.querySelector('input[name="title"]')
    title.setCustomValidity("A title is required.")
    title.addEventListener('input', submit.checkTitleValidity)
    title.addEventListener('input', submit.populateUrl)
    title.addEventListener('blur', submit.checkUrl)
    title.focus()

    submit.submitButton = dom.querySelector('nonio-button')
    submit.submitButton.addEventListener('click', submit.submit)

    let linkInput = dom.querySelector('nonio-link-input')
    linkInput.addEventListener('url-metadata', submit.setLinkMetadata)
  },
  checkTitleValidity(e) {
    e.target.setCustomValidity(e.target.value.length ? '' : "A title is required.")
  },
  populateUrl(e){
    setTimeout(()=>{
      let title = e.target.value.replace(/[^a-zA-Z0-9\-\. ]/gi, '')
      title = title.replace(/ /g, '-')

      let urlInput = submit.dom.querySelector('nonio-url-input')
      if(!urlInput.manuallySet) urlInput.value = title
    }, 1)
  },
  checkUrl(e){
    if(e.target.value.length > 0)
      submit.dom.querySelector('nonio-url-input').checkUrlValidity()
  },
  async submit(e) {
    if(submit.form.reportValidity()){
      let data = new FormData(submit.form)
      let type = submit.dom.querySelector('nonio-tab[active]').getAttribute('name').toLowerCase()
      let fileUploader = submit.dom.querySelector(`nonio-${type}-uploader`)
      if(fileUploader){
        let newPath = await fileUploader.move(data.get('url'))
        if(newPath == null) {
          console.error("Error moving file to its new url")
          return 0
        }
      }
      let linkUploader = submit.dom.querySelector('nonio-link-input')
      if(linkUploader && linkUploader.imageUrl) {
        let newPath = await linkUploader.move(data.get('url'))
        if(newPath == null) {
          console.error("Error moving file to its new url")
          return 0
        }
      }

      let payload = {
        title: data.get('title'),
        url: data.get('url'),
        content: data.get('description'),
        link: data.get('link'),
        type: type,
        width: fileUploader?.width,
        height: fileUploader?.height
      }
      
      // Only add community if we're in a community context
      if(submit.currentCommunity) {
        payload.community = submit.currentCommunity
      }
      
      console.log('Submitting post with payload:', payload)

      window.api.posts.create(payload).then(e=>{
        if(e.url){
          submit.submitButton.success()
          let url = submit.currentCommunity ? `/@${submit.currentCommunity}/${e.url}` : `/${e.url}`
          window.history.pushState(null, null, url)
          window.dispatchEvent(new HashChangeEvent('hashchange'))
          document.dispatchEvent(new CustomEvent('activitychange'))
        }
        else {
          submit.submitButton.error()
        }
      })
    }
    else {
      submit.submitButton.error()
    }
  },
  setLinkMetadata(e) {
    let previewLi = submit.dom.querySelector('nonio-post-li')
    previewLi.setAttribute('post-title', '&nbsp;')
    let title = submit.dom.querySelector('input[name="title"]')
    if(title.value == '') {
      title.value = e.detail.title
      title.setCustomValidity('')
    }
    if(title.value != '') {
      previewLi.setAttribute('post-title', title.value)
    }
    if(e.detail.image) {
      let img = previewLi.querySelector('img') || document.createElement('img')
      img.src = e.detail.image
      img.setAttribute('slot', 'thumbnail')
      previewLi.appendChild(img)
    }
    if(title.value == '' || e.detail.image) {
      submit.dom.querySelector('.preview').classList.toggle('active', true)
      setTimeout(()=>{ 
        submit.dom.querySelector('.preview').style = 'overflow: inherit; height: auto;'
      }, 100)
    }

    let description = submit.dom.querySelector('nonio-input[name="description"]')
    if(description.value == '') {
      description.setText(e.detail.description)
    }
  }
}

submit.init()