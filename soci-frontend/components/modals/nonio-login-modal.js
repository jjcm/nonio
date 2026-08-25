class NonioLoginModal extends HTMLElement {
  connectedCallback(){
    if(this._bound) return
    this._bound = true
    this.innerHTML = `
      <form class="modal-form">
        <input type="email" name="email" placeholder="Email address" autocomplete="email">
        <nonio-password name="password"></nonio-password>
        <nonio-button async id="login-btn">login</nonio-button>
      </form>
      <div class="modal-footer">
        <nonio-link id="create-account" href="#">create account</nonio-link>
        <nonio-link id="im-stupid" href="/admin/forgot-password" class="secondary">forgot password</nonio-link>
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
      window.nonioModals?.close('login')
      window.nonioModals?.open('createAccount')
    })

    this.addEventListener('keydown', (e) => {
      if(e.key === 'Enter') submit(e)
    })

    setTimeout(() => this.querySelector('input[type="email"]')?.focus?.(), 0)
  }

  async _login(){
    const form = this.querySelector('form')
    const btn = this.querySelector('#login-btn')

    this.querySelector('nonio-password')?.checkValidity?.()
    const loginData = window.nonio.getJSONFromForm(form)
    if(!form.reportValidity()) return btn?.error?.()

    const response = await window.api.user.login(loginData)
    if(!response?.accessToken) return btn?.error?.()
    btn?.success?.()
    window.dispatchEvent(new CustomEvent('auth-login', { detail: response }))
    setTimeout(() => {
      window.nonioModals?.close('login')
    }, 500)
  }
}

export default NonioLoginModal
