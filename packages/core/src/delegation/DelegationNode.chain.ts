/**
 * @packageDocumentation
 * @ignore
 */

import { SubmittableExtrinsic } from '@polkadot/api/promise/types'
import { Option } from '@polkadot/types'
import { IDelegationNode } from '@kiltprotocol/types'
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
  const blockchain = await BlockchainApiConnection.getCached()
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
  const blockchain = await BlockchainApiConnection.getCached()
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

export async function revoke(
  delegationId: IDelegationNode['id'],
  identity: Identity
): Promise<SubmittableExtrinsic> {
  const blockchain = await BlockchainApiConnection.getCached()
  const tx: SubmittableExtrinsic = blockchain.api.tx.delegation.revokeDelegation(
    delegationId
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
