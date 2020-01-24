/**
 * @group integration
 */

import BN from 'bn.js/'
import Identity from '../identity/Identity'
import {
  getBalance,
  makeTransfer,
  listenToBalanceChanges,
} from '../balance/Balance.chain'
import {
  GAS,
  MIN_TRANSACTION,
  faucet,
  transferTokens,
  NewIdentity,
} from './utils'
import getCached from '../blockchainApiConnection'
import { IBlockchainApi } from '../blockchain/Blockchain'

describe('when there is a dev chain with a faucet', async () => {
  it('should have enough coins available on the faucet', async () => {
    const balance = await getBalance(faucet.address)
    expect(balance.gt(new BN(100000000))).toBeTruthy()
    console.log(`Faucet has ${Number(balance)} micro Kilt`)
  })

  it('should be able to faucet coins to a new identity', async () => {
    const ident = NewIdentity()
    const funny = jest.fn()
    listenToBalanceChanges(ident.address, funny)
    await transferTokens(faucet, ident, MIN_TRANSACTION)
    const balanceIdent = await getBalance(ident.address)
    expect(balanceIdent.toNumber()).toBe(MIN_TRANSACTION.toNumber())
    expect(funny).toBeCalled()
  }, 15000)
})

describe('When there are haves and have-nots', async () => {
  const BobbyBroke = Identity.buildFromMnemonic(Identity.generateMnemonic())
  const RichieRich = Identity.buildFromMnemonic(Identity.generateMnemonic())
  const StormyD = Identity.buildFromMnemonic(Identity.generateMnemonic())

  beforeAll(async () => {
    await Promise.all([
      transferTokens(faucet, RichieRich, MIN_TRANSACTION.mul(new BN(1000))),
    ])
  }, 30000)

  it('can transfer tokens from the rich to the poor', async () => {
    await transferTokens(RichieRich, StormyD, MIN_TRANSACTION)
    const balanceTo = await getBalance(StormyD.address)
    expect(balanceTo.toNumber()).toBe(MIN_TRANSACTION.toNumber())
  }, 15000)

  it('should not accept transactions from identity with zero balance', async () => {
    const originalBalance = await getBalance(StormyD.address)
    await expect(
      makeTransfer(BobbyBroke, StormyD.address, MIN_TRANSACTION)
    ).rejects.toThrowError('1010: Invalid Transaction')
    const [newBalance, zeroBalance] = await Promise.all([
      getBalance(StormyD.address),
      getBalance(BobbyBroke.address),
    ])
    expect(newBalance.toNumber()).toBe(originalBalance.toNumber())
    expect(zeroBalance.toNumber()).toBe(0)
  }, 15000)

  it('should not accept transactions when sender cannot pay gas, but will keep gas fee', async () => {
    const RichieBalance = await getBalance(RichieRich.address)
    await expect(
      makeTransfer(RichieRich, BobbyBroke.address, RichieBalance)
    ).rejects.toThrowError()
    const [newBalance, zeroBalance] = await Promise.all([
      getBalance(RichieRich.address),
      getBalance(BobbyBroke.address),
    ])
    expect(zeroBalance.toNumber()).toBe(0)
    expect(newBalance.toNumber()).toBe(RichieBalance.sub(GAS).toNumber())
  }, 15000)

  xit('should be able to make multiple transactions at once', async () => {
    const listener = jest.fn()
    listenToBalanceChanges(faucet.address, listener)
    await Promise.all([
      makeTransfer(faucet, RichieRich.address, MIN_TRANSACTION),
      makeTransfer(faucet, StormyD.address, MIN_TRANSACTION),
    ])
    expect(listener).toBeCalledWith(faucet.address)
  }, 30000)
})

afterAll(async () => {
  await getCached().then(
    (BC: IBlockchainApi) => {
      BC.api.disconnect()
    },
    err => {
      console.log('not connected to chain')
      console.log(err)
    }
  )
})