/**
 * @packageDocumentation
 * @ignore
 */
import { Option, Struct } from '@polkadot/types'
import type {
  IAttestation,
  IIdentity,
  SubmittableExtrinsic,
} from '@kiltprotocol/types'
import { DecoderUtils, SDKErrors } from '@kiltprotocol/utils'
import { AccountId, Hash } from '@polkadot/types/interfaces'
import { ConfigService } from '@kiltprotocol/config'
import { BlockchainApiConnection } from '@kiltprotocol/chain-helpers'
import Identity from '../identity/Identity'
import Attestation from './Attestation'
import { DelegationNodeId } from '../delegation/DelegationDecoder'
import DelegationNode from '../delegation/DelegationNode'

const log = ConfigService.LoggingFactory.getLogger('Attestation')

export async function store(
  attestation: IAttestation,
  identity: Identity
): Promise<SubmittableExtrinsic> {
  const txParams = {
    claimHash: attestation.claimHash,
    ctypeHash: attestation.cTypeHash,
    delegationId: attestation.delegationId,
  }
  log.debug(() => `Create tx for 'attestation.add'`)

  const blockchain = await BlockchainApiConnection.getConnectionOrConnect()

  const tx = blockchain.api.tx.attestation.add(
    txParams.claimHash,
    txParams.ctypeHash,
    txParams.delegationId
  )
  return blockchain.signTx(identity, tx)
}

export interface IChainAttestation extends Struct {
  readonly ctypeHash: Hash
  readonly attester: AccountId
  readonly delegationId: Option<DelegationNodeId>
  readonly revoked: boolean
}

function decode(
  encoded: Option<IChainAttestation>,
  claimHash: string // all the other decoders do not use extra data; they just return partial types
): Attestation | null {
  DecoderUtils.assertCodecIsType(encoded, ['Option<Attestation>'])
  if (encoded.isSome) {
    const chainAttestation = encoded.unwrap()
    const attestation: IAttestation = {
      claimHash,
      cTypeHash: chainAttestation.ctypeHash.toString(),
      owner: chainAttestation.attester.toString(),
      delegationId:
        chainAttestation.delegationId.unwrapOr(null)?.toString() || null,
      revoked: chainAttestation.revoked.valueOf(),
    }
    log.info(`Decoded attestation: ${JSON.stringify(attestation)}`)
    return Attestation.fromAttestation(attestation)
  }
  return null
}

// return types reflect backwards compatibility with mashnet-node v 0.22
async function queryRaw(claimHash: string): Promise<Option<IChainAttestation>> {
  log.debug(() => `Query chain for attestations with claim hash ${claimHash}`)
  const blockchain = await BlockchainApiConnection.getConnectionOrConnect()
  const result = await blockchain.api.query.attestation.attestations<
    Option<IChainAttestation>
  >(claimHash)
  return result
}

export async function query(claimHash: string): Promise<Attestation | null> {
  const encoded = await queryRaw(claimHash)
  return decode(encoded, claimHash)
}

export async function revoke(
  claimHash: string,
  identity: Identity,
  maxDepth: number
): Promise<SubmittableExtrinsic> {
  const blockchain = await BlockchainApiConnection.getConnectionOrConnect()
  log.debug(() => `Revoking attestations with claim hash ${claimHash}`)
  const tx: SubmittableExtrinsic = blockchain.api.tx.attestation.revoke(
    claimHash,
    maxDepth
  )
  return blockchain.signTx(identity, tx)
}

export async function canRevoke(
  address: IIdentity['address'],
  attestation: IAttestation
): Promise<{
  authorized: boolean
  delegationDepth: number
  error?: SDKErrors.SDKError
}> {
  const result: {
    authorized: boolean
    delegationDepth: number
    error?: SDKErrors.SDKError
  } = { authorized: false, delegationDepth: 0 }
  // can revoke if owner
  if (attestation.owner === address) {
    result.authorized = true
    return result
  }
  // else we need to check the delegation tree
  if (attestation.delegationId) {
    const delegationNode = await DelegationNode.query(attestation.delegationId)
    if (!delegationNode) {
      throw SDKErrors.ERROR_NOT_FOUND(
        `attestation invalid; delegation with id ${attestation.delegationId} does not exist on chain`
      )
    }
    const { steps, node } = await delegationNode.isDelegating(address)
    // steps between nodes plus lookup of first delegation node
    result.delegationDepth = steps + 1
    if (!node) {
      result.error = SDKErrors.ERROR_UNAUTHORIZED(
        'not authorized to revoke this attestation. (not in delegation tree)'
      )
      return result
    }
    result.authorized = true
    return result
  }
  //
  result.error = SDKErrors.ERROR_UNAUTHORIZED(
    'not authorized to revoke this attestation. (not the owner, no delegations)'
  )
  return result
}
