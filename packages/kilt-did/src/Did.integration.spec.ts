/**
 * @group integration/did
 */

import { Did, disconnect, Identity, init } from '@kiltprotocol/core'
import type { IIdentity } from '@kiltprotocol/types'
import { TypeRegistry } from '@polkadot/types'
import {
  BlockchainApiConnection,
  BlockchainUtils,
} from '@kiltprotocol/chain-helpers'
import type {
  DidSigned,
  IDidCreationOperation,
  IDidDeletionOperation,
  IDidUpdateOperation,
} from './types.chain'
import { create, update, deactivate, queryById } from './Did.chain'
import { IDidRecord } from './types'

let alice: IIdentity
let TYPE_REGISTRY: TypeRegistry

beforeAll(async () => {
  await init({ address: 'ws://localhost:9944' })
  TYPE_REGISTRY = new TypeRegistry()
  TYPE_REGISTRY.register(BlockchainApiConnection.CUSTOM_TYPES)

  alice = Identity.buildFromURI('//Alice')
})

describe('Did.chain', () => {
  describe('write and deactivate', () => {
    let id: IIdentity
    beforeAll(() => {
      id = Identity.buildFromMnemonic('')
    })

    it('writes a new did record to chain', async () => {
      const didCreate: IDidCreationOperation = new (TYPE_REGISTRY.getOrThrow<
        IDidCreationOperation
      >('DidCreationOperation'))(TYPE_REGISTRY, {
        did: id.address,
        new_auth_key: {
          [id.signKeyringPair.type]: id.signKeyringPair.publicKey,
        },
        new_key_agreement_key: {
          // TODO: fix typo
          X55519: id.boxKeyPair.publicKey,
        },
        new_endpoint_url: { Http: { payload: 'https://example.com' } },
      })

      const signature = id.signKeyringPair.sign(didCreate.toU8a())
      const signed = ({
        payload: didCreate,
        signature: { [id.signKeyringPair.type]: signature },
      } as unknown) as DidSigned<IDidCreationOperation>

      await expect(
        create(signed).then(async (tx) => {
          await tx.signAsync(alice.signKeyringPair)
          return BlockchainUtils.submitTxWithReSign(tx, alice, {
            resolveOn: BlockchainUtils.IS_IN_BLOCK,
          })
        })
      ).resolves.not.toThrow()

      await expect(queryById(id.address)).resolves.toMatchObject<
        Partial<IDidRecord>
      >({
        did: Did.getIdentifierFromAddress(id.address),
      })
    }, 20_000)

    it('deactivates did from previous step', async () => {
      await expect(queryById(id.address)).resolves.toMatchObject<
        Partial<IDidRecord>
      >({
        did: Did.getIdentifierFromAddress(id.address),
      })

      const didDeactivate = new (TYPE_REGISTRY.getOrThrow<
        IDidDeletionOperation
      >('DidDeletionOperation'))(TYPE_REGISTRY, {
        did: id.address,
        tx_counter: 1,
      })

      const signature = id.signKeyringPair.sign(didDeactivate.toU8a())
      const signed = ({
        payload: didDeactivate,
        signature: { [id.signKeyringPair.type]: signature },
      } as unknown) as DidSigned<IDidDeletionOperation>

      await expect(
        deactivate(signed).then(async (tx) => {
          await tx.signAsync(alice.signKeyringPair)
          return BlockchainUtils.submitTxWithReSign(tx, alice, {
            resolveOn: BlockchainUtils.IS_IN_BLOCK,
          })
        })
      ).resolves.not.toThrow()

      await expect(queryById(id.address)).resolves.toBe(null)
    }, 20_000)
  })

  it('creates and updates did', async () => {
    const id = Identity.buildFromMnemonic('')

    const didCreate: IDidCreationOperation = new (TYPE_REGISTRY.getOrThrow<
      IDidCreationOperation
    >('DidCreationOperation'))(TYPE_REGISTRY, {
      did: id.address,
      new_auth_key: { [id.signKeyringPair.type]: id.signKeyringPair.publicKey },
      new_key_agreement_key: {
        // TODO: fix typo
        X55519: id.boxKeyPair.publicKey,
      },
      new_endpoint_url: { Http: { payload: 'https://example.com' } },
    })

    const signature1 = id.signKeyringPair.sign(didCreate.toU8a())
    const signed1 = ({
      payload: didCreate,
      signature: { [id.signKeyringPair.type]: signature1 },
    } as unknown) as DidSigned<IDidCreationOperation>

    await expect(
      create(signed1).then(async (tx) => {
        await tx.signAsync(alice.signKeyringPair)
        return BlockchainUtils.submitTxWithReSign(tx, alice, {
          resolveOn: BlockchainUtils.IS_IN_BLOCK,
        })
      })
    ).resolves.not.toThrow()

    await expect(queryById(id.address)).resolves.toMatchObject<
      Partial<IDidRecord>
    >({
      did: Did.getIdentifierFromAddress(id.address),
      endpoint_url: 'https://example.com',
    })

    const didUpdate = new (TYPE_REGISTRY.getOrThrow<IDidUpdateOperation>(
      'DidUpdateOperation'
    ))(TYPE_REGISTRY, {
      did: id.address,
      new_endpoint_url: { Ftp: { payload: 'ftp://example.com/abc' } },
      tx_counter: 1,
    })

    const signature2 = id.signKeyringPair.sign(didUpdate.toU8a())
    const signed2 = ({
      payload: didUpdate,
      signature: { [id.signKeyringPair.type]: signature2 },
    } as unknown) as DidSigned<IDidUpdateOperation>

    await expect(
      update(signed2).then(async (tx) => {
        await tx.signAsync(alice.signKeyringPair)
        return BlockchainUtils.submitTxWithReSign(tx, alice, {
          resolveOn: BlockchainUtils.IS_IN_BLOCK,
        })
      })
    ).resolves.not.toThrow()

    await expect(queryById(id.address)).resolves.toMatchObject<
      Partial<IDidRecord>
    >({
      did: Did.getIdentifierFromAddress(id.address),
      endpoint_url: 'ftp://example.com/abc',
    })
  }, 20_000)
})

afterAll(async () => await disconnect())
