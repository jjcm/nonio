import SociComponent from './soci-component.js'

export default class SociLedgerMonth extends SociComponent {
  constructor() {
    super()
  }

  css(){
    return `
      :host {
        display: block;
        width: 100%;
        box-sizing: border-box;
        opacity: 0;
        transform: translateY(12px);
        border: 1px solid var(--bg-secondary);
        border-radius: 4px;
        line-height: 24px;
        margin-bottom: 4px;
      }
      :host([loaded]) {
        transform: translateY(0);
        opacity: 1;
        transition: transform 0.35s cubic-bezier(0.15, 0, 0.2, 1), opacity 0.35s var(--soci-ease);
      }
      :host(.open) #deposits { display: block; }
      #header {
        display: flex;
        padding: 8px;
        gap: 8px;
        white-space: nowrap;
        cursor: pointer;
        &:hover { background: var(--bg-secondary); }
      }
      #number, #date, soci-icon { color: var(--text-secondary); }
      #description { width: 100%; font-weight: bold; }
      #total { width: 100px; font-weight: bold; text-align: right; color: var(--text-success); }
      #deposits { display: none; padding-left: 32px; }
      ::slotted(soci-ledger-li) { border: 0; animation: load-down 0.15s var(--soci-ease); }
    `
  }

  html(){ return `
    <div id="header" @click=_toggleContributions>
      <soci-icon glyph="create"></soci-icon>
      <div id="description"></div>
      <div id="number"></div>
      <div id="total"></div>
    </div>
    <slot id="deposits"></slot>
  `}

  static get observedAttributes() {
    return ['total', 'description', 'number', 'date']
  }

  async attributeChangedCallback(name, oldValue, newValue){
    switch(name){
      case 'total':
        this.select('#total').innerHTML = newValue
        break
      case 'description':
        this.select('#description').innerHTML = newValue
        break
      case 'number':
        this.select('#number').innerHTML = newValue
        break
      case 'filter':
        break
    }
  }

  async createEntries(data){
    let totalDeposits = 0
    data.forEach(entry => {
      totalDeposits += entry.amount
    })
    this.setAttribute('total', '$' + totalDeposits.toFixed(2))
    this.setAttribute('number', data.length + ' contributions')
    let date = new Date(data[0].createdAt) 

    this.setAttribute('description', date.toLocaleString('default', { month: 'long' }) + ' Contributions')
    this.renderLedgerLi = this.renderLedgerLi.bind(this)
    let numberToRender = Math.ceil(window.innerHeight / 40) // the height of a post li
    // render only the amount visible on the screen first, and animate them in
    this.innerHTML = data.splice(0, numberToRender).map(this.renderLedgerLi).join('')
    // then once the main batch is done, load in the rest. 
    setTimeout(()=>{
      let tempDom = document.createElement('div')
      tempDom.innerHTML = data.map(this.renderLedgerLi).join('')
      Array.from(tempDom.children).forEach(child=>{
        this.appendChild(child)
      })
    }, 1)
    this.toggleAttribute('loaded', true)
  }

  renderLedgerLi(entry){
    return`
      <soci-ledger-li type="${entry.type}">
        <div slot="description">${entry.description}</div>
        <div slot="amount">${entry.amount}</div>
      </soci-ledger-li>
    `
  }

  _toggleContributions(){
    if(this.classList.toggle('open')) {
      this.select('#header soci-icon').setAttribute('glyph', 'remove')
    }
    else {
      this.select('#header soci-icon').setAttribute('glyph', 'create')
    }
  }
}