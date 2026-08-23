let tags = {
  dom: document.currentScript.closest('soci-route'),
  init: () => {
    soci.registerPage(tags)
  },
  onActivate: () => {
    tags.dom.innerHTML = ''
    const hash = window.location.hash || ''
    const community = window.soci.routeContext.community
    let tag = hash.replace('#', '').split('+')[0]
    if (tag === '') tag = 'all'

    let list = document.createElement('soci-post-list')
    list.setAttribute('tag', decodeURIComponent(tag))
    if (community) list.setAttribute('community', community)
    tags.dom.appendChild(list)
  },
  onDeactivate: () => {
    document.querySelector('soci-sidebar')?.activateTag?.('')
  }
}

tags.init()