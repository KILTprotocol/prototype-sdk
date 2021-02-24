/**
 * @packageDocumentation
 * @group integration/blockchain
 * @ignore
 */

import { SignerPayload } from '@polkadot/types/interfaces/extrinsics/types'
import BN from 'bn.js/'
import { SDKErrors } from '@kiltprotocol/utils'
import { makeTransfer } from '../balance/Balance.chain'
import {
  IS_FINALIZED,
  IS_IN_BLOCK,
  submitSignedTxRaw,
  submitTxWithReSign,
  TxOutdated,
  TxPriority,
  TxDuplicate,
  IS_READY,
  parseSubscriptionOptions,
} from '../blockchain/Blockchain.utils'
import Identity from '../identity/Identity'
import { wannabeFaucet, wannabeCharlie, WS_ADDRESS } from './utils'
import { IBlockchainApi } from '../blockchain/Blockchain'
import { config, connect, disconnect } from '../kilt'

let blockchain: IBlockchainApi
beforeAll(async () => {
  config({ address: WS_ADDRESS })
  blockchain = await connect()
})

describe('Chain returns specific errors, that we check for', () => {
  let faucet: Identity
  let testIdentity: Identity
  let charlie: Identity
  beforeAll(async () => {
    faucet = wannabeFaucet
    testIdentity = Identity.buildFromURI(Identity.generateMnemonic())
    charlie = wannabeCharlie
    const tx = await makeTransfer(
      faucet,
      testIdentity.address,
      new BN(10000),
      0
    )
    await submitTxWithReSign(tx, charlie, {
      resolveOn: IS_FINALIZED,
    })
  }, 40000)

  it(`throws TxOutdated error if the nonce was already used for Tx in block`, async () => {
    const tx = blockchain.api.tx.balances.transfer(
      charlie.address,
      new BN('1000000000000001')
    )
    const errorTx = blockchain.api.tx.balances.transfer(
      charlie.address,
      new BN('1000000000000000')
    )

    const nonce = await blockchain.getNonce(testIdentity.address)

    const signer: SignerPayload = blockchain.api.createType('SignerPayload', {
      method: tx.method.toHex(),
      nonce,
      genesisHash: blockchain.api.genesisHash,
      blockHash: blockchain.api.genesisHash,
      runtimeVersion: blockchain.api.runtimeVersion,
      version: blockchain.api.extrinsicVersion,
    })
    const { signature } = blockchain.api
      .createType('ExtrinsicPayload', signer.toPayload(), {
        version: blockchain.api.extrinsicVersion,
      })
      .sign(testIdentity.signKeyringPair)
    tx.addSignature(testIdentity.address, signature, signer.toPayload())

    const errorSigner: SignerPayload = blockchain.api.createType(
      'SignerPayload',
      {
        method: errorTx.method.toHex(),
        nonce,
        genesisHash: blockchain.api.genesisHash,
        blockHash: blockchain.api.genesisHash,
        runtimeVersion: blockchain.api.runtimeVersion,
        version: blockchain.api.extrinsicVersion,
      }
    )
    await submitSignedTxRaw(
      tx,
      parseSubscriptionOptions({
        resolveOn: IS_IN_BLOCK,
      })
    )

    const { signature: errorSignature } = blockchain.api
      .createType('ExtrinsicPayload', errorSigner.toPayload(), {
        version: blockchain.api.extrinsicVersion,
      })
      .sign(testIdentity.signKeyringPair)
    errorTx.addSignature(
      testIdentity.address,
      errorSignature,
      errorSigner.toPayload()
    )

    await expect(
      submitSignedTxRaw(
        errorTx,
        parseSubscriptionOptions({
          resolveOn: IS_IN_BLOCK,
        })
      )
    ).rejects.toThrow(TxOutdated)
  }, 40000)
  it(`throws TxPriority error if the nonce was already used for Tx in pool with higher or identical priority`, async () => {
    const tx = blockchain.api.tx.balances.transfer(
      charlie.address,
      new BN('10000000000000000')
    )
    const errorTx = blockchain.api.tx.balances.transfer(
      charlie.address,
      new BN('1000000000000000')
    )

    const nonce = await blockchain.getNonce(testIdentity.address)

    const signer: SignerPayload = blockchain.api.createType('SignerPayload', {
      method: tx.method.toHex(),
      nonce,
      genesisHash: blockchain.api.genesisHash,
      blockHash: blockchain.api.genesisHash,
      runtimeVersion: blockchain.api.runtimeVersion,
      version: blockchain.api.extrinsicVersion,
    })
    const { signature } = blockchain.api
      .createType('ExtrinsicPayload', signer.toPayload(), {
        version: blockchain.api.extrinsicVersion,
      })
      .sign(testIdentity.signKeyringPair)
    tx.addSignature(testIdentity.address, signature, signer.toPayload())

    const errorSigner: SignerPayload = blockchain.api.createType(
      'SignerPayload',
      {
        method: errorTx.method.toHex(),
        nonce,
        genesisHash: blockchain.api.genesisHash,
        blockHash: blockchain.api.genesisHash,
        runtimeVersion: blockchain.api.runtimeVersion,
        version: blockchain.api.extrinsicVersion,
      }
    )
    await submitSignedTxRaw(
      tx,
      parseSubscriptionOptions({
        resolveOn: IS_READY,
      })
    )

    const { signature: errorSignature } = blockchain.api
      .createType('ExtrinsicPayload', errorSigner.toPayload(), {
        version: blockchain.api.extrinsicVersion,
      })
      .sign(testIdentity.signKeyringPair)
    errorTx.addSignature(
      testIdentity.address,
      errorSignature,
      errorSigner.toPayload()
    )

    await expect(
      submitSignedTxRaw(
        errorTx,
        parseSubscriptionOptions({
          resolveOn: IS_IN_BLOCK,
        })
      )
    ).rejects.toThrow(TxPriority)
  }, 40000)
  it(`throws TxDuplicate error if identical Tx was already imported`, async () => {
    const tx = blockchain.api.tx.balances.transfer(
      charlie.address,
      new BN('1000000000000000')
    )
    const errorTx = blockchain.api.tx.balances.transfer(
      charlie.address,
      new BN('1000000000000000')
    )

    const nonce = await blockchain.getNonce(testIdentity.address)

    const signer: SignerPayload = blockchain.api.createType('SignerPayload', {
      method: tx.method.toHex(),
      nonce,
      genesisHash: blockchain.api.genesisHash,
      blockHash: blockchain.api.genesisHash,
      runtimeVersion: blockchain.api.runtimeVersion,
      version: blockchain.api.extrinsicVersion,
    })
    const { signature } = blockchain.api
      .createType('ExtrinsicPayload', signer.toPayload(), {
        version: blockchain.api.extrinsicVersion,
      })
      .sign(testIdentity.signKeyringPair)
    tx.addSignature(testIdentity.address, signature, signer.toPayload())
    const errorSigner: SignerPayload = blockchain.api.createType(
      'SignerPayload',
      {
        method: tx.method.toHex(),
        nonce,
        genesisHash: blockchain.api.genesisHash,
        blockHash: blockchain.api.genesisHash,
        runtimeVersion: blockchain.api.runtimeVersion,
        version: blockchain.api.extrinsicVersion,
      }
    )
    const { signature: errorSig } = blockchain.api
      .createType('ExtrinsicPayload', errorSigner.toPayload(), {
        version: blockchain.api.extrinsicVersion,
      })
      .sign(testIdentity.signKeyringPair)
    errorTx.addSignature(testIdentity.address, errorSig, signer.toPayload())

    await submitSignedTxRaw(
      tx,
      parseSubscriptionOptions({
        resolveOn: IS_READY,
      })
    )

    await expect(errorTx.send()).rejects.toThrow(TxDuplicate)
  }, 40000)
  it(`throws 'ERROR_TRANSACTION_USURPED' error if separate Tx was imported with identical nonce but higher priority while Tx is in pool`, async () => {
    const tx = blockchain.api.tx.balances.transfer(
      charlie.address,
      new BN('1000000000000000')
    )
    const errorTx = blockchain.api.tx.balances.transfer(
      charlie.address,
      new BN('1000000000000000')
    )

    const nonce = await blockchain.getNonce(testIdentity.address)

    const signer: SignerPayload = blockchain.api.createType('SignerPayload', {
      method: tx.method.toHex(),
      nonce,
      genesisHash: blockchain.api.genesisHash,
      blockHash: blockchain.api.genesisHash,
      runtimeVersion: blockchain.api.runtimeVersion,
      version: blockchain.api.extrinsicVersion,
    })
    const { signature } = blockchain.api
      .createType('ExtrinsicPayload', signer.toPayload(), {
        version: blockchain.api.extrinsicVersion,
      })
      .sign(testIdentity.signKeyringPair)
    tx.addSignature(testIdentity.address, signature, signer.toPayload())

    const errorSigner: SignerPayload = blockchain.api.createType(
      'SignerPayload',
      {
        method: errorTx.method.toHex(),
        nonce,
        genesisHash: blockchain.api.genesisHash,
        blockHash: blockchain.api.genesisHash,
        runtimeVersion: blockchain.api.runtimeVersion,
        version: blockchain.api.extrinsicVersion,
        tip: '0x00000000000000000000000000005678',
      }
    )
    expect(
      submitSignedTxRaw(
        tx,
        parseSubscriptionOptions({
          resolveOn: IS_IN_BLOCK,
        })
      )
    ).rejects.toThrow(SDKErrors.ERROR_TRANSACTION_USURPED())

    const { signature: errorSignature } = blockchain.api
      .createType('ExtrinsicPayload', errorSigner.toPayload(), {
        version: blockchain.api.extrinsicVersion,
      })
      .sign(testIdentity.signKeyringPair)
    errorTx.addSignature(
      testIdentity.address,
      errorSignature,
      errorSigner.toPayload()
    )

    await submitSignedTxRaw(
      errorTx,
      parseSubscriptionOptions({
        resolveOn: IS_IN_BLOCK,
      })
    )
  }, 40000)
})

afterAll(() => {
  if (typeof blockchain !== 'undefined') disconnect()
})
