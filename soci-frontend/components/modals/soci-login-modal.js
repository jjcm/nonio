class SociLoginModal extends HTMLElement {
  connectedCallback(){
    if(this._bound) return
    this._bound = true
    this.innerHTML = `
      <form class="modal-form">
        <input type="email" name="email" placeholder="Email address" autocomplete="email">
        <soci-password name="password"></soci-password>
        <soci-button async id="login-btn">login</soci-button>
      </form>
      <div class="modal-footer">
        <soci-link id="create-account" href="#">create account</soci-link>
        <soci-link id="im-stupid" href="/admin/forgot-password" class="secondary">forgot password</soci-link>
      </div>
    `

    const form = this.querySelector('form')
    const btn = this.querySelector('#login-btn')

    const submit = (e) => {
      e?.preventDefault?.()
      btn?.wait?.()
      this._login()
    }

    form?.addEventListener('submit', submit)
    btn?.addEventListener('click', submit)
    this.querySelector('#create-account')?.addEventListener('click', (e) => {
      e.preventDefault()
      window.sociModals?.close('login')
      window.sociModals?.open('createAccount')
    })

    this.addEventListener('keydown', (e) => {
      if(e.key === 'Enter') submit(e)
    })

    setTimeout(() => this.querySelector('input[type="email"]')?.focus?.(), 0)
  }

  async _login(){
    const form = this.querySelector('form')
    const btn = this.querySelector('#login-btn')

    this.querySelector('soci-password')?.checkValidity?.()
    const loginData = window.soci.getJSONFromForm(form)
    if(!form.reportValidity()) return btn?.error?.()

    const response = await window.api.user.login(loginData)
    if(!response?.accessToken) return btn?.error?.()
    btn?.success?.()
    window.dispatchEvent(new CustomEvent('auth-login', { detail: response }))
    setTimeout(() => {
      window.sociModals?.close('login')
    }, 500)
  }
}

export default SociLoginModal
