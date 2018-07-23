var login = {
  init: function(){
    bind('#h-register', 'click', login.register)
    contributeSlider.init()
  },
  stepHeadings: [
    'register for soci',
    'contribute',
    'submit payment'
  ],
  register: function(){
    document.getElementById('login').classList.add('register')
  },
  login: function(){
    document.getElementById('login').classList.remove('register')
  },
  goToStep: function(n){
    var steps = util.getDomArray('#steps .step').map(function(step, index, array){
      if(index <= n - 1) step.classList.add('active')
      else step.classList.remove('active')
    })
    document.querySelector('#register-form h2').innerHTML = login.stepHeadings[n - 1]
    document.getElementById('login').className = 'register'
    document.getElementById('login').classList.add('step' + n)
  },
  submitForm: function(){
    var values = login.getFormValues()
    if(!login.formValid(values)) return 0

    var xhr = new XMLHttpRequest()
    xhr.open('POST', "http://syd.jjcm.org:8902/users/register")
    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.onreadystatechange = login.ajaxResponse
    xhr.send(JSON.stringify(values))
  },
  ajaxResponse: function(){
    if(this.readyState == 4){
      if(this.status == 406){
        login.failedHandler(this.responseText)
      }
      if(this.status == 200){
        //we gucci, submission went through
      }
    }
  },
  formValid: function(values){
    return true
  },
  failedHandler: function(err){
    util.getDomArray('.field-container.error').map(function(dom){
      dom.classList.remove('error')
    })
    var err = JSON.parse(err)
    var fieldErrors = Object.keys(err)

    document.getElementById('login').classList.remove('step3', 'step2')
    
    var errorMessage = '<span>Error: </span>'
    fieldErrors.map(function(key, i){
      var dom = document.getElementById('r-' + key)
      dom.classList.add('error')

      if(i != 0) errorMessage += ', '
      errorMessage += err[key]
    })

    document.querySelector('#step1 p').innerHTML = errorMessage
  },
  error: function(dom, err){
    
  },
  getFormValues: function(){
    var form = document.querySelector('#register-form form')
    var values = {
      username: form.elements.username.value,
      email: form.elements.email.value,
      password: form.elements.password.value,
      passwordConfirmation: form.elements.passwordConfirmation.value,
      contribution: form.elements.contribution.value
    }

    console.log(values)
    return values
  }
}

var contributeSlider = {
  init: function(){
    bind(contributeSlider.dom, 'mousedown', contributeSlider.mouseDown)
    contributeSlider.x = contributeSlider.dom.offsetLeft
    contributeSlider.min = (contributeSlider.dom.parentElement.offsetWidth / 5) - (contributeSlider.dom.offsetWidth / 2) //20% of the width of the parent minus half the width of the handle
    contributeSlider.max = contributeSlider.dom.parentElement.offsetWidth - (contributeSlider.dom.offsetWidth / 2)
  },
  dom: document.getElementById('contribute-slider-handle'),
  contributionAmountDom: document.querySelector('#contribution-amount .amount'),
  totalAmountDom: document.querySelector('#total-amount .amount'),
  min: 0,
  max: 0,
  x: 0,
  xDown: 0,
  mouseDown: function(e){
    contributeSlider.xDown = e.clientX
    document.addEventListener('mouseup', contributeSlider.mouseUp)
    document.addEventListener('mousemove', contributeSlider.mouseMove)
    document.body.classList.add('no-select')
  },
  mouseUp: function(e){
    document.removeEventListener('mouseup', contributeSlider.mouseUp)
    document.removeEventListener('mousemove', contributeSlider.mouseMove)
    document.body.classList.remove('no-select')

    var delta = e.clientX - contributeSlider.xDown
    var x = contributeSlider.x + delta
    if(x < contributeSlider.min) x = contributeSlider.min
    if(x > contributeSlider.max) x = contributeSlider.max

    contributeSlider.x = x
  },
  mouseMove: function(e){
    var delta = e.clientX - contributeSlider.xDown
    var x = contributeSlider.x + delta
    if(x < contributeSlider.min) x = contributeSlider.min
    if(x > contributeSlider.max) x = contributeSlider.max

    var contribution = Math.round(10 * x / contributeSlider.dom.parentElement.offsetWidth) - 1
    contributeSlider.contributionAmountDom.innerHTML = '$' + contribution

    contributeSlider.totalAmountDom.innerHTML = '$' + (contribution + 1)
    
    var subtitleDom = document.querySelector('#total-amount .subtitle')
    switch(contribution){
      case 1:
        subtitleDom.innerHTML = "I'm a starving artist"
        break
      case 2:
        subtitleDom.innerHTML = "I'm a regular Joe"
        break
      case 3:
        subtitleDom.innerHTML = "I'm a regular Joe"
        break
      case 4:
        subtitleDom.innerHTML = "I'm a regular Joe"
        break
      case 5:
        subtitleDom.innerHTML = "I support the arts!"
        break
      case 6:
        subtitleDom.innerHTML = "I support the arts!"
        break
      case 7:
        subtitleDom.innerHTML = "I'm a philanthropist!!"
        break
      case 8:
        subtitleDom.innerHTML = "I'm a philanthropist!!"
        break
      case 9:
        subtitleDom.innerHTML = "<3 <3 <3 <3 <3 <3"
        break
    }



    contributeSlider.dom.style.left = x
  }
}
document.addEventListener('DOMContentLoaded', login.init)
