let user = {
  dom: document.currentScript.closest('soci-route'),
  type: 'posts',
  username: '',
  init: () => {
    soci.registerPage(user)
  },
  onActivate: () => {
    user.username = document.location.pathname.slice(6)
    user.type = window.location.hash === '#comments' ? 'comments' : 'posts'
    document.title = 'Overview for ' + user.username
    user.renderContent()
    window.removeEventListener('user-tab', user.onUserTab)
    window.addEventListener('user-tab', user.onUserTab)
    window.removeEventListener('user-nuke', user.nuke)
    window.addEventListener('user-nuke', user.nuke)
  },
  renderContent: () => {
    let container = user.dom.querySelector('.inner-content')
    if(!container) return
    const u = user.username.replaceAll('"', '&quot;')
    if(user.type === 'posts'){
      container.innerHTML = `<soci-post-list user="${u}" sort="top"></soci-post-list>`
    }
    else {
      container.innerHTML = `<soci-user-comment-list data="/${user.type}?user=${user.username}&sort=top"></soci-user-comment-list>`
    }
  },
  onUserTab: (e) => {
    const nextType = e?.detail?.type
    if(nextType !== 'posts' && nextType !== 'comments') return
    user.type = nextType
    user.renderContent()
  },
  nuke: async () => {
    let button = document.querySelector('soci-sidebar-user-panel soci-button.nuke-user')
    if(confirm('Are you sure you want to nuke this user? This will delete all their posts and comments.')) {
      let username = document.location.pathname.slice(6)
      let response = await window.api.user.nuke(username)
      console.log(response)
      if(response === true) {
        button?.success()
        setTimeout(() => {
          document.location.href = '/'
        }, 1500)
      }
      else {
        button?.error()
      }
    }
  },
}

document.addEventListener('DOMContentLoaded', user.init)
