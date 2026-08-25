import config from './config.js'

const api = {
  get accessToken() {
    return localStorage.getItem('accessToken')
  },

  headers() {
    const headers = {
      'Content-Type': 'application/json'
    }
    if(this.accessToken) {
      headers['Authorization'] = 'Bearer ' + this.accessToken
    }
    return headers
  },

  async postData(url, data = {}) {
    const response = await fetch(`${config.API_HOST}/${url}`, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'same-origin',
      headers: this.headers(),
      redirect: 'follow',
      referrer: 'no-referrer',
      body: JSON.stringify(data) 
    })
    return await response.json()
  },

  async getData(url) {
    const path = url.startsWith('/') ? url.slice(1) : url
    const response = await fetch(`${config.API_HOST}/${path}`, {
      headers: this.headers()
    })
    return await response.json()
  }
}

api.posts = {
  create: (data) => api.postData('post/create', data),
  delete: (url, community) => api.postData('post/delete', { url, community })
}

api.user = {
  login: (data) => api.postData('user/login', data),
  register: (data) => api.postData('user/register', data),
  refreshAccessToken: (token) => api.postData('user/refresh-access-token', { refreshToken: token }),
  changePassword: (data) => api.postData('user/change-password', data),
  updateDescription: (description) => api.postData('user/update-description', { description }),
  forgotPassword: (email) => api.postData('user/forgot-password-request', { email }),
  changeForgottenPassword: (data) => api.postData('user/change-forgotten-password', data),
  requestWithdrawal: (data) => api.postData('user/request-withdrawal', data),
  chooseFreeAccount: () => api.postData('user/choose-free-account'),
  nuke: (username) => api.postData('admin/nuke', { username })
}

api.community = {
  create: (data) => api.postData('community/create', data),
  subscribe: (community) => api.postData('community/subscribe', { community }),
  unsubscribe: (community) => api.postData('community/unsubscribe', { community }),
  addModerator: (data) => api.postData('community/add-moderator', data),
  removeModerator: (data) => api.postData('community/remove-moderator', data)
}

api.stripe = {
  createCustomer: () => api.postData('stripe/create-customer'),
  createSubscription: (data) => api.postData('stripe/subscription/create', data),
  deleteSubscription: () => api.postData('stripe/subscription/delete', {})
}

api.votes = {
  get: () => api.getData('votes')
}

api.voice = {
  join: (community, channel) => api.postData('voice/join', { community, channel }),
  presence: (community) => api.postData('voice/presence', { community }),
  presenceWsUrl: (community, token) => {
    const wsBase = config.API_HOST
      .replace(/^https:\/\//, 'wss://')
      .replace(/^http:\/\//, 'ws://')
      .replace(/\/$/, '')
    return `${wsBase}/voice/presence/ws?community=${encodeURIComponent(community)}&token=${encodeURIComponent(token)}`
  }
}

api.channels = {
  list: (community) => api.getData(`community/channels?community=${encodeURIComponent(community)}`),
  create: (data) => api.postData('community/channel/create', data)
}

api.channelMessages = {
  list: (community, channel, before, limit) => {
    let path = `community/channel/messages?community=${encodeURIComponent(community)}&channel=${encodeURIComponent(channel)}`
    if (before) path += `&before=${before}`
    if (limit) path += `&limit=${limit}`
    return api.getData(path)
  },
  wsUrl: (community, channel, token) => {
    const wsBase = config.API_HOST
      .replace(/^https:\/\//, 'wss://')
      .replace(/^http:\/\//, 'ws://')
      .replace(/\/$/, '')
    return `${wsBase}/community/channel/ws?community=${encodeURIComponent(community)}&channel=${encodeURIComponent(channel)}&token=${encodeURIComponent(token)}`
  },
  send: (data) => api.postData('community/channel/messages', data),
  thread: (community, channel, parentID) => {
    const path = `community/channel/thread?community=${encodeURIComponent(community)}&channel=${encodeURIComponent(channel)}&parentID=${encodeURIComponent(parentID)}`
    return api.getData(path)
  },
  sendThreadReply: (data) => api.postData('community/channel/thread', data),
  react: (messageID, emoji) => api.postData('community/channel/message/react', { messageID, emoji })
}

api.emoji = {
  communityList: (community) => api.getData(`community/emojis?community=${encodeURIComponent(community)}`),
  createCommunity: (data) => api.postData('community/emoji/create', data),
  createPersonal: (data) => api.postData('emoji/create', data),
  sets: (community) => api.getData(`emojis/sets${community ? `?community=${encodeURIComponent(community)}` : ''}`),
  subscribe: (emojiID, emojiName) => api.postData('emoji/subscribe', { emojiID, emojiName }),
  get: (id) => api.getData(`emoji?id=${encodeURIComponent(id)}`),
  getMany: (ids) => api.getData(`emoji?ids=${encodeURIComponent(ids.join(','))}`)
}

window.api = api
export default api
