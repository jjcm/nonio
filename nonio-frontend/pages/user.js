let user = {
  dom: document.currentScript.closest('nonio-route'),
  type: 'posts',
  username: '',
  init: () => {
    nonio.registerPage(user)
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
      container.innerHTML = `<nonio-post-list user="${u}" sort="top"></nonio-post-list>`
    }
    else {
      container.innerHTML = `<nonio-user-comment-list data="/${user.type}?user=${user.username}&sort=top"></nonio-user-comment-list>`
    }
  },
  onUserTab: (e) => {
    const nextType = e?.detail?.type
    if(nextType !== 'posts' && nextType !== 'comments') return
    user.type = nextType
    user.renderContent()
  },
  nuke: async () => {
    let button = document.querySelector('nonio-sidebar-user-panel nonio-button.nuke-user')
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
