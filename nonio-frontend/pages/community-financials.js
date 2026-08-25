let communityFinancials = {
  dom: document.currentScript.closest('nonio-route'),
  init: () => {
    nonio.registerPage(communityFinancials)
  },
  onActivate: () => {
    let path = document.location.pathname
    let match = path.match(/^\/@([\w-]+)\/admin\/financials/)
    if(!match) return
    let communityName = match[1]
    communityFinancials.communityName = communityName
    document.title = `${communityName} - Financials`
    
    // update nav links
    communityFinancials.dom.querySelectorAll('header nonio-link').forEach(link => {
      let href = link.getAttribute('href')
      link.setAttribute('href', href.replace(/@[\w-]+/, `@${communityName}`))
    })
    
    communityFinancials.loadFinancials()
  },
  loadFinancials: async () => {
    console.log('loading financials for community:', communityFinancials.communityName)
    let res = await nonio.getData(`/community/financials?community=${communityFinancials.communityName}`)
    if(res.error) {
      console.error(res.error)
      return
    }

    let format = (amt) => `$${amt.toFixed(2)}`

    let totalEl = communityFinancials.dom.querySelector('.js-total-earned')
    if(totalEl) totalEl.textContent = format(res.totalEarnedThisMonth || 0)

    let adminEl = communityFinancials.dom.querySelector('.js-admin-payout')
    if(adminEl) {
      let adminAmount = res.adminPayoutPerAdmin || 0
      adminEl.textContent = format(adminAmount)
    }

    let tbody = communityFinancials.dom.querySelector('tbody')
    if(!tbody) return
    tbody.innerHTML = ''
    if(res.financials && res.financials.length > 0) {
      res.financials.forEach(f => {
        let tr = document.createElement('tr')
        tr.innerHTML = `
          <td>${f.username}</td>
          <td>${format(f.amount)}</td>
        `
        tbody.appendChild(tr)
      })
    } else {
      tbody.innerHTML = '<tr><td colspan="2">No earnings recorded for this period.</td></tr>'
    }
  }
}

communityFinancials.init()

