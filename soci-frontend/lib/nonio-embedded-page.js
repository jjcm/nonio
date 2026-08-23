/* 
Heya! You're probabaly wondering why this is in your page. 
We need this script to make sure the iframe we embed your 
page in is sized correctly in the parent page. 

In order to do this, we do need to change the body styles
and report the height back to the parent page. This script
is documented so you can see what it does if you're concerned.
*/ 

// This is the resize observer that will watch the body height
let nonioResizeObserver = new ResizeObserver(entries => {
  for (const entry of entries) {
    if(entry.contentBoxSize) {
      let height = entry.contentBoxSize[0].blockSize
      nonioFrame.reportHeight(height)
    }
  }
})

let nonioFrame = {
  // This is our initial setup function that runs once your page loads
  init: () => {
    /* 
    We need the body to be set to a display mode that automatically vertically resizes. 
    These are mostly inline-* styles and table styles. 
    This script will try to automagically change to the correct one to use, 
    but there are a few that don't work. The following styles are not supported on the body:
    * list-item
    * flow
    * flow-root
    * contents

    Use a child element if you need these display modes. 
    */ 

    let bodyStyle = getComputedStyle(document.body)?.display
    switch(bodyStyle) {
      case 'block':
      case 'flex':
      case 'grid':
        // for these, we append inline
        bodyStyle = 'inline-' + bodyStyle
        break
      case 'table':
      case 'table-row':
      case 'inline-block':
      case 'inline-flex':
      case 'inline-grid':
        // these are all good
        break
      default:
        // for anything else, reset to inline-block
        bodyStyle = 'inline-block'
        break
    }
    let styleString = `overflow: hidden !important; margin: 0 !important; display: ${bodyStyle} !important;`
    document.body.style = styleString
    nonioFrame.reportHeight()
    nonioResizeObserver.observe(document.body)
  },

  /* 
  This passes height back to the parent page. Please don't push 
  random heights with this event unless you have a good reason. 
  
  Don't make bad experiences for users.
  */
  reportHeight: (height) => {
    if(!height) height = document.body.offsetHeight
    var data = { height: height }
    //var event = new CustomEvent('iframeSizeEvent', { detail: data })
    //window.parent.document.dispatchEvent(event)
  }
}

window.addEventListener('message', (event) => {
  if(event.ports){
    console.log('things from the frame!!!')
    console.log(event.data)
    console.log(event.ports[0])
    console.log(event.origin)
    event.ports[0].postMessage('message from the iframe')
  }
})

document.addEventListener('DOMContentLoaded', nonioFrame.init)