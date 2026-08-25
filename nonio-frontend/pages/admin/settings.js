let adminSettings = {
  dom: document.currentScript.closest('nonio-route'),
  init: () => {
    nonio.registerPage(adminSettings)
  },
  onActivate: () => {
    document.title = 'Nonio - Settings'

    adminSettings.dom.querySelector('.description nonio-button').addEventListener('click', adminSettings.changeDescription)
    adminSettings.dom.querySelector('.password nonio-button').addEventListener('click', adminSettings.changePassword)
    adminSettings.setDescription()
  },
  onDeactivate: () => {
  },
  changePassword: async e => {
    let button = e.currentTarget
    let form = button.closest('form')
    if(form.reportValidity()){
      let data = nonio.getJSONFromForm(button.closest('form'))
      let response = await window.api.user.changePassword(data)
      button.wait()
      if(response == true) {
        button.success()
        adminSettings.cancelChangePassword()
      }
      else {
        button.error()
      }
    }
    else {
      button.error()
    }
  },
  cancelChangePassword: () => {
    Array.from(document.querySelectorAll('#admin-settings nonio-password')).forEach(pass => pass.value = '')
  },
  setDescription: async () => {
    let response = await nonio.getData(`users/${nonio.username}`)
    let description = adminSettings.dom.querySelector('.description nonio-input')
    description.value = response.description
  },
  changeDescription: async e => {
    let button = e.currentTarget
    let description = adminSettings.dom.querySelector('.description nonio-input')?.value
    let response = await window.api.user.updateDescription(description)
    button.wait()
    if(!response.error) {
      button.success()
    }
    else {
      button.error()
    }
  },
}

document.addEventListener('DOMContentLoaded', adminSettings.init)