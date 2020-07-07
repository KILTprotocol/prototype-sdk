import Blockchain from '../blockchain'
import getCached, { clearCache } from './BlockchainApiConnection'

const DEVNET_WS_ADDRESS = 'ws://full-nodes.devnet.kilt.io:9944/'

let blockchain: Blockchain | undefined
beforeAll(async () => {
  blockchain = await getCached(DEVNET_WS_ADDRESS)
})

async function timeboxCache(): Promise<number> {
  const start = new Date().getTime()
  await getCached(DEVNET_WS_ADDRESS)
  return new Date().getTime() - start
}

describe('BlockchainApiConnection', () => {
  // disable spam from polkadot logger for this test
  global.console.log = jest.fn()
  it('Should connect to testnet', async () => {
    expect(blockchain).toBeDefined()
    expect(blockchain).toBeInstanceOf(Blockchain)
    expect(blockchain?.ready).resolves.toBeTruthy()
  })
  it('Should clear cache', async () => {
    // cache already exists
    await expect(timeboxCache()).resolves.toBeLessThan(10)
    clearCache()
    // has to build new connection
    await expect(timeboxCache()).resolves.toBeGreaterThan(100)
  })
})

afterAll(() => {
  if (typeof blockchain !== 'undefined') blockchain.api.disconnect()
})
