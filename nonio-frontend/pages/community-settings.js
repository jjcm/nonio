let communitySettings = {
  dom: document.currentScript.closest('nonio-route'),
  _saveTimer: null,
  _saving: false,
  _loading: false,
  _debounceMs: 600,
  init: () => {
    nonio.registerPage(communitySettings)
  },
  onActivate: () => {
    let path = document.location.pathname
    let match = path.match(/^\/@([\w-]+)\/admin/)
    if(!match) return
    let communityName = match[1]
    communitySettings.communityName = communityName
    document.title = `${communityName} - Settings`
    
    // update nav links
    communitySettings.dom.querySelectorAll('header nonio-link').forEach(link => {
      let href = link.getAttribute('href')
      link.setAttribute('href', href.replace(/@[\w-]+/, `@${communityName}`))
    })
    
    // Set community on avatar and banner uploaders
    communitySettings.dom.querySelectorAll('nonio-avatar-uploader').forEach(el => el.setAttribute('community', communityName))
    communitySettings.dom.querySelectorAll('nonio-avatar-uploader-new').forEach(el => el.setAttribute('community', communityName))
    
    // Fetch settings
    communitySettings.loadSettings()

    // Bind events
    let saveButton = communitySettings.dom.querySelector('nonio-button')
    saveButton.addEventListener('click', communitySettings.saveSettings)
    communitySettings.bindAutoSave()
  },
  loadSettings: async () => {
    communitySettings._loading = true
    let res = await nonio.getData(`communities/${communitySettings.communityName}`)
    if(res.error) {
        console.error(res.error)
        return
    }
    let form = communitySettings.dom.querySelector('form')
    form.querySelector('input[name="name"]').value = res.name
    let descInput = form.querySelector('nonio-input[name="description"]')
    descInput.value = res.description || ''
    const setGroupValue = (name, value) => {
      const group = form.querySelector(`nonio-radio-button-group[name="${name}"]`)
      if(group && value) group.setAttribute('value', value)
    }
    setGroupValue('privacy', res.privacyType || 'public')
    setGroupValue('post_permission', res.postPermission || 'all')
    setGroupValue('comment_permission', res.commentPermission || 'all')
    communitySettings._loading = false
  },
  scheduleSave: () => {
    if (communitySettings._loading) return
    clearTimeout(communitySettings._saveTimer)
    communitySettings._saveTimer = setTimeout(()=>communitySettings.saveSettings(), communitySettings._debounceMs)
  },
  bindAutoSave: () => {
    let form = communitySettings.dom.querySelector('form')
    if(!form) return
    form.querySelectorAll('nonio-radio-button-group[name="privacy"], nonio-radio-button-group[name="post_permission"], nonio-radio-button-group[name="comment_permission"]').forEach(group => {
      group.addEventListener('change', communitySettings.scheduleSave)
    })
  },
  saveSettings: async (e) => {
    if(e) e.preventDefault()
    if(communitySettings._saving) return
    communitySettings._saving = true
    let form = communitySettings.dom.querySelector('form')
    let button = form.querySelector('nonio-button')
    if(e) button.wait()
    
    let data = {
        community: communitySettings.communityName,
        name: form.querySelector('input[name="name"]').value,
        description: form.querySelector('nonio-input[name="description"]').value,
        privacyType: form.querySelector('nonio-radio-button-group[name="privacy"]')?.getAttribute('value'),
        postPermission: form.querySelector('nonio-radio-button-group[name="post_permission"]')?.getAttribute('value'),
        commentPermission: form.querySelector('nonio-radio-button-group[name="comment_permission"]')?.getAttribute('value')
    }
    
    let res = await nonio.postData('community/update', data)
    if(res === true) {
        if(e) button.success()
        document.dispatchEvent(new CustomEvent('community-updated', {
          detail: {
            community: communitySettings.communityName,
            name: data.name,
            description: data.description
          }
        }))
    } else if(e) {
        button.error()
    }
    communitySettings._saving = false
  }
}

communitySettings.init()

