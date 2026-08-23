let tags = {
  dom: document.currentScript.closest('soci-route'),
  init: () => {
    soci.registerPage(tags)
  },
  onActivate: () => {
    const hash = window.location.hash || ''
    const community = window.soci.routeContext.community || ''
    let tag = hash.replace('#', '').split('+')[0]
    if (tag === '') tag = 'all'
    tag = decodeURIComponent(tag)

    // Returning to the same feed (e.g. back from a post) reattaches the
    // previous list: its posts are still in it and soci-post-list dedupes
    // the data URL, so no refetch and no re-render happen. Bounded to five
    // minutes so a long detour still comes back to a fresh feed.
    const key = `${tag}|${community}`
    if (tags._list && tags._key === key && Date.now() - tags._time < 300000) {
      tags.dom.appendChild(tags._list)
      return
    }

    tags.dom.innerHTML = ''
    let list = document.createElement('soci-post-list')
    list.setAttribute('tag', tag)
    if (community) list.setAttribute('community', community)
    tags._list = list
    tags._key = key
    tags._time = Date.now()
    tags.dom.appendChild(list)
  },
  onDeactivate: () => {
    document.querySelector('soci-sidebar')?.activateTag?.('')
  }
}

tags.init()