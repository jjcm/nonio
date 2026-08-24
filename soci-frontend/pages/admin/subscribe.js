let adminSubscribe = {
  dom: document.currentScript.closest('soci-route'),
  init: () => {
    soci.registerPage(adminSubscribe)
  },
  onActivate: () => {
    document.title = "Nonio - Choose Your Account Type"
    adminSubscribe.dom.querySelector('form').addEventListener('submit', e => {
      e.preventDefault()
    })
    adminSubscribe.loadStripe()
  },
  onDeactivate: () => {
  },
  loadStripe: async () => {
    adminSubscribe.stripe = await soci.stripe
    let elements = adminSubscribe.stripe.elements()
    let currentStyles = getComputedStyle(document.documentElement)
    adminSubscribe.card = elements.create('card', {
      style: {
        base: {
          iconColor: currentStyles.getPropertyValue('--text'),
          color: currentStyles.getPropertyValue('--text'),
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"',
          lineHeight: '38px',
          fontSize: '14px',
          ':-webkit-autofill': {
            color: currentStyles.getPropertyValue('--text-brand')
          },
          '::placeholder': {
            color: currentStyles.getPropertyValue('--text-secondary')
          }
        },
        invalid: {
          iconColor: currentStyles.getPropertyPriority('--text-danger'),
          color: currentStyles.getPropertyPriority('--text-danger')
        }
      }
    })
    adminSubscribe.card.on('change', adminSubscribe.cardError)
    adminSubscribe.card.mount('#admin-subscribe #card-element')

    //TODO https://stripe.com/docs/billing/subscriptions/fixed-price#create-subscription
  },
  cardError: event => {
    let displayError = document.getElementById('card-element-errors')
    if (event.error) {
      displayError.textContent = event.error.message
      console.log(event.error)
    } else {
      displayError.textContent = ''
    }
  },
  chooseFree: () => {
    window.api.user.chooseFreeAccount().then(result => {
      let button = adminSubscribe.dom.querySelector('soci-button.free-button')
      if(result === true){
        button?.success()
        setTimeout(()=>{
          window.history.pushState(null, null, '/#all')
          window.dispatchEvent(new CustomEvent('link'))
        }, 1000)
      }
      else {
        button?.error()
      }
    })
  },
  chooseSupporter: () => {
    window.api.stripe.createCustomer().then(result => {
      let button = adminSubscribe.dom.querySelector('soci-button.supporter-button')
      if(result === true) {
        button?.success()
        let column = adminSubscribe.dom.querySelector('.column.supporter')
        column.toggleAttribute('active', true)
        column.style.height = (column.offsetHeight - 2) + 'px'
        setTimeout(()=>{
          column.style.height = column.querySelector('.title').offsetHeight + column.querySelector('.payment').offsetHeight
        }, 1)
      }
      else {
        button?.error()
      }
    })
  },
  subscribe: () => {
    let billingName = adminSubscribe.dom.querySelector('form input[name="name"]').value
    let price = adminSubscribe.dom.querySelector('form soci-contribution-slider').value
    adminSubscribe.stripe.createPaymentMethod({
      type: 'card',
      card: adminSubscribe.card,
      billing_details: {
        name: billingName,
      },
    })
    .then(result => {
      if(result.error){
        adminSubscribe.cardError(result)
      }
      else {
        adminSubscribe.createSubscription({
          paymentMethodId: result.paymentMethod.id,
          price: price
        })
      }
    })
  },
  createSubscription: ({paymentMethodId, price}) => {
    console.log(paymentMethodId)
    let button = adminSubscribe.dom.querySelector('.subscribe-button')
    return (
      window.api.stripe.createSubscription({
        paymentMethodId: paymentMethodId,
        price: price,
      })
      // If the card is declined, display an error to the user.
      .then((result) => {
        if (result.error) {
          // The card had an error when trying to attach it to a customer.
          throw result
        }
        return result
      })
      // Normalize the result to contain the object returned by Stripe.
      // Add the additional details we need.
      .then((result) => {
        return {
          paymentMethodId: paymentMethodId,
          price: price,
          subscription: result,
        };
      })
      // Some payment methods require a customer to be on session
      // to complete the payment process. Check the status of the
      // payment intent to handle these actions.
      //.then(handlePaymentThatRequiresCustomerAction)
      // If attaching this card to a Customer object succeeds,
      // but attempts to charge the customer fail, you
      // get a requires_payment_method error.
      //.then(handleRequiresPaymentMethod)
      // No more actions required. Provision your service for the user.
      .then((result) => {
        console.log(result)
        button.success()
        setTimeout(()=>{
          window.history.pushState(null, null, '/#all')
          window.dispatchEvent(new CustomEvent('link'))
        }, 1000)
      })
      .catch((error) => {
        // An error has happened. Display the failure to the user here.
        // We utilize the HTML element we created.
        console.log(error)
        button.error()
        //showCardError(error)
      })
    )
  }
}

document.addEventListener('DOMContentLoaded', adminSubscribe.init)