let communityEmojis = {
  dom: document.currentScript.closest('nonio-route'),
  init: () => nonio.registerPage(communityEmojis),
  onActivate: () => {
    let communityName = (window.location.pathname.match(/^\/@([\w-]+)\/admin\/emojis$/) || [])[1] || ''
    communityEmojis.community = communityName
    
    // update nav links
    communityEmojis.dom.querySelectorAll('header nonio-link').forEach(link => {
      let href = link.getAttribute('href')
      link.setAttribute('href', href.replace(/@[\w-]+/, `@${communityName}`))
    })
    
    const form = communityEmojis.dom.querySelector('#emoji-form')
    const btn = communityEmojis.dom.querySelector('#emoji-upload')
    if (!communityEmojis._boundUpload) {
      communityEmojis._boundUpload = (e) => communityEmojis.upload(e)
    }
    form?.removeEventListener('submit', communityEmojis._boundUpload)
    btn?.removeEventListener('click', communityEmojis._boundUpload)
    form?.addEventListener('submit', communityEmojis._boundUpload)
    btn?.addEventListener('click', communityEmojis._boundUpload)
    communityEmojis.load()
  },
  load: async () => {
    const grid = communityEmojis.dom.querySelector('#emoji-grid')
    if (!grid || !communityEmojis.community) return
    const res = await window.api.emoji.communityList(communityEmojis.community).catch(() => null)
    const emojis = res?.emojis || []
    grid.innerHTML = emojis.map(e => `
      <div class="emoji-card">
        <nonio-emoji name="${e.name}" data-emoji-id="${e.id}" style="height:24px;"></nonio-emoji>
        <div class="emoji-name">:${e.name}:</div>
      </div>
    `).join('')
  },
  upload: async (e) => {
    e?.preventDefault?.()
    const name = (communityEmojis.dom.querySelector('#emoji-name')?.value || '').trim().toLowerCase()
    const file = communityEmojis.dom.querySelector('#emoji-file')?.files?.[0]
    const btn = communityEmojis.dom.querySelector('#emoji-upload')
    if (!name || !file || !communityEmojis.community) return
    btn?.wait?.()
    const fd = new FormData()
    fd.append('files', file)
    fd.append('type', 'emoji')
    fd.append('name', name)
    fd.append('community', communityEmojis.community)
    const uploadRes = await fetch(window.config.AVATAR_HOST + '/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + nonio.accessToken },
      body: fd
    }).catch(() => null)
    if (!uploadRes?.ok) { btn?.error?.(); return }
    const raw = (await uploadRes.text()).trim()
    const animated = raw.endsWith('.animated')
    const key = raw.replace(/\.animated$/, '')
    const create = await window.api.emoji.createCommunity({
      community: communityEmojis.community,
      name,
      key,
      animated
    }).catch(() => null)
    if (create?.id) {
      btn?.success?.()
      communityEmojis.dom.querySelector('#emoji-file').value = ''
      communityEmojis.load()
      return
    }
    btn?.error?.()
  }
}

communityEmojis.init()
