let home = {
  dom: document.currentScript.closest('soci-route'),
  init: () => {
    soci.registerPage(home)
  },
  onActivate: () => {
    document.title = "Nonio - A platform for creators"
    let accountActions = home.dom.querySelector('.account-actions')
    if(soci.accessToken){
      let expiry = 0
      try {
        expiry = parseInt(JSON.parse(atob(soci.accessToken.split('.')[1])).expiresAt)
      }
      catch {
      }
      console.log(expiry)
      if(expiry > Date.now() / 1000) accountActions.style.display = "none"
      else {
        accountActions.style.display = "block"
        accountActions.querySelector('.login').classList.add('primary')
        accountActions.querySelector('.register').classList.remove('primary')
      }
    }
    else {
      accountActions.style.display = "block"
      accountActions.querySelector('.login').classList.remove('primary')
      accountActions.querySelector('.register').classList.add('primary')
    }
  },
  onDeactivate: () => {
  }
}

document.addEventListener('DOMContentLoaded', home.init)