class NonioCreateAccountModal extends HTMLElement {
  connectedCallback(){
    if(this._bound) return
    this._bound = true
    this.innerHTML = `
      <form class="modal-form">
        <nonio-username-input name="username" tabindex="1"></nonio-username-input>
        <input type="email" name="email" placeholder="Email address" autocomplete="email">
        <nonio-password tabindex="0" name="password"></nonio-password>
        <nonio-password tabindex="0" name="confirmPassword" placeholder="Confirm Password" match="password"></nonio-password>
        <nonio-button async id="register-btn">Create Account</nonio-button>
      </form>
    `

    const form = this.querySelector('form')
    const btn = this.querySelector('#register-btn')
    const submit = (e) => {
      e?.preventDefault?.()
      btn?.wait?.()
      this._register()
    }
    form?.addEventListener('submit', submit)
    btn?.addEventListener('click', submit)
    this.addEventListener('keydown', (e) => {
      if(e.key === 'Enter') submit(e)
    })
  }

  async _register(){
    const form = this.querySelector('form')
    const btn = this.querySelector('#register-btn')
    if(!form.reportValidity()) return btn?.error?.()
    const formData = window.nonio.getJSONFromForm(form)
    const response = await window.api.user.register(formData)
    if(!response?.accessToken) return btn?.error?.()
    btn?.success?.()
    window.dispatchEvent(new CustomEvent('auth-signup', { detail: response }))
    setTimeout(() => {
      window.nonioModals?.close('createAccount')
    }, 500)
  }
}

export default NonioCreateAccountModal
