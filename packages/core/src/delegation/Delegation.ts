/**
 * Delegations are the building blocks of top-down trust structures in KILT. An Attester can inherit trust through delegation from another attester ("top-down").
 * In order to model these trust hierarchies, a delegation is represented as a **node** in a **delegation tree**.
 *
 * A delegation object is stored on-chain, and can be revoked. A base node is created, a ID which may be used in a [[RequestForAttestation]].
 * A delegation can and may restrict permissions.
 *
 * Permissions:
 *   * Delegate.
 *   * Attest.
 *
 * @packageDocumentation
 * @module DelegationBaseNode
 * @preferred
 */

import type {
  IDelegationBaseNode,
  SubmittableExtrinsic,
} from '@kiltprotocol/types'
import Attestation from '../attestation/Attestation'
import { query } from '../attestation/Attestation.chain'
import Identity from '../identity/Identity'
import { getAttestationHashes } from './Delegation.chain'
import DelegationNode from './DelegationNode'
import DelegationRootNode from './DelegationRootNode'

export default abstract class DelegationBaseNode
  implements IDelegationBaseNode {
  public id: IDelegationBaseNode['id']
  public account: IDelegationBaseNode['account']
  public revoked: IDelegationBaseNode['revoked'] = false

  /**
   * Builds a new [DelegationBaseNode] instance.
   *
   * @param id The unique identifier of the delegation node.
   * @param account The owner address of the delegation node.
   */
  public constructor(
    id: IDelegationBaseNode['id'],
    account: IDelegationBaseNode['account']
  ) {
    this.account = account
    this.id = id
  }

  /**
   * Fetches the root of the delegation tree.
   *
   * @returns Promise containing [[DelegationRootNode]].
   */
  public abstract getRoot(): Promise<DelegationRootNode>

  /**
   * Fetches the parent delegation node. If the parent node is [null] this node is a direct child of the root node.
   *
   * @returns Promise containing the parent node or [null].
   */
  public abstract getParent(): Promise<DelegationBaseNode | null>

  /**
   * Fetches the children nodes of the current node.
   *
   * @returns Promise containing the resolved children nodes.
   */
  public abstract getChildren(): Promise<DelegationNode[]>

  /**
   * Fetches and resolves all attestations attested with this delegation node.
   *
   * @returns Promise containing all resolved attestations attested with this node.
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
   * Fetches all hashes of attestations attested with this delegation node.
   *
   * @returns Promise containing all attestation hashes attested with this node.
   */
  public async getAttestationHashes(): Promise<string[]> {
    return getAttestationHashes(this.id)
  }

  /**
   * Verifies this delegation node by querying it from chain and checking its [revoked] status.
   *
   * @returns Promise containing a boolean flag indicating if the verification succeeded.
   */
  public abstract verify(): Promise<boolean>

  /**
   * Revokes this delegation node on chain.
   *
   * @returns Promise containing a submittable transaction.
   */
  public abstract revoke(identity: Identity): Promise<SubmittableExtrinsic>

  /**
   * Checks on chain whether a given identity is delegating to the current node.
   *
   * @param address The address of the identity.
   * @returns An object containing a node owned by the identity if it is delegating, plus the number of steps traversed.
   */
  public async isDelegating(
    address: Identity['address']
  ): Promise<{ steps: number; node: DelegationBaseNode | null }> {
    if (this.account === address) {
      return {
        steps: 0,
        node: this,
      }
    }
    const parent = await this.getParent()
    if (parent) {
      const result = await parent.isDelegating(address)
      result.steps += 1
      return result
    }
    return {
      steps: 0,
      node: null,
    }
  }

  /**
   * Recursively counts all nodes in the branches below the current node (excluding the current node).
   *
   * @returns Promise resolving to the node count.
   */
  public async subtreeNodeCount(): Promise<number> {
    const children = await this.getChildren()
    if (children.length > 0) {
      const childrensChildCounts = await Promise.all(
        children.map((child) => child.subtreeNodeCount())
      )
      return (
        children.length +
        childrensChildCounts.reduce((previous, current) => previous + current)
      )
    }
    return 0
  }
}
