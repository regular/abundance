const h = require('mutant/html-element')
const Value = require('mutant/value')
const computed = require('mutant/computed')

module.exports = function(ssb) {
    const address = Value()

    ssb.getAddress((err, addr)=>{
      if (err) {
        console.error('error getting ssb address')
        address.set(err)
      } else {
        console.warn('get address success')
        const [schema, ip, port, id] = addr.split(':')
        const a = {schema, ip, port, id}
        console.warn('set address to', JSON.stringify(a))
        address.set(a)
      } 
    })

    return function renderAddressWidget() {
      return h('.sbot-address', computed(address, address => {
        console.warn('address computed input', address)
        if (!address) return h('span', 'getting address ...')
        if (address.message) return h('span.error', address.message)
        const {schema, ip, port, id} = address
        return h(`.${schema}`, [
          h('.ip', ip),
          h('.port', port),
          h('.id', id),
        ])
      })
    )
  }
}
