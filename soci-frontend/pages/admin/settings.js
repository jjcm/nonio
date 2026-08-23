let adminSettings = {
  dom: document.currentScript.closest('soci-route'),
  init: () => {
    soci.registerPage(adminSettings)
  },
  onActivate: () => {
    document.title = 'Nonio - Settings'

    adminSettings.dom.querySelector('.description soci-button').addEventListener('click', adminSettings.changeDescription)
    adminSettings.dom.querySelector('.password soci-button').addEventListener('click', adminSettings.changePassword)
    adminSettings.setDescription()
  },
  onDeactivate: () => {
  },
  changePassword: async e => {
    let button = e.currentTarget
    let form = button.closest('form')
    if(form.reportValidity()){
      let data = soci.getJSONFromForm(button.closest('form'))
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
    Array.from(document.querySelectorAll('#admin-settings soci-password')).forEach(pass => pass.value = '')
  },
  setDescription: async () => {
    let response = await soci.getData(`users/${soci.username}`)
    let description = adminSettings.dom.querySelector('.description soci-input')
    description.value = response.description
  },
  changeDescription: async e => {
    let button = e.currentTarget
    let description = adminSettings.dom.querySelector('.description soci-input')?.value
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