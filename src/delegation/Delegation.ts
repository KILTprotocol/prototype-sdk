/**
 *
 * ### Overview
 *
 * Delegations are the building blocks of top-down trust structures in KILT. An attester can inherit trust through delegation from another attester ("top-down"). This helps model real-life trust relationships, e.g. a government clerk can deliver official documents (attestations) on behalf of a governmental organization.
 *
 * In order to model these trust hierarchies, a delegation is represented as a **node** in a **delegation tree**.
 *
 * ### Usage
 *
 * A delegation is stored on-chain, and can be revoked.
 *
 * A Delegation object needs a base node to be created. It has an id which may be used in a [[RequestForAttestation]].
 * @module Delegation
 * @preferred
 */
/**
 * Dummy comment, so that typedoc ignores this file
 */

import { factory } from '../config/ConfigLog'
import Identity from '../identity/Identity'
import { CodecWithId } from './DelegationDecoder'
import Attestation from '../attestation/Attestation'
import TxStatus from '../blockchain/TxStatus'
import { IDelegationBaseNode } from '../types/Delegation'
import DelegationNode from './DelegationNode'
import DelegationRootNode from './DelegationRootNode'
import {
  getAttestationHashes,
  fetchChildren,
  getChildIds,
} from './Delegation.chain'
import { query } from '../attestation/Attestation.chain'
import { QueryResult } from '../blockchain/Blockchain'

const log = factory.getLogger('DelegationBaseNode')

export default abstract class DelegationBaseNode
  implements IDelegationBaseNode {
  public id: IDelegationBaseNode['id']
  public account: IDelegationBaseNode['account']
  public revoked: IDelegationBaseNode['revoked'] = false

  /**
   * @description Builds a new [DelegationBaseNode] instance.
   * @param id the unique identifier of the delegation node
   * @param account the owner address of the delegation node
   */
  public constructor(
    id: IDelegationBaseNode['id'],
    account: IDelegationBaseNode['account']
  ) {
    this.account = account
    this.id = id
  }

  /**
   * @description Fetches the root of the delegation tree.
   * @returns promise containing [[DelegationRootNode]]
   */
  public abstract getRoot(): Promise<DelegationRootNode>

  /**
   * @description Fetches the parent delegation node. If the parent node is [undefined] this node is a direct child of the root node.
   * @returns promise containing the parent node or [undefined]
   */
  public abstract getParent(): Promise<DelegationBaseNode | undefined>

  /**
   * @description Fetches the children nodes of the current node.
   * @returns promise containing the resolved children nodes
   */
  public async getChildren(): Promise<DelegationNode[]> {
    log.info(` :: getChildren('${this.id}')`)
    const childIds: string[] = await getChildIds(this.id)
    const queryResults: CodecWithId[] = await fetchChildren(childIds)
    const children: DelegationNode[] = queryResults
      .map((codec: CodecWithId) => {
        const decoded: DelegationNode | undefined = this.decodeChildNode(
          codec.codec
        )
        if (decoded) {
          decoded.id = codec.id
        }
        return decoded
      })
      .filter((value): value is DelegationNode => {
        return value !== undefined
      })
    log.info(`children: ${JSON.stringify(children)}`)
    return children
  }

  /**
   * @description Fetches and resolves all attestations attested with this delegation node.
   * @returns promise containing all resolved attestations attested with this node
   */
  public async getAttestations(): Promise<Attestation[]> {
    const attestationHashes = await this.getAttestationHashes()
    const attestations = await Promise.all(
      attestationHashes.map((claimHash: string) => {
        return query(claimHash)
      })
    )

    return attestations.filter((value): value is Attestation => !!value)
  }

  /**
   * @description Fetches all hashes of attestations attested with this delegation node.
   * @returns promise containing all attestation hashes attested with this node
   */
  public async getAttestationHashes(): Promise<string[]> {
    return getAttestationHashes(this.id)
  }

  /**
   * @description Verifies this delegation node by querying it from chain and checking its [revoked] status.
   * @returns promise containing a boolean flag indicating if the verification succeeded
   */
  public abstract verify(): Promise<boolean>

  /**
   * @description Revokes this delegation node on chain.
   * @returns promise containing the transaction status
   */
  public abstract revoke(identity: Identity): Promise<TxStatus>

  /**
   * Required to avoid cyclic dependencies btw. DelegationBaseNode and DelegationNode implementations.
   */
  protected abstract decodeChildNode(
    queryResult: QueryResult
  ): DelegationNode | undefined
}
