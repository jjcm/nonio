let textChannel = {
  dom: document.currentScript.closest('nonio-route'),
  init: () => {
    nonio.registerPage(textChannel)
  },
  onActivate: () => {
    textChannel.dom.innerHTML = ''
    const path = window.location.pathname || ''
    const match = path.match(/^\/@([\w-]+):([^/]+)$/)
    if (!match) return

    const community = match[1]
    const channel = decodeURIComponent(match[2] || '')
    if (!community || !channel) return

    const view = document.createElement('nonio-text-channel-view')
    view.setAttribute('community', community)
    view.setAttribute('channel', channel)
    textChannel.dom.appendChild(view)
  }
}

textChannel.init()
