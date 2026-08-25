let adminForgotPassword = {
  dom: document.currentScript.closest('nonio-route'),
  init: () => {
    nonio.registerPage(adminForgotPassword)
  },
  onActivate: () => {
    document.title = 'Forgot password?'
    adminForgotPassword.submitButton = adminForgotPassword.dom.querySelector('nonio-button')
    adminForgotPassword.submitButton.addEventListener('click', adminForgotPassword.submitRequest)
  },
  onDeactivate: () => {
  },
  submitRequest: async e => {
    window.api.user.forgotPassword(
      adminForgotPassword.dom.querySelector('input')?.value
    ).then(res=>{
      console.log(res)
      adminForgotPassword.submitButton.success()
    })
  },
}

adminForgotPassword.init()
