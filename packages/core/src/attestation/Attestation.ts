/**
 * An [[Attestation]] certifies a [[Claim]], sent by a claimer in the form of a [[RequestForAttestation]]. [[Attestation]]s are **written on the blockchain** and are **revocable**.
 * Note: once an [[Attestation]] is stored, it can be sent to and stored with the claimer as an [[AttestedClaim]] ("Credential").
 *
 * An [[Attestation]] can be queried from the chain. It's stored on-chain in a map:
 * * the key is the hash of the corresponding claim;
 * * the value is a tuple ([[CType]] hash, account, id of the Delegation, and revoked flag).
 *
 * @packageDocumentation
 * @module Attestation
 * @preferred
 */

import { SubmittableExtrinsic } from '@polkadot/api/promise/types'
import {
  IPublicIdentity,
  IAttestation,
  IRequestForAttestation,
  CompressedAttestation,
} from '@kiltprotocol/types'
import Identity from '../identity/Identity'
import { revoke, query, store, canRevoke } from './Attestation.chain'
import AttestationUtils from './Attestation.utils'
import DelegationRootNode from '../delegation/DelegationRootNode'
import DelegationNode from '../delegation/DelegationNode'

export default class Attestation implements IAttestation {
  /**
   * [STATIC] [ASYNC] Queries the chain for a given attestation, by `claimHash`.
   *
   * @param claimHash - The hash of the claim that corresponds to the attestation to query.
   * @returns A promise containing the [[Attestation]] or null.
   * @example ```javascript
   * Attestation.query('0xd8024cdc147c4fa9221cd177').then((attestation) => {
   *   // now we can for example revoke `attestation`
   * });
   * ```
   */
  public static async query(claimHash: string): Promise<Attestation | null> {
    return query(claimHash)
  }

  /**
   * [STATIC] [ASYNC] Revokes an attestation. Also available as an instance method.
   *
   * @param claimHash - The hash of the claim that corresponds to the attestation to revoke.
   * @param identity - The identity used to revoke the attestation (should be an attester identity, or have delegated rights).
   * @param maxDepth - The number of levels to walk up the delegation hirarchy until the delegation node of identity is found.
   * @returns A promise containing the SubmittableExtrinsic (submittable transaction).
   * @example ```javascript
   * Attestation.revoke('0xd8024cdc147c4fa9221cd177').then(() => {
   *   // the attestation was successfully revoked
   * });
   * ```
   */
  public static async revoke(
    claimHash: string,
    identity: Identity,
    maxDepth: number
  ): Promise<SubmittableExtrinsic> {
    return revoke(claimHash, identity, maxDepth)
  }

  /**
   * [STATIC] Builds an instance of [[Attestation]], from a simple object with the same properties.
   * Used for deserialization.
   *
   * @param attestationInput - The base object from which to create the attestation.
   * @returns A new [[Attestation]] object.
   * @example ```javascript
   * // create an Attestation object, so we can call methods on it (`serialized` is a serialized Attestation object )
   * Attestation.fromAttestation(JSON.parse(serialized));
   * ```
   */
  public static fromAttestation(attestationInput: IAttestation): Attestation {
    return new Attestation(attestationInput)
  }

  /**
   * [STATIC] Builds a new instance of an [[Attestation]], from a complete set of input required for an attestation.
   *
   * @param request - The base request for attestation.
   * @param attesterPublicIdentity - The attesters public identity, used to attest the underlying claim.
   * @returns A new [[Attestation]] object.
   * @example ```javascript
   * // create a complete new attestation from the RequestForAttestation and all other needed properties
   * Attestation.fromRequestAndPublicIdentity(request, attesterPublicIdentity);
   * ```
   */
  public static fromRequestAndPublicIdentity(
    request: IRequestForAttestation,
    attesterPublicIdentity: IPublicIdentity
  ): Attestation {
    return new Attestation({
      claimHash: request.rootHash,
      cTypeHash: request.claim.cTypeHash,
      delegationId: request.delegationId,
      owner: attesterPublicIdentity.address,
      revoked: false,
    })
  }

  /**
   * [STATIC] [ASYNC] Tries to query the delegationId and if successful query the rootId.
   *
   * @param delegationId - The Id of the Delegation stored in [[Attestation]].
   * @returns A promise of either null if querying was not successful or the affiliated [[DelegationRootNode]].
   */
  public static async getDelegationRoot(
    delegationId: IAttestation['delegationId'] | null
  ): Promise<DelegationRootNode | null> {
    if (delegationId) {
      const delegationNode: DelegationNode | null = await DelegationNode.query(
        delegationId
      )
      if (delegationNode) {
        return delegationNode.getRoot()
      }
    }
    return null
  }

  public async getDelegationRoot(): Promise<DelegationRootNode | null> {
    return Attestation.getDelegationRoot(this.delegationId)
  }

  /**
   *  [STATIC] Custom Type Guard to determine input being of type IAttestation using the AttestationUtils errorCheck.
   *
   * @param input The potentially only partial IAttestation.
   * @returns Boolean whether input is of type IAttestation.
   */
  public static isIAttestation(input: unknown): input is IAttestation {
    try {
      AttestationUtils.errorCheck(input as IAttestation)
    } catch (error) {
      return false
    }
    return true
  }

  public claimHash: IAttestation['claimHash']
  public cTypeHash: IAttestation['cTypeHash']
  public delegationId: IAttestation['delegationId'] | null
  public owner: IAttestation['owner']
  public revoked: IAttestation['revoked']

  /**
   * Builds a new [[Attestation]] instance.
   *
   * @param attestationInput - The base object from which to create the attestation.
   * @example ```javascript
   * // create an attestation, e.g. to store it on-chain
   * const attestation = new Attestation(attestationInput);
   * ```
   */
  public constructor(attestationInput: IAttestation) {
    AttestationUtils.errorCheck(attestationInput)
    this.claimHash = attestationInput.claimHash
    this.cTypeHash = attestationInput.cTypeHash
    this.delegationId = attestationInput.delegationId
    this.owner = attestationInput.owner
    this.revoked = attestationInput.revoked
  }

  /**
   * [ASYNC] Stores the attestation on chain.
   *
   * @param identity - The identity used to store the attestation.
   * @returns A promise containing the SubmittableExtrinsic (submittable transaction).
   * @example ```javascript
   * // Use [[store]] to store an attestation on chain, and to create an [[AttestedClaim]] upon success:
   * attestation.store(attester).then(() => {
   *   // the attestation was successfully stored, so now we can for example create an AttestedClaim
   * });
   * ```
   */
  public async store(identity: Identity): Promise<SubmittableExtrinsic> {
    return store(this, identity)
  }

  /**
   * [ASYNC] Revokes the attestation. Also available as a static method.
   *
   * @param identity - The identity used to revoke the attestation (should be an attester identity, or have delegated rights).
   * @param maxDepth - The number of levels to walk up the delegation hirarchy until the delegation node of identity is found.
   * @returns A promise containing the SubmittableExtrinsic (submittable transaction).
   * @example ```javascript
   * attestation.revoke(identity).then(() => {
   *   // the attestation was successfully revoked
   * });
   * ```
   */
  public async revoke(
    identity: Identity,
    maxDepth: number
  ): Promise<SubmittableExtrinsic> {
    return revoke(this.claimHash, identity, maxDepth)
  }

  public async revocableBy(
    address: Identity['address']
  ): ReturnType<typeof canRevoke> {
    return canRevoke(address, this)
  }

  /**
   * [STATIC] [ASYNC] Queries an attestation from the chain and checks its validity.
   *
   * @param attestation - The Attestation to verify.
   * @param claimHash - The hash of the claim that corresponds to the attestation to check. Defaults to the claimHash for the attestation onto which "verify" is called.
   * @returns A promise containing whether the attestation is valid.
   * @example ```javascript
   * attestation.verify().then((isVerified) => {
   *   // `isVerified` is true if the attestation is verified, false otherwise
   * });
   * ```
   */
  public static async checkValidity(
    attestation: IAttestation,
    claimHash: string = attestation.claimHash
  ): Promise<boolean> {
    // Query attestation by claimHash. null if no attestation is found on-chain for this hash
    const chainAttestation: Attestation | null = await Attestation.query(
      claimHash
    )
    return !!(
      chainAttestation !== null &&
      chainAttestation.owner === attestation.owner &&
      !chainAttestation.revoked
    )
  }

  public async checkValidity(): Promise<boolean> {
    return Attestation.checkValidity(this)
  }

  /**
   * Compresses an [[Attestation]] object.
   *
   * @returns An array that contains the same properties of an [[Attestation]].
   */
  public compress(): CompressedAttestation {
    return AttestationUtils.compress(this)
  }

  /**
   * [STATIC] Builds an [[Attestation]] from the decompressed array.
   *
   * @param attestation The [[CompressedAttestation]] that should get decompressed.
   * @returns A new [[Attestation]] object.
   */
  public static decompress(attestation: CompressedAttestation): Attestation {
    const decompressedAttestation = AttestationUtils.decompress(attestation)
    return Attestation.fromAttestation(decompressedAttestation)
  }
}
