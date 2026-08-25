let community = {
  dom: document.currentScript.closest('nonio-route'),
  init: () => {
    nonio.registerPage(community)
  },
  onActivate: () => {
    let path = document.location.pathname
    let match = path.match(/^\/@([\w-]+)/)
    if(!match) return
    let communityName = match[1]
    document.title = communityName

    // Fetch community details
    nonio.getData(`communities/${communityName}`).then(res => {
        if(res.error) {
            console.error(res.error)
            return
        }
        // Update UI with community details
        community.dom.querySelector('h1.name').innerText = res.name
        community.dom.querySelector('.description').innerText = res.description || ''
    })

    let postList = community.dom.querySelector('nonio-post-list')
    postList.setAttribute('data', `/posts?community=${communityName}`)

    let subscribeButton = community.dom.querySelector('.subscribe-button')
    subscribeButton.addEventListener('click', async () => {
        if(subscribeButton.hasAttribute('subscribed')) {
            await window.api.community.unsubscribe(communityName)
            subscribeButton.removeAttribute('subscribed')
            subscribeButton.innerText = 'Subscribe'
        } else {
            await window.api.community.subscribe(communityName)
            subscribeButton.setAttribute('subscribed', '')
            subscribeButton.innerText = 'Unsubscribe'
        }
    })

    if(nonio.username) {
        nonio.getData('communities/subscribed').then(res => {
            if(res.communities && res.communities.find(c => c.url == communityName)) {
                subscribeButton.setAttribute('subscribed', '')
                subscribeButton.innerText = 'Unsubscribe'
            }
        })
    }
  }
}

document.addEventListener('DOMContentLoaded', community.init)

