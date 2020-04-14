/**
 * Delegation nodes are used within the KILT protocol to construct the trust hierarchy.
 *
 * Starting from the root node, entities can delegate the right to issue attestations to Claimers for a certain CTYPE and also delegate the right to attest and to delegate further nodes.
 *
 * @packageDocumentation
 * @module DelegationNode
 * @preferred
 */

import { SubmittableResult } from '@polkadot/api'
import Crypto from '../crypto'
import { QueryResult } from '../blockchain/Blockchain'
import { factory } from '../config/ConfigLog'
import { coToUInt8, u8aConcat, u8aToHex } from '../crypto/Crypto'
import Identity from '../identity/Identity'
import DelegationBaseNode from './Delegation'
import { decodeDelegationNode } from './DelegationDecoder'
import DelegationRootNode from './DelegationRootNode'
import { IDelegationNode } from '../types/Delegation'
import permissionsAsBitset from './DelegationNode.utils'
import { query, store, revoke } from './DelegationNode.chain'
import { query as queryRoot } from './DelegationRootNode.chain'

const log = factory.getLogger('DelegationNode')

export default class DelegationNode extends DelegationBaseNode
  implements IDelegationNode {
  /**
   * Queries the delegation node with [delegationId].
   *
   * @param delegationId The unique identifier of the desired delegation.
   * @returns Promise containing the [[DelegationNode]] or [null].
   */
  public static async query(
    delegationId: string
  ): Promise<DelegationNode | null> {
    log.info(`:: query('${delegationId}')`)
    const result = await query(delegationId)
    log.info(`result: ${JSON.stringify(result)}`)
    return result
  }

  public rootId: IDelegationNode['rootId']
  public parentId?: IDelegationNode['parentId']
  public permissions: IDelegationNode['permissions']

  /**
   * Creates a new [DelegationNode].
   *
   * @param id A unique identifier.
   * @param rootId Identifier of the root delegation node that is already stored on-chain.
   * @param account Address of the account that will be the owner of the delegation.
   * @param permissions List of [[Permission]]s.
   * @param parentId Identifier of the parent delegation node already stored on-chain. Not required when the parent is the root node.
   */
  public constructor(
    id: IDelegationNode['id'],
    rootId: IDelegationNode['rootId'],
    account: IDelegationNode['account'],
    permissions: IDelegationNode['permissions'],
    parentId?: IDelegationNode['parentId']
  ) {
    super(id, account)
    this.permissions = permissions
    this.rootId = rootId
    this.parentId = parentId
  }

  /**
   *
   * Generates the delegation hash from the delegations' property values.
   *
   * This hash is signed by the delegate and later stored along with the delegation to
   * make sure delegation data (such as permissions) is not tampered.
   *
   * @example
   * ```
   * const delegate: Identity = ...
   * const signature:string = delegate.signStr(newDelegationNode.generateHash())
   *
   * const myIdentity: Identity = ...
   * newDelegationNode.store(myIdentity, signature)
   * ```
   *
   * @returns The hash representation of this delegation as a hex string.
   */
  public generateHash(): string {
    const propsToHash: Array<Uint8Array | string> = [this.id, this.rootId]
    if (this.parentId && this.parentId !== this.rootId) {
      propsToHash.push(this.parentId)
    }
    const uint8Props: Uint8Array[] = propsToHash.map((value) => {
      return coToUInt8(value)
    })
    uint8Props.push(permissionsAsBitset(this))
    const generated: string = u8aToHex(
      Crypto.hash(u8aConcat(...uint8Props), 256)
    )
    log.debug(`generateHash(): ${generated}`)
    return generated
  }

  /**
   * Fetches the root of this delegation node.
   *
   * @returns Promise containing the [[DelegationRootNode]] of this delegation node.
   */
  public async getRoot(): Promise<DelegationRootNode> {
    const rootNode = await queryRoot(this.rootId)
    if (!rootNode) {
      throw new Error(`Could not find root node with id ${this.rootId}`)
    }
    return rootNode
  }

  /**
   * Fetches the parent node of this delegation node.
   *
   * @returns Promise containing the parent as [[DelegationBaseNode]] or [null].
   */

  public async getParent(): Promise<DelegationBaseNode | null> {
    if (!this.parentId) {
      // parent must be root
      return this.getRoot()
    }
    return query(this.parentId)
  }

  /**
   * Stores the delegation node on chain.
   *
   * @param identity Account used to store the delegation node.
   * @param signature Signature of the delegate to ensure it's done under his permission.
   * @returns Promise containing the [[SubmittableResult]].
   */
  public async store(
    identity: Identity,
    signature: string
  ): Promise<SubmittableResult> {
    log.info(`:: store(${this.id})`)
    return store(this, identity, signature)
  }

  /**
   * Verifies the delegation node by querying it from chain and checking its revoke status.
   *
   * @returns Promise containing a boolean flag.
   */
  public async verify(): Promise<boolean> {
    const node = await query(this.id)
    return node !== null && !node.revoked
  }

  /**
   * Revokes the delegation node on chain.
   *
   * @param identity The identity used to revoke the delegation.
   * @returns Promise containing the [[SubmittableResult]].
   */
  public async revoke(identity: Identity): Promise<SubmittableResult> {
    log.debug(`:: revoke(${this.id})`)
    return revoke(this.id, identity)
  }

  /* eslint-disable class-methods-use-this */
  protected decodeChildNode(queryResult: QueryResult): DelegationNode | null {
    return decodeDelegationNode(queryResult)
  }
  /* eslint-enable class-methods-use-this */
}
