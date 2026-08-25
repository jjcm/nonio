const modalRegistry = {
  login: {
    id: 'login-modal',
    title: 'Login',
    tag: 'nonio-login-modal'
  },
  createAccount: {
    id: 'create-account-modal',
    title: 'Create account',
    tag: 'nonio-create-account-modal'
  },
  createCommunity: {
    id: 'create-community-modal',
    title: 'Create community',
    tag: 'nonio-create-community-modal'
  },
  createChannel: {
    id: 'create-channel-modal',
    title: 'Create channel',
    tag: 'nonio-create-channel-modal'
  },
  imageViewer: {
    id: 'image-viewer-modal',
    title: 'Image viewer',
    tag: 'nonio-image-viewer-modal'
  }
}

const mountedModals = new Map()

const createModal = async (name) => {
  const config = modalRegistry[name]
  if(!config) return null
  if(config.load) await config.load()

  const modal = document.createElement('nonio-modal')
  modal.id = config.id
  modal.setAttribute('title', config.title)
  modal.setAttribute('data-modal', name)

  const content = document.createElement(config.tag)
  modal.appendChild(content)
  document.body.appendChild(modal)

  modal.addEventListener('modaldeactivate', () => {
    mountedModals.delete(name)
    modal.remove()
  }, { once: true })

  mountedModals.set(name, modal)
  return modal
}

const ensureModal = async (name) => {
  const cached = mountedModals.get(name)
  if(cached?.isConnected) return cached
  return createModal(name)
}

const modalManager = {
  register(name, config) {
    modalRegistry[name] = config
  },
  async open(name){
    const modal = await ensureModal(name)
    if(!modal) return null
    modal.activate?.()
    return modal
  },
  close(name){
    const modal = mountedModals.get(name)
    modal?.deactivate?.()
  },
  closeAll(){
    Array.from(mountedModals.values()).forEach(modal => modal?.deactivate?.())
  }
}

window.nonioModals = modalManager

export default modalManager
