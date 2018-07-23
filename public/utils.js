var bind = function(dom, event, action){
  var opts = {
    event: event,
    action: action
  }
  if(Object.prototype.toString.call(dom) == "[object Object]" && dom.dom && dom.event && dom.action) {
    return bind(
      dom.dom,
      dom.event,
      dom.action
    )
  }
  opts.dom = util.getDomArray(dom)
  console.log(opts.dom)
  if(opts.action == null) {
    console.error('bind requires an action to perform')
    return 0
  }
  if(opts.event == null) {
    console.error('bind requires an event to bind to')
    return 0
  }

  opts.dom.map(function(dom){
    dom.addEventListener(opts.event, opts.action)
  })
}

var unbind = function(dom, event, action){
  var opts = {
    event: event,
    action: action
  }
  if(Object.prototype.toString.call(dom) == "[object Object]" && dom.dom && dom.event && dom.action) {
    return unbind(
      dom.dom,
      dom.event,
      dom.action
    )
  }
  opts.dom = util.getDomArray(dom)
  console.log(opts.dom)
  if(opts.action == null) {
    console.error('unbind requires an action to remove')
    return 0
  }
  if(opts.event == null) {
    console.error('unbind requires an event to unbind from')
    return 0
  }

  opts.dom.map(function(dom){
    dom.removeEventListener(opts.event, opts.action)
  })
  
}

var util = {
  domInLineage: function(e, selector){
    if(
      (selector.className == undefined || e.classList.contains(selector.className)) && 
      (selector.id == undefined || e.id == selector.id)
    )
      return e
    if(e.parentElement)
      return util.domInLineage(e.parentElement, selector)
    return false
  },
  getDomArray: function(dom){
    switch(Object.prototype.toString.call(dom)){
      case "[object String]":
        return Array.prototype.slice.call(
          document.querySelectorAll(dom)
        )
        break
      case "[object HTMLCollection]":
        return Array.prototype.slice.call(dom)
        break
      default:
        if(dom instanceof HTMLElement){
          return [dom]
        }
        break
    }
  }
}
