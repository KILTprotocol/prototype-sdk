/**
 * @packageDocumentation
 * @group integration/delegation
 * @ignore
 */

import { cryptoWaitReady } from '@polkadot/util-crypto'
import { Permission } from '@kiltprotocol/types'
import { UUID } from '@kiltprotocol/utils'
import { AttestedClaim, Identity } from '..'
import Attestation from '../attestation/Attestation'
import {
  IS_IN_BLOCK,
  IS_READY,
  submitTxWithReSign,
} from '../blockchain/Blockchain.utils'
import { config, disconnect } from '../kilt'
import Claim from '../claim/Claim'
import {
  fetchChildren,
  getAttestationHashes,
  getChildIds,
} from '../delegation/Delegation.chain'
import { decodeDelegationNode } from '../delegation/DelegationDecoder'
import DelegationNode from '../delegation/DelegationNode'
import DelegationRootNode from '../delegation/DelegationRootNode'
import RequestForAttestation from '../requestforattestation/RequestForAttestation'
import {
  CtypeOnChain,
  DriversLicense,
  wannabeAlice,
  wannabeBob,
  wannabeFaucet,
  WS_ADDRESS,
} from './utils'

beforeAll(async () => {
  config({ address: WS_ADDRESS })
})

describe('when there is an account hierarchy', () => {
  let uncleSam: Identity
  let claimer: Identity
  let attester: Identity

  beforeAll(async () => {
    await cryptoWaitReady()
    uncleSam = wannabeFaucet
    claimer = wannabeBob
    attester = wannabeAlice

    if (!(await CtypeOnChain(DriversLicense))) {
      await DriversLicense.store(attester).then((tx) =>
        submitTxWithReSign(tx, attester, { resolveOn: IS_IN_BLOCK })
      )
    }
  }, 30_000)

  it('should be possible to delegate attestation rights', async () => {
    const rootNode = new DelegationRootNode(
      UUID.generate(),
      DriversLicense.hash,
      uncleSam.address
    )
    await rootNode
      .store(uncleSam)
      .then((tx) =>
        submitTxWithReSign(tx, uncleSam, { resolveOn: IS_IN_BLOCK })
      )
    const delegatedNode = new DelegationNode(
      UUID.generate(),
      rootNode.id,
      attester.address,
      [Permission.ATTEST],
      rootNode.id
    )
    const HashSignedByDelegate = attester.signStr(delegatedNode.generateHash())
    await delegatedNode
      .store(uncleSam, HashSignedByDelegate)
      .then((tx) =>
        submitTxWithReSign(tx, uncleSam, { resolveOn: IS_IN_BLOCK })
      )
    await Promise.all([
      expect(rootNode.verify()).resolves.toBeTruthy(),
      expect(delegatedNode.verify()).resolves.toBeTruthy(),
    ])
  }, 75_000)

  describe('and attestation rights have been delegated', () => {
    let rootNode: DelegationRootNode
    let delegatedNode: DelegationNode
    let HashSignedByDelegate: string

    beforeAll(async () => {
      rootNode = new DelegationRootNode(
        UUID.generate(),
        DriversLicense.hash,
        uncleSam.address
      )
      delegatedNode = new DelegationNode(
        UUID.generate(),
        rootNode.id,
        attester.address,
        [Permission.ATTEST],
        rootNode.id
      )
      HashSignedByDelegate = attester.signStr(delegatedNode.generateHash())
      await rootNode
        .store(uncleSam)
        .then((tx) => submitTxWithReSign(tx, uncleSam, { resolveOn: IS_READY }))
      await delegatedNode.store(uncleSam, HashSignedByDelegate).then((tx) =>
        submitTxWithReSign(tx, uncleSam, {
          resolveOn: IS_IN_BLOCK,
        })
      )
      await Promise.all([
        expect(rootNode.verify()).resolves.toBeTruthy(),
        expect(delegatedNode.verify()).resolves.toBeTruthy(),
      ])
    }, 75_000)

    it("should be possible to attest a claim in the root's name and revoke it by the root", async () => {
      const content = {
        name: 'Ralph',
        age: 12,
      }
      const claim = Claim.fromCTypeAndClaimContents(
        DriversLicense,
        content,
        claimer.address
      )
      const request = RequestForAttestation.fromClaimAndIdentity(
        claim,
        claimer,
        {
          delegationId: delegatedNode.id,
        }
      )
      expect(request.verifyData()).toBeTruthy()
      expect(request.verifySignature()).toBeTruthy()

      const attestation = Attestation.fromRequestAndPublicIdentity(
        request,
        attester.getPublicIdentity()
      )
      await attestation.store(attester).then((tx) =>
        submitTxWithReSign(tx, attester, {
          resolveOn: IS_IN_BLOCK,
        })
      )

      const attClaim = AttestedClaim.fromRequestAndAttestation(
        request,
        attestation
      )
      expect(attClaim.verifyData()).toBeTruthy()
      await expect(attClaim.verify()).resolves.toBeTruthy()

      // revoke attestation through root
      await attClaim.attestation.revoke(uncleSam, 1).then((tx) =>
        submitTxWithReSign(tx, uncleSam, {
          resolveOn: IS_IN_BLOCK,
        })
      )
      await expect(attClaim.verify()).resolves.toBeFalsy()
    }, 75_000)
  })
})

describe('handling queries to data not on chain', () => {
  it('getChildIds on empty', async () => {
    return expect(getChildIds('0x012012012')).resolves.toEqual([])
  })

  it('DelegationNode query on empty', async () => {
    return expect(DelegationNode.query('0x012012012')).resolves.toBeNull()
  })

  it('DelegationRootNode.query on empty', async () => {
    return expect(DelegationRootNode.query('0x012012012')).resolves.toBeNull()
  })

  it('getAttestationHashes on empty', async () => {
    return expect(getAttestationHashes('0x012012012')).resolves.toEqual([])
  })

  it('fetchChildren on empty', async () => {
    return expect(
      fetchChildren(['0x012012012']).then((res) =>
        res.map((el) => {
          return { id: el.id, codec: decodeDelegationNode(el.codec) }
        })
      )
    ).resolves.toEqual([{ id: '0x012012012', codec: null }])
  })
})

afterAll(() => {
  disconnect()
})
