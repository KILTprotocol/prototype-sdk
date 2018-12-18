import { ApiPromise } from '@polkadot/api'
import { Header } from '@polkadot/types'
import partial from 'lodash/partial'
import Identity from '../identity/Identity'
import Blockchain from './Blockchain'
// NB: see jst.config.js - include this dir to be tested for test coverage again
// to acquire a connection as singleton, async and without jest complaining about
// 'Jest: Coverage data for ./src/blockchain/ was not found.' I use this construct for now
let apiSingleton: ApiPromise
const getConnectionOnce = async () => {
  if (!apiSingleton) {
    apiSingleton = await Blockchain.connect()
  }
  return apiSingleton
}

describe('Blockchain', async () => {
  xit('should get stats', async () => {
    const api = await getConnectionOnce()
    const stats = await partial(Blockchain.getStats, api)()
    expect(stats).toEqual({
      chain: 'KILT Testnet',
      nodeName: 'substrate-node',
      nodeVersion: '0.9.0',
    })
  })

  xit('should listen to blocks', async done => {
    const api = await getConnectionOnce()

    const listener = (header: Header) => {
      console.log(`Best block number ${header.blockNumber}`)
      done()
    }

    const subscriptionId = await partial(Blockchain.listenToBlocks, api)(
      listener
    )
    expect(subscriptionId).toBeGreaterThanOrEqual(0)
    console.log(`Subscription Id: ${subscriptionId}`)
  }, 20000)

  xit('should listen to balance changes', async () => {
    const api = await getConnectionOnce()
    const alice = new Identity()
    const listener = undefined
    // const listener = (account: string, balance: Balance, change: BN) => {
    //   console.log({ account, balance, change })
    //   done()
    // }

    const currentBalance = await partial(
      Blockchain.listenToBalanceChanges,
      api
    )(alice.signKeyringPair.address(), listener)

    expect(currentBalance.toString()).toEqual('0')
  }, 10000)

  xit('should make transfer', async () => {
    const api = await getConnectionOnce()
    const alice = new Identity()
    const bob = new Identity()

    const hash = await partial(Blockchain.makeTransfer, api)(
      alice,
      bob.signKeyringPair.address(),
      100
    )
    console.log({ hash })
  }, 10000)

  xit('should hash ctype', async () => {
    const api = await getConnectionOnce()

    const identity = new Identity()
    const hash = await partial(Blockchain.ctypeHash, api)(
      identity,
      'hello world'
    )
    console.log(hash)
  }, 10000)
})
