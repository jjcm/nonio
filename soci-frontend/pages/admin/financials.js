let adminFinancials = {
  dom: document.currentScript.closest('soci-route'),
  init: () => {
    soci.registerPage(adminFinancials)
  },
  onActivate: () => {
    document.title = "Nonio - Your Financials"
    adminFinancials.dom.querySelector('.header soci-button')?.wait()
    adminFinancials.checkFinancials()
  },
  onDeactivate: () => {
  },
  checkFinancials: async () => {
    let response = await soci.getData('user/get-financials')
    adminFinancials.dom.querySelector('#financial-wallet h1').innerHTML = adminFinancials.formatCash(response.cash || 0.00 )
    adminFinancials.dom.querySelectorAll('a').forEach(a => a.href = response.stripe_connect_link || "#")
    adminFinancials.dom.querySelector('.header soci-button')?.removeAttribute('state')

    //TODO - we should leverage the value from stripe's API here, rather than the subscription_amount value from our database
    let subAmount = response.stripe_subscription_id == '' ? 0 : Number.parseFloat(response.subscription_amount || 0)
    adminFinancials.dom.querySelector('#financial-subscription h1').innerHTML = `$${subAmount}<span>/mo</span>`

    adminFinancials.dom.querySelector('#financial-subscription .button-group').innerHTML = `
      ${response.stripe_subscription_id == "" ? 
        `<soci-link href="/admin/subscribe"><soci-button class="sub-button" success tabindex="0" role="button">Subscribe</soci-button></soci-link>`
        :
        `<soci-button class="cancel-sub-button" danger onclick="adminFinancials.cancelSubscription()" tabindex="0" role="button">Cancel Subscription</soci-button>`
      }
    `
  },
  formatCash: cash => {
    cash = Number.parseFloat(cash)
    let formatter = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'})
    return formatter.format(cash)
  },
  showChangeSubscription: async () => {
    let subscription = await soci.getData('stripe/subscription')
    console.log('subscription:')
    console.log(subscription)
  },
  cancelSubscription: async () => {
    let button = adminFinancials.dom.querySelector('#financial-subscription soci-button.cancel-sub-button')
    button?.wait()
    await window.api.stripe.deleteSubscription().then(response => {
      if(response.error) {
        console.error(response.error)
        button?.error()
      }
      else {
        button?.success()
        setTimeout(()=>{
          button.removeAttribute('danger')
          button.toggleAttribute('success', true)
          adminFinancials.dom.querySelector('#financial-subscription h1').innerHTML = '$0<span>/mo</span>'
          adminFinancials.checkFinancials()
        }, 1150)
      }
    })
  },
  openWithdrawalModal: () => {
    adminFinancials.dom.querySelector('soci-modal')?.activate()
  },
  requestManualWithdrawal: async () => {
    let button = adminFinancials.dom.querySelector('soci-modal soci-button')
    await window.api.user.requestWithdrawal({

    }).then(response => {
      if(response.error) {
        console.error(response.error)
        button?.error()
      }
      else {
        button?.success()
        setTimeout(()=>{
          adminFinancials.dom.querySelector('soci-modal')?.deactivate()
        }, 1000)
      }
    })
  }
}

document.addEventListener('DOMContentLoaded', adminFinancials.init)