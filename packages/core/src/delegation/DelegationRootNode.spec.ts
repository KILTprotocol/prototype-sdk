/**
 * @packageDocumentation
 * @group unit/delegation
 * @ignore
 */

import { Crypto } from '@kiltprotocol/utils'
import {
  BlockchainApiConnection,
  BlockchainUtils,
} from '@kiltprotocol/chain-helpers'
import { mockChainQueryReturn } from '@kiltprotocol/chain-helpers/lib/blockchainApiConnection/__mocks__/BlockchainQuery'
import { Identity } from '..'

import DelegationRootNode from './DelegationRootNode'
import Kilt from '../kilt/Kilt'

jest.mock(
  '@kiltprotocol/chain-helpers/lib/blockchainApiConnection/BlockchainApiConnection'
)

describe('Delegation', () => {
  let identityAlice: Identity
  let ctypeHash: string
  let ROOT_IDENTIFIER: string
  Kilt.config({ address: 'ws://testString' })

  beforeAll(async () => {
    identityAlice = Identity.buildFromURI('//Alice')
    ctypeHash = Crypto.hashStr('testCtype')
    require('@kiltprotocol/chain-helpers/lib/blockchainApiConnection/BlockchainApiConnection').__mocked_api.query.delegation.root.mockReturnValue(
      mockChainQueryReturn('delegation', 'root', [
        ctypeHash,
        identityAlice.address,
        false,
      ])
    )
    require('@kiltprotocol/chain-helpers/lib/blockchainApiConnection/BlockchainApiConnection').__mocked_api.query.delegation.delegations.mockReturnValue(
      mockChainQueryReturn('delegation', 'delegations', [
        ctypeHash,
        null,
        identityAlice.address,
        1,
        false,
      ])
    )

    ROOT_IDENTIFIER = 'abc123'
  })

  it('stores root delegation', async () => {
    const rootDelegation = new DelegationRootNode(
      ROOT_IDENTIFIER,
      ctypeHash,
      identityAlice.address
    )
    await rootDelegation
      .store(identityAlice)
      .then((tx) => BlockchainUtils.submitTxWithReSign(tx, identityAlice))

    const rootNode = await DelegationRootNode.query(ROOT_IDENTIFIER)
    if (rootNode) {
      expect(rootNode.id).toBe(ROOT_IDENTIFIER)
    }
  })

  it('query root delegation', async () => {
    const queriedDelegation = await DelegationRootNode.query(ROOT_IDENTIFIER)
    expect(queriedDelegation).not.toBe(undefined)
    if (queriedDelegation) {
      expect(queriedDelegation.account).toBe(identityAlice.address)
      expect(queriedDelegation.cTypeHash).toBe(ctypeHash)
      expect(queriedDelegation.id).toBe(ROOT_IDENTIFIER)
    }
  })

  it('root delegation verify', async () => {
    require('@kiltprotocol/chain-helpers/lib/blockchainApiConnection/BlockchainApiConnection').__mocked_api.query.delegation.root = jest.fn(
      async (rootId) => {
        if (rootId === 'success') {
          const tuple = mockChainQueryReturn('delegation', 'root', [
            'myCtypeHash',
            identityAlice.address,
            false,
          ])

          return Promise.resolve(tuple)
        }
        const tuple = mockChainQueryReturn('delegation', 'root', [
          'myCtypeHash',
          identityAlice.address,
          true,
        ])

        return Promise.resolve(tuple)
      }
    )

    expect(
      await new DelegationRootNode(
        'success',
        'myCtypeHash',
        identityAlice.address
      ).verify()
    ).toBe(true)

    expect(
      await new DelegationRootNode('failure', ctypeHash, 'myAccount').verify()
    ).toBe(false)
  })

  it('root delegation verify', async () => {
    const blockchain = await BlockchainApiConnection.getConnectionOrConnect()

    const aDelegationRootNode = new DelegationRootNode(
      'myRootId',
      ctypeHash,
      'myAccount'
    )
    const revokeStatus = await aDelegationRootNode
      .revoke(identityAlice)
      .then((tx) => BlockchainUtils.submitTxWithReSign(tx, identityAlice))
    expect(blockchain.api.tx.delegation.revokeRoot).toBeCalledWith(
      'myRootId',
      1
    )
    expect(revokeStatus).toBeDefined()
  })
})
