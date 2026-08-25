import NonioComponent from './nonio-component.js'

export default class NonioLedger extends NonioComponent {
  constructor() {
    super()
  }

  css(){
    return `
      :host {
        display: block;
        width: 100%;
        padding: 2px 0 28px;
        box-sizing: border-box;
        opacity: 1;
        transform: translateY(12px);
      }
      :host([loaded]) {
        transform: translateY(0);
        opacity: 1;
        transition: transform 0.35s cubic-bezier(0.15, 0, 0.2, 1), opacity 0.35s var(--nonio-ease);
        #line {
          opacity: 1;
          fill-opacity: 0.1;
          stroke-dasharray: 4000;
          stroke-dashoffset: 4000;
          animation: line-in 2.25s var(--nonio-ease) forwards;
          stroke: var(--text-success);
          fill: var(--text-brand);
        }
      }
      svg {
        height: 200px;
        width: 100%;
        margin-bottom: 16px;
        border-radius: 4px;
        overflow: hidden;
        border: 1px solid var(--bg-secondary);
      }
      #line {
        opacity: 0;
        fill-opacity: 0;
        transition: opacity 1.2s var(--nonio-ease), fill-opacity 0.4s var(--nonio-ease) 1.0s;
      }
      @keyframes line-in {
        from { stroke-dasharray: 4000; stroke-dashoffset: 4000; }
        to { stroke-dasharray: 4000; stroke-dashoffset: 2000; }
      }
    `
  }

  html(){ return `
    <h3>Profit Over Time</h3>
    <svg id="graph-svg" viewBox="0 0 1000 200" preserveAspectRatio="none">
      <polyline vector-effect="non-scaling-stroke" id="line" fill="transparent" stroke-width="2" points="0,0 1000,0" />
    </svg>
    <h3>Recent Transactions</h3>
    <slot></slot>
  `}


  async connectedCallback(){
    let ledgerData = await this.getData('/user/get-financial-ledger', this.authToken)
    ledgerData = this._dedupeEntries(ledgerData)
    await this.createEntries(ledgerData)
    this.renderGraph(ledgerData)
  }

  disconnectedCallback(){
    this.innerHTML = ''
  }

  async createEntries(data){
    let monthsDeposits = []
    let currentMonth = new Date().getMonth()
    data.forEach(entry => {
      let entryMonth = new Date(entry.createdAt).getMonth()
      if(entry.type === 'withdrawal') {
        this.innerHTML += this.renderLedgerLi(entry)
      }
      else {
        if(entryMonth === currentMonth){
          monthsDeposits.push(entry)
        } else {
          // append the month's deposits
          this.createMonth(monthsDeposits)
          // start a new month
          currentMonth = entryMonth
          monthsDeposits = [entry]
        }
      }
    })
    this.createMonth(monthsDeposits)
    setTimeout(()=>{
      this.toggleAttribute('loaded', true)
    }, 1)
    return true
  }

  _dedupeEntries(entries){
    let dedupedDeposits = []
    let prevEntry = null
    entries.forEach(entry => {
      if(prevEntry && prevEntry.description === entry.description){
        prevEntry.amount = parseFloat(prevEntry.amount) + parseFloat(entry.amount)
        prevEntry.count++
      } else {
        dedupedDeposits.push(entry)
        prevEntry = entry
        prevEntry.count = 1
      }
    })
    dedupedDeposits.map(entry => {
      entry.description = `${entry.count} ${entry.description.replace('deposit', `vote${entry.count > 1 ? 's' : ''}`)}`
    })
    return dedupedDeposits
  }

  createMonth(monthsDeposits){
    let month = document.createElement('nonio-ledger-month')
    month.createEntries(monthsDeposits)
    this.appendChild(month)
  }

  renderLedgerLi(entry){
    let date = new Date(entry.createdAt).toLocaleString('default', {
      month: 'numeric',
      day: 'numeric'
    })
    return`
      <nonio-ledger-li type="${entry.type}">
        <div slot="date">${date}</div>
        <div slot="description">${entry.description}</div>
        <div slot="amount">${entry.amount}</div>
      </nonio-ledger-li>
    `
  }

  renderGraph(ledger){
    if(ledger.length < 2) return
    let startDate = new Date(ledger[0].createdAt)
    let endDate = new Date(ledger[ledger.length - 1].createdAt)
    let timeBetween = endDate.getTime() - startDate.getTime()

    let sum = 0
    ledger.forEach(entry => {
      sum += entry.amount
    })

    let polyString = ''
    let amount = 0
    ledger.forEach((entry, i) => {
      let time = new Date(entry.createdAt).getTime() - startDate.getTime()
      amount += entry.amount
      let height = 190 - (amount / sum * 170)
      if(i == 0) polyString += `-10 ${height} `
      polyString += `${1000 * time / timeBetween} ${height} `
      if(i == ledger.length - 1) polyString += ` 1010 ${height} 1010 210 -10 210`
    })

    this.select('#line').setAttribute('points', polyString)
  }
}