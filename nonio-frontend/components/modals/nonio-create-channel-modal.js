class NonioCreateChannelModal extends HTMLElement {
  connectedCallback(){
    if(this._bound) return
    this._bound = true
    this.innerHTML = `
      <form id="create-channel-form" class="modal-form">
        <input name="name" placeholder="Name" required>
        <input name="slug" placeholder="Slug (optional)">
        <nonio-radio-button-group name="kind" value="text">
          <nonio-radio-button value="text">Text</nonio-radio-button>
          <nonio-radio-button value="voice">Voice</nonio-radio-button>
        </nonio-radio-button-group>
        <div class="error" hidden></div>
        <nonio-button async id="submit-create-channel">Create</nonio-button>
      </form>
    `

    const submit = (e) => {
      e?.preventDefault?.()
      this._submit()
    }
    this.querySelector('#submit-create-channel')?.addEventListener('click', submit)
    this.querySelector('#create-channel-form')?.addEventListener('submit', submit)
    this.addEventListener('keydown', (e) => {
      if(e.key === 'Enter') submit(e)
    })
    this.closest('nonio-modal')?.addEventListener('modalactivate', () => {
      const form = this.querySelector('#create-channel-form')
      if(form) {
        form.reset()
        form.querySelector('nonio-radio-button-group[name="kind"]')?.setAttribute('value', 'text')
      }
      this._toggleError()
      setTimeout(() => this.querySelector('input[name="name"]')?.focus?.(), 0)
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
    const community = window.nonio?.routeContext?.community
    if(!community) return
    const form = this.querySelector('#create-channel-form')
    const btn = this.querySelector('#submit-create-channel')
    const name = form.name?.value?.trim()
    const slug = (form.slug?.value?.trim() || name || '').toLowerCase().replace(/\s+/g, '-')
    const kind = form.querySelector('nonio-radio-button-group[name="kind"]')?.getAttribute('value') || 'text'
    if(!name) {
      this._toggleError('Name is required')
      return
    }
    btn?.wait?.()
    this._toggleError()
    try {
      const res = await window.api.channels.create({ community, kind, slug: slug || name, name })
      if(res?.error) {
        this._toggleError(res.error)
        return btn?.error?.()
      }
      btn?.success?.()
      window.dispatchEvent(new CustomEvent('channel-created', { detail: res }))
      window.nonioModals?.close('createChannel')
    } catch {
      this._toggleError('Failed to create channel')
      btn?.error?.()
    }
  }
}

export default NonioCreateChannelModal
