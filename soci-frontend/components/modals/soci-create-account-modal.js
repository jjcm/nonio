class SociCreateAccountModal extends HTMLElement {
  connectedCallback(){
    if(this._bound) return
    this._bound = true
    this.innerHTML = `
      <form class="modal-form">
        <soci-username-input name="username" tabindex="1"></soci-username-input>
        <input type="email" name="email" placeholder="Email address" autocomplete="email">
        <soci-password tabindex="0" name="password"></soci-password>
        <soci-password tabindex="0" name="confirmPassword" placeholder="Confirm Password" match="password"></soci-password>
        <soci-button async id="register-btn">Create Account</soci-button>
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
    const formData = window.soci.getJSONFromForm(form)
    const response = await window.api.user.register(formData)
    if(!response?.accessToken) return btn?.error?.()
    btn?.success?.()
    window.dispatchEvent(new CustomEvent('auth-signup', { detail: response }))
    setTimeout(() => {
      window.sociModals?.close('createAccount')
    }, 500)
  }
}

export default SociCreateAccountModal
