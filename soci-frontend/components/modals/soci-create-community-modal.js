class SociCreateCommunityModal extends HTMLElement {
  connectedCallback(){
    if(this._bound) return
    this._bound = true
    this.innerHTML = `
      <form id="create-community-form" class="modal-form">
        <input name="name" placeholder="Name" required>
        <input name="url" placeholder="URL (no @)" required>
        <textarea name="description" placeholder="Description"></textarea>
        <select name="privacy">
          <option value="public">Public</option>
          <option value="invite-only">Invite only</option>
        </select>
        <div class="error" hidden></div>
        <soci-button async id="submit-create-community">Create</soci-button>
      </form>
    `

    const submit = (e) => {
      e?.preventDefault?.()
      this._submit()
    }
    this.querySelector('#submit-create-community')?.addEventListener('click', submit)
    this.querySelector('#create-community-form')?.addEventListener('submit', submit)
    this.addEventListener('keydown', (e) => {
      if(e.key === 'Enter') submit(e)
    })
    setTimeout(() => this.querySelector('input[name="name"]')?.focus?.(), 0)
  }

  _toggleError(message) {
    const error = this.querySelector('.error')
    if(!error) return
    if(message) {
      error.hidden = false
      error.textContent = message
    } else {
      error.hidden = true
      error.textContent = ''
    }
  }

  async _submit(){
    const sidebar = document.querySelector('soci-sidebar')
    if(!sidebar) return
    if(!sidebar.authToken) return window.soci?.requireLogin?.('create a community')

    const form = this.querySelector('#create-community-form')
    const btn = this.querySelector('#submit-create-community')
    btn?.wait?.()
    this._toggleError()

    const payload = {
      name: form.name.value.trim(),
      url: form.url.value.trim().replace(/^@/, '').toLowerCase(),
      description: form.description.value.trim(),
      privacyType: form.privacy.value
    }

    try {
      const result = await window.api.community.create(payload)
      if(result?.error) {
        this._toggleError(result.error)
        return btn?.error?.()
      }
      btn?.success?.()
      window.dispatchEvent(new CustomEvent('community-created', { detail: result }))
      window.sociModals?.close('createCommunity')
      if(result?.url) {
        window.history.pushState(null, null, `/@${result.url}`)
        window.dispatchEvent(new CustomEvent('link'))
      }
    } catch {
      this._toggleError('Unable to create community')
      btn?.error?.()
    }
  }
}

export default SociCreateCommunityModal
