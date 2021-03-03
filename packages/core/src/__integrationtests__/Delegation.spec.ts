/**
 * @packageDocumentation
 * @group integration/delegation
 * @ignore
 */

import { ICType, Permission } from '@kiltprotocol/types'
import { UUID } from '@kiltprotocol/utils'
import { BlockchainUtils } from '@kiltprotocol/chain-helpers'
import { AttestedClaim, Identity } from '..'
import Attestation from '../attestation/Attestation'
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

async function writeRoot(delegator: Identity, ctypeHash: ICType['hash']) {
  const root = new DelegationRootNode(
    UUID.generate(),
    ctypeHash,
    delegator.address
  )
  await root.store(delegator).then((tx) =>
    BlockchainUtils.submitTxWithReSign(tx, delegator, {
      resolveOn: BlockchainUtils.IS_IN_BLOCK,
    })
  )
  return root
}
async function addDelegation(
  parentNode: DelegationRootNode | DelegationNode,
  delegator: Identity,
  delegee: Identity,
  permissions: Permission[]
): Promise<DelegationNode> {
  const rootId =
    parentNode instanceof DelegationRootNode ? parentNode.id : parentNode.rootId
  const delegation = new DelegationNode(
    UUID.generate(),
    rootId,
    delegee.address,
    permissions,
    parentNode.id
  )
  await delegation
    .store(delegator, delegee.signStr(delegation.generateHash()))
    .then((tx) =>
      BlockchainUtils.submitTxWithReSign(tx, delegator, {
        resolveOn: BlockchainUtils.IS_IN_BLOCK,
      })
    )
  return delegation
}

let root: Identity
let claimer: Identity
let attester: Identity

beforeAll(async () => {
  config({ address: WS_ADDRESS })
  root = wannabeFaucet
  claimer = wannabeBob
  attester = wannabeAlice

  if (!(await CtypeOnChain(DriversLicense))) {
    await DriversLicense.store(attester).then((tx) =>
      BlockchainUtils.submitTxWithReSign(tx, attester, {
        resolveOn: BlockchainUtils.IS_IN_BLOCK,
      })
    )
  }
}, 30_000)

it('should be possible to delegate attestation rights', async () => {
  const rootNode = await writeRoot(root, DriversLicense.hash)
  const delegatedNode = await addDelegation(rootNode, root, attester, [
    Permission.ATTEST,
  ])
  await Promise.all([
    expect(rootNode.verify()).resolves.toBeTruthy(),
    expect(delegatedNode.verify()).resolves.toBeTruthy(),
  ])
}, 60_000)

describe('and attestation rights have been delegated', () => {
  let rootNode: DelegationRootNode
  let delegatedNode: DelegationNode

  beforeAll(async () => {
    rootNode = await writeRoot(root, DriversLicense.hash)
    delegatedNode = await addDelegation(rootNode, root, attester, [
      Permission.ATTEST,
    ])

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
    const request = RequestForAttestation.fromClaimAndIdentity(claim, claimer, {
      delegationId: delegatedNode.id,
    })
    expect(request.verifyData()).toBeTruthy()
    expect(request.verifySignature()).toBeTruthy()

    const attestation = Attestation.fromRequestAndPublicIdentity(
      request,
      attester.getPublicIdentity()
    )
    await attestation.store(attester).then((tx) =>
      BlockchainUtils.submitTxWithReSign(tx, attester, {
        resolveOn: BlockchainUtils.IS_IN_BLOCK,
      })
    )

    const attClaim = AttestedClaim.fromRequestAndAttestation(
      request,
      attestation
    )
    expect(attClaim.verifyData()).toBeTruthy()
    await expect(attClaim.verify()).resolves.toBeTruthy()

    // revoke attestation through root
    await attClaim.attestation.revoke(root, 1).then((tx) =>
      BlockchainUtils.submitTxWithReSign(tx, root, {
        resolveOn: BlockchainUtils.IS_IN_BLOCK,
      })
    )
    await expect(attClaim.verify()).resolves.toBeFalsy()
  }, 75_000)
})

describe('revocation', () => {
  let delegator: Identity = root
  let firstDelegee: Identity = attester
  let secondDelegee: Identity = claimer

  beforeAll(() => {
    delegator = root
    firstDelegee = attester
    secondDelegee = claimer
  })

  it('delegator can revoke delegation', async () => {
    const delegationRoot = await writeRoot(delegator, DriversLicense.hash)
    const delegationA = await addDelegation(
      delegationRoot,
      delegator,
      firstDelegee,
      [Permission.ATTEST]
    )
    await expect(
      delegationA.revoke(delegator).then((tx) =>
        BlockchainUtils.submitTxWithReSign(tx, delegator, {
          resolveOn: BlockchainUtils.IS_IN_BLOCK,
        })
      )
    ).resolves.not.toThrow()
    await expect(delegationA.verify()).resolves.toBe(false)
  }, 40_000)

  it('delegee cannot revoke root but can revoke own delegation', async () => {
    const delegationRoot = await writeRoot(delegator, DriversLicense.hash)
    const delegationA = await addDelegation(
      delegationRoot,
      delegator,
      firstDelegee,
      [Permission.ATTEST]
    )
    await expect(
      delegationRoot.revoke(firstDelegee).then((tx) =>
        BlockchainUtils.submitTxWithReSign(tx, firstDelegee, {
          resolveOn: BlockchainUtils.IS_IN_BLOCK,
        })
      )
    ).rejects.toThrow()
    await expect(delegationRoot.verify()).resolves.toBe(true)

    await expect(
      delegationA.revoke(firstDelegee).then((tx) =>
        BlockchainUtils.submitTxWithReSign(tx, firstDelegee, {
          resolveOn: BlockchainUtils.IS_IN_BLOCK,
        })
      )
    ).resolves.not.toThrow()
    await expect(delegationA.verify()).resolves.toBe(false)
  }, 60_000)

  it('delegator can revoke root, revoking all delegations in tree', async () => {
    const delegationRoot = await writeRoot(delegator, DriversLicense.hash)
    const delegationA = await addDelegation(
      delegationRoot,
      delegator,
      firstDelegee,
      [Permission.ATTEST, Permission.DELEGATE]
    )
    const delegationB = await addDelegation(
      delegationA,
      firstDelegee,
      secondDelegee,
      [Permission.ATTEST]
    )
    await expect(
      delegationRoot.revoke(delegator).then((tx) =>
        BlockchainUtils.submitTxWithReSign(tx, delegator, {
          resolveOn: BlockchainUtils.IS_IN_BLOCK,
        })
      )
    ).resolves.not.toThrow()

    await Promise.all([
      expect(delegationRoot.verify()).resolves.toBe(false),
      expect(delegationA.verify()).resolves.toBe(false),
      expect(delegationB.verify()).resolves.toBe(false),
    ])
  }, 60_000)
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
