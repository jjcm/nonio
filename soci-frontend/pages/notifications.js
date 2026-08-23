let notifications = {
  dom: document.currentScript.closest('soci-route'),
  init: () => {
    soci.registerPage(notifications)
  },
  onActivate: () => {
    notifications.dom.querySelector('header').addEventListener('click', notifications.tabClick)
    let container = notifications.dom.querySelector('.inner-content')
    if(soci.notificationCount) {
      notifications.dom.querySelectorAll('.type').forEach(tab => {
        console.log("unread")
        tab.toggleAttribute('selected', tab.innerHTML == "Unread")
      })
    }
    console.log(soci.notificationCount)
    container.innerHTML = `<soci-user-comment-list data="/notifications${soci.notificationCount ? '?unread=true' : ''}"></soci-user-comment-list>`
  },
  tabClick: e => {
    if(e.target.className == 'type'){
      let container = notifications.dom.querySelector('.inner-content')
      e.target.parentElement.querySelector('[selected]').removeAttribute('selected')
      e.target.toggleAttribute('selected', true)

      if(e.target.innerHTML == "Unread")
        container.innerHTML = `<soci-user-comment-list data="/notifications?unread=true"></soci-user-comment-list>`
      else 
        container.innerHTML = `<soci-user-comment-list data="/notifications"></soci-user-comment-list>`
    }
  }
}

document.addEventListener('DOMContentLoaded', notifications.init)