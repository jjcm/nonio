let webcomics = {
  dom: document.currentScript.closest('soci-route'),
  users: new Set(),
  init: () => {
    webcomics.dom.querySelectorAll('soci-tag-group').forEach(group => group.addEventListener('vote', webcomics.onvote))
  },
  onActivate: () => {
  },
  onDeactivate: () => {
  },
  onvote: (e) => {
    let user = e.target.closest('soci-post-li').querySelector('soci-user').getAttribute('name')
    let tagGroup = e.target.closest('soci-post-li').querySelector('soci-tag-group')
    if(tagGroup.hasAttribute('upvoted')){
      webcomics.users.add(user)
    }
    else {
      webcomics.users.delete(user)
    }

    webcomics.distributeFunds()
  },
  distributeFunds: ()=>{
    let outputs = webcomics.dom.querySelectorAll('.user')
    outputs.forEach(output => {
      if(webcomics.users.has(output.id.replace('#', ''))){
        output.toggleAttribute('payout', true)
        output.querySelector('.amount').innerHTML = `$${9 / webcomics.users.size}`
      }
      else {
        output.toggleAttribute('payout', false)
        output.querySelector('.amount').innerHTML = `$0`
      }
    })
    /*
    let amount = webcomics.dom.querySelector(`#${user} .amount`)
    amount.innerHTML = `$${9 / webcomics.users.size}`
    */
  }
}

document.addEventListener('DOMContentLoaded', webcomics.init)