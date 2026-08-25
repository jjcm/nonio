let notifications = {
  dom: document.currentScript.closest('nonio-route'),
  init: () => {
    nonio.registerPage(notifications)
  },
  onActivate: () => {
    notifications.dom.querySelector('header').addEventListener('click', notifications.tabClick)
    let container = notifications.dom.querySelector('.inner-content')
    if(nonio.notificationCount) {
      notifications.dom.querySelectorAll('.type').forEach(tab => {
        console.log("unread")
        tab.toggleAttribute('selected', tab.innerHTML == "Unread")
      })
    }
    console.log(nonio.notificationCount)
    container.innerHTML = `<nonio-user-comment-list data="/notifications${nonio.notificationCount ? '?unread=true' : ''}"></nonio-user-comment-list>`
  },
  tabClick: e => {
    if(e.target.className == 'type'){
      let container = notifications.dom.querySelector('.inner-content')
      e.target.parentElement.querySelector('[selected]').removeAttribute('selected')
      e.target.toggleAttribute('selected', true)

      if(e.target.innerHTML == "Unread")
        container.innerHTML = `<nonio-user-comment-list data="/notifications?unread=true"></nonio-user-comment-list>`
      else 
        container.innerHTML = `<nonio-user-comment-list data="/notifications"></nonio-user-comment-list>`
    }
  }
}

document.addEventListener('DOMContentLoaded', notifications.init)