let adminChangeForgottenPassword = {
  dom: document.currentScript.closest('soci-route'),
  init: () => {
    soci.registerPage(adminChangeForgottenPassword)
  },
  onActivate: () => {
    document.title = 'Forgot password?'
    adminChangeForgottenPassword.submitButton = adminChangeForgottenPassword.dom.querySelector('soci-button')
    adminChangeForgottenPassword.submitButton.addEventListener('click', adminChangeForgottenPassword.submitRequest)
  },
  onDeactivate: () => {
  },
  submitRequest: async e => {
    let params = new URLSearchParams(window.location.search)
    let token = params.get('token')

    let button = e.currentTarget
    let form = button.closest('form')
    if(form.reportValidity()){
      let data = soci.getJSONFromForm(button.closest('form'))
      data.token = token
      let response = await window.api.user.changeForgottenPassword(data)
      if(response == true) {
        button.success()
        setTimeout(()=>{
          adminChangeForgottenPassword.dom.toggleAttribute('success', true)
        }, 750)
      }
      else {
        button.error()
      }
    }
    else {
      button.error()
    }
  },
}

adminChangeForgottenPassword.init()
