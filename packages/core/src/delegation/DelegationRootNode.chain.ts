/**
 * @packageDocumentation
 * @ignore
 */

import { Option } from '@polkadot/types'
import type {
  IDelegationRootNode,
  SubmittableExtrinsic,
} from '@kiltprotocol/types'
import { BlockchainApiConnection } from '@kiltprotocol/chain-helpers'
import Identity from '../identity/Identity'
import {
  decodeRootDelegation,
  IChainDelegationRoot,
  RootDelegationRecord,
} from './DelegationDecoder'
import DelegationRootNode from './DelegationRootNode'

export async function store(
  delegation: IDelegationRootNode,
  identity: Identity
): Promise<SubmittableExtrinsic> {
  const blockchain = await BlockchainApiConnection.getConnectionOrConnect()
  const tx: SubmittableExtrinsic = blockchain.api.tx.delegation.createRoot(
    delegation.id,
    delegation.cTypeHash
  )
  return blockchain.signTx(identity, tx)
}

export async function query(
  delegationId: IDelegationRootNode['id']
): Promise<DelegationRootNode | null> {
  const blockchain = await BlockchainApiConnection.getConnectionOrConnect()
  const decoded: RootDelegationRecord | null = decodeRootDelegation(
    await blockchain.api.query.delegation.root<Option<IChainDelegationRoot>>(
      delegationId
    )
  )
  if (decoded) {
    const root = new DelegationRootNode(
      delegationId,
      decoded.cTypeHash,
      decoded.account
    )
    root.revoked = decoded.revoked
    return root
  }
  return null
}

/**
 * Revokes a full delegation tree, also revoking all constituent nodes.
 *
 * @param delegation The [[DelegationRootNode]] node in the delegation tree at which to revoke.
 * @param identity The owner of the [[DelegationRootNode]], who is the only one authorized to revoke it.
 * @param maxRevocations The maximum number of revocations that may be performed. Should be set to the number of nodes (including the root node) in the tree. Higher numbers result in a larger amount locked during the transaction, as each revocation adds to the fee that is charged.
 * @returns Signed [[SubmittableExtrinsic]] ready to be dispatched.
 */
export async function revoke(
  delegation: IDelegationRootNode,
  identity: Identity,
  maxRevocations: number
): Promise<SubmittableExtrinsic> {
  const blockchain = await BlockchainApiConnection.getConnectionOrConnect()
  const tx: SubmittableExtrinsic = blockchain.api.tx.delegation.revokeRoot(
    delegation.id,
    maxRevocations
  )
  return blockchain.signTx(identity, tx)
}
