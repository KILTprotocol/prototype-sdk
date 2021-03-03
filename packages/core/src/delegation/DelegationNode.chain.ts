/**
 * @packageDocumentation
 * @ignore
 */

import { Option } from '@polkadot/types'
import type { IDelegationNode, SubmittableExtrinsic } from '@kiltprotocol/types'
import { ConfigService } from '@kiltprotocol/config'
import { BlockchainApiConnection } from '@kiltprotocol/chain-helpers'
import Identity from '../identity/Identity'
import DelegationBaseNode from './Delegation'
import { fetchChildren, getChildIds } from './Delegation.chain'
import {
  CodecWithId,
  decodeDelegationNode,
  IChainDelegationNode,
} from './DelegationDecoder'
import DelegationNode from './DelegationNode'
import permissionsAsBitset from './DelegationNode.utils'

const log = ConfigService.LoggingFactory.getLogger('DelegationBaseNode')

export async function store(
  delegation: IDelegationNode,
  identity: Identity,
  signature: string
): Promise<SubmittableExtrinsic> {
  const blockchain = await BlockchainApiConnection.getConnectionOrConnect()
  const includeParentId: boolean = delegation.parentId
    ? delegation.parentId !== delegation.rootId
    : false
  const tx: SubmittableExtrinsic = blockchain.api.tx.delegation.addDelegation(
    delegation.id,
    delegation.rootId,
    includeParentId ? delegation.parentId : undefined,
    delegation.account,
    permissionsAsBitset(delegation),
    signature
  )
  return blockchain.signTx(identity, tx)
}

export async function query(
  delegationId: IDelegationNode['id']
): Promise<DelegationNode | null> {
  const blockchain = await BlockchainApiConnection.getConnectionOrConnect()
  const decoded = decodeDelegationNode(
    await blockchain.api.query.delegation.delegations<
      Option<IChainDelegationNode>
    >(delegationId)
  )
  if (decoded) {
    const root = new DelegationNode(
      delegationId,
      decoded.rootId,
      decoded.account,
      decoded.permissions,
      decoded.parentId
    )
    root.revoked = decoded.revoked
    return root
  }
  return null
}

/**
 * Revokes part of a delegation tree at specified node, also revoking all nodes below.
 *
 * @param delegationId The id of the node in the delegation tree at which to revoke.
 * @param identity An identity which is authorized to revoke. Either the owner of the current node or of one of the parents.
 * @param maxDepth How many nodes may be traversed upwards in the hierarchy when searching for a node owned by `identity`. Each traversal will add to the transaction fee. Therefore a higher number will increase the fees locked until the transaction is complete. A number lower than the actual required traversals will result in a failed extrinsic (node will not be revoked).
 * @param maxRevocations How many delegation nodes may be revoked during the process. Each revocation adds to the transaction fee. A higher number will require more fees to be locked while an insufficiently high number will lead to premature abortion of the revocation process, leaving some nodes unrevoked. Revocations will first be performed on child nodes, therefore the current node is only revoked when this is accurate.
 * @returns Signed [[SubmittableExtrinsic]] ready to be dispatched.
 */
export async function revoke(
  delegationId: IDelegationNode['id'],
  identity: Identity,
  maxDepth: number,
  maxRevocations: number
): Promise<SubmittableExtrinsic> {
  const blockchain = await BlockchainApiConnection.getConnectionOrConnect()
  const tx: SubmittableExtrinsic = blockchain.api.tx.delegation.revokeDelegation(
    delegationId,
    maxDepth,
    maxRevocations
  )
  return blockchain.signTx(identity, tx)
}

// function lives here to avoid circular imports between DelegationBaseNode and DelegationNode
export async function getChildren(
  delegationNodeId: DelegationBaseNode['id']
): Promise<DelegationNode[]> {
  log.info(` :: getChildren('${delegationNodeId}')`)
  const childIds: string[] = await getChildIds(delegationNodeId)
  const queryResults: Array<CodecWithId<
    Option<IChainDelegationNode>
  >> = await fetchChildren(childIds)
  const children: DelegationNode[] = queryResults
    .map((codec: CodecWithId<Option<IChainDelegationNode>>) => {
      const decoded = decodeDelegationNode(codec.codec)
      if (decoded) {
        const child = new DelegationNode(
          codec.id,
          decoded.rootId,
          decoded.account,
          decoded.permissions,
          decoded.parentId
        )
        child.revoked = decoded.revoked
        return child
      }
      return null
    })
    .filter((value): value is DelegationNode => {
      return value !== null
    })
  log.info(`children: ${JSON.stringify(children)}`)
  return children
}
