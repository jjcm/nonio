let communityUsers = {
  dom: document.currentScript.closest('nonio-route'),
  state: {
    moderators: [],
    members: [],
    banned: []
  },
  init: () => {
    nonio.registerPage(communityUsers)
  },
  onActivate: () => {
    let path = document.location.pathname
    let match = path.match(/^\/@([\w-]+)\/admin\/users/)
    if(!match) return
    let communityName = match[1]
    communityUsers.communityName = communityName
    document.title = `${communityName} - Users`

    // update nav links
    communityUsers.dom.querySelectorAll('header nonio-link').forEach(link => {
      let href = link.getAttribute('href')
      link.setAttribute('href', href.replace(/@[\w-]+/, `@${communityName}`))
    })

    communityUsers.cacheDom()
    communityUsers.bindPickers()
    communityUsers.loadUsers()
  },
  cacheDom: () => {
    communityUsers.lists = {
      moderators: communityUsers.dom.querySelector('[data-list="moderators"]'),
      members: communityUsers.dom.querySelector('[data-list="members"]'),
      banned: communityUsers.dom.querySelector('[data-list="banned"]')
    }
    communityUsers.pickers = {
      moderators: communityUsers.dom.querySelector('nonio-user-picker[data-role="moderators"]'),
      members: communityUsers.dom.querySelector('nonio-user-picker[data-role="members"]'),
      banned: communityUsers.dom.querySelector('nonio-user-picker[data-role="banned"]')
    }
    communityUsers.headers = {
      moderators: communityUsers.dom.querySelector('.card-header[data-role="moderators"]'),
      members: communityUsers.dom.querySelector('.card-header[data-role="members"]'),
      banned: communityUsers.dom.querySelector('.card-header[data-role="banned"]')
    }
  },
  bindPickers: () => {
    if(!communityUsers.pickers) return
    Object.entries(communityUsers.pickers).forEach(([type, picker]) => {
      if(!picker) return
      if(picker._communityUsersBound) return
      picker.addEventListener('userselected', e => communityUsers.addUser(type, e.detail.username))
      picker._communityUsersBound = true
    })
    communityUsers.bindAddButtons()
  },
  bindAddButtons: () => {
    communityUsers.dom.querySelectorAll('.card-header nonio-button.add-btn').forEach(btn => {
      const type = btn.getAttribute('data-role')
      btn.addEventListener('click', () => communityUsers.openPicker(type))
    })
  },
  loadUsers: async () => {
    let res = await nonio.getData(`/community/users?community=${communityUsers.communityName}`)
    if(res.error) {
      console.error(res.error)
      return
    }
    communityUsers.state = {
      moderators: res.moderators || [],
      members: res.subscribers || [],
      banned: res.banned || []
    }
    communityUsers.renderAll()
  },
  renderAll: () => {
    communityUsers.renderList('moderators', communityUsers.state.moderators)
    communityUsers.renderList('members', communityUsers.state.members)
    communityUsers.renderList('banned', communityUsers.state.banned)
  },
  labels: {
    moderators: 'moderators',
    members: 'members',
    banned: 'banned users'
  },
  renderList: (type, users) => {
    let container = communityUsers.lists?.[type]
    if(!container) return
    container.innerHTML = ''
    if(!users || users.length === 0) {
      let empty = document.createElement('div')
      empty.className = 'empty'
      empty.textContent = `No ${communityUsers.labels[type]} yet.`
      container.appendChild(empty)
      return
    }
    users.forEach(u => {
      container.appendChild(communityUsers.buildRow(type, u.username || u))
    })
  },
  buildRow: (type, username) => {
    let row = document.createElement('div')
    row.className = 'user-row'

    let user = document.createElement('nonio-user')
    user.setAttribute('name', username)

    let actions = document.createElement('div')
    actions.className = 'actions'
    communityUsers.getActions(type, username).forEach(btn => actions.appendChild(btn))

    row.appendChild(user)
    row.appendChild(actions)
    return row
  },
  makeActionButton: (label, handler) => {
    let btn = document.createElement('nonio-button')
    btn.className = 'action'
    btn.textContent = label
    btn.setAttribute('subtle', '')
    btn.addEventListener('click', handler)
    return btn
  },
  getActions: (type, username) => {
    let actions = []
    if(type === 'moderators') {
      actions.push(communityUsers.makeActionButton('Remove', () => communityUsers.removeModerator(username)))
    }
    if(type === 'members') {
      actions.push(communityUsers.makeActionButton('Make Mod', () => communityUsers.addModerator(username)))
      actions.push(communityUsers.makeActionButton('Ban', () => communityUsers.banUser(username)))
      actions.push(communityUsers.makeActionButton('Remove', () => communityUsers.removeMember(username)))
    }
    if(type === 'banned') {
      actions.push(communityUsers.makeActionButton('Unban', () => communityUsers.unbanUser(username)))
      actions.push(communityUsers.makeActionButton('Add as Member', () => communityUsers.addMember(username)))
    }
    return actions
  },
  addUser: (type, username) => {
    if(!username) return
    const map = {
      moderators: communityUsers.addModerator,
      members: communityUsers.addMember,
      banned: communityUsers.banUser
    }
    const fn = map[type]
    if(!fn) return
    fn(username).then(()=> communityUsers.closePicker(type))
  },
  addModerator: async (username) => {
    await nonio.postData('/community/add-moderator', {
      community: communityUsers.communityName,
      username
    })
    communityUsers.loadUsers()
  },
  addMember: async (username) => {
    let isBanned = communityUsers.state.banned?.some(u => (u.username || u) === username)
    if(isBanned) {
      await nonio.postData('/community/unban', {
        community: communityUsers.communityName,
        username
      })
    }
    await nonio.postData('/community/add-member', {
      community: communityUsers.communityName,
      username
    })
    communityUsers.loadUsers()
  },
  removeMember: async (username) => {
    if(!confirm(`Remove ${username} from members?`)) return
    await nonio.postData('/community/remove-member', {
      community: communityUsers.communityName,
      username
    })
    communityUsers.loadUsers()
  },
  removeModerator: async (username) => {
    if(confirm(`Remove ${username} as moderator?`)) {
      await nonio.postData('/community/remove-moderator', {
        community: communityUsers.communityName,
        username
      })
      communityUsers.loadUsers()
    }
  },
  banUser: async (username) => {
    if(confirm(`Ban ${username}?`)) {
      await nonio.postData('/community/ban', {
        community: communityUsers.communityName,
        username
      })
      communityUsers.loadUsers()
    }
  },
  unbanUser: async (username) => {
    await nonio.postData('/community/unban', {
      community: communityUsers.communityName,
      username
    })
    communityUsers.loadUsers()
  },
  openPicker: (type) => {
    const header = communityUsers.headers?.[type]
    const picker = communityUsers.pickers?.[type]
    if(!header || !picker) return
    header.setAttribute('editing', '')
    communityUsers._focusPickerInput(picker)
  },
  closePicker: (type) => {
    const header = communityUsers.headers?.[type]
    if(header) header.removeAttribute('editing')
  },
  _focusPickerInput: (picker) => {
    const input = picker.shadowRoot?.querySelector('input')
    input?.focus()
  }
}

communityUsers.init()

