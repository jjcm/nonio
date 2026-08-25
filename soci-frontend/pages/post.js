let post = {
  init() {
    let postRoute = document.querySelector('#post')
    if(postRoute) {
      postRoute.addEventListener('routeactivate', post.onActivate)
    }
  },
  onActivate(e) {
    let route = e.target
    let postElement = route.querySelector('nonio-post')
    let path = window.nonio.routeContext.path
    let url = path.substr(1)

    // Check if it's a community post (/@community/post-slug)
    let match = path.match(/^\/@([\w-]+)\/([\w-]+)$/)
    if(match) {
        url = match[2] // The post slug (without community prefix)
        postElement.setAttribute('community', match[1])
    } else {
        postElement.removeAttribute('community')
    }

    postElement.setAttribute('url', url)
  },
  submit(e) {
    if(submit.form.checkValidity()){
      e.preventDefault()
      let data = new FormData(submit.form)

      nonio.postData('post/create', {
        title: data.get('title'),
        url: data.get('url'),
        content: data.get('description'),
        type: document.querySelector('#submit nonio-tab[active]').getAttribute('name').toLowerCase()
      }).then(e=>{
        if(e.url){
          window.history.pushState(null, null, e.url)
          window.dispatchEvent(new HashChangeEvent('hashchange'))
        }
      })
    }
  },
}

document.addEventListener('DOMContentLoaded', post.init)