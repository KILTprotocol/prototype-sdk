/**
 * Requests for attestation are a core building block of the KILT SDK.
 * A RequestForAttestation represents a [[Claim]] which needs to be validated. In practice, the RequestForAttestation is sent from a claimer to an attester.
 *
 * A RequestForAttestation object contains the [[Claim]] and its hash, and legitimations/delegationId of the attester.
 * It's signed by the claimer, to make it tamperproof (`claimerSignature` is a property of [[Claim]]).
 * A RequestForAttestation also supports hiding of claim data during a credential presentation.
 *
 * @packageDocumentation
 * @module RequestForAttestation
 * @preferred
 */

import { v4 as uuid } from 'uuid'
import {
  GabiClaimer,
  AttesterPublicKey,
  AttestationRequest,
  ClaimerAttestationSession,
} from '@kiltprotocol/portablegabi'
import { IInitiateAttestation } from '../messaging/Message'
import {
  verify,
  hash,
  coToUInt8,
  u8aToHex,
  u8aConcat,
  hashObjectAsStr,
} from '../crypto/Crypto'

import Identity from '../identity/Identity'
import IClaim from '../claim/Claim'
import AttestedClaim from '../attestedclaim/AttestedClaim'
import IRequestForAttestation, {
  Hash,
  NonceHash,
} from '../types/RequestForAttestation'
import { IDelegationBaseNode } from '../types/Delegation'

function hashNonceValue(nonce: string, value: any): string {
  return hashObjectAsStr(value, nonce)
}

function generateHash(value: any): NonceHash {
  const nonce: string = uuid()
  return {
    nonce,
    hash: hashNonceValue(nonce, value),
  }
}

function generateHashTree(contents: object): object {
  const result = {}

  Object.keys(contents).forEach(key => {
    result[key] = generateHash(contents[key])
  })

  return result
}

function verifyClaimerSignature(rfa: RequestForAttestation): boolean {
  return verify(rfa.rootHash, rfa.claimerSignature, rfa.claim.owner)
}

function getHashRoot(leaves: Uint8Array[]): Uint8Array {
  const result = u8aConcat(...leaves)
  return hash(result)
}

export default class RequestForAttestation implements IRequestForAttestation {
  /**
   * [STATIC] Builds an instance of [[RequestForAttestation]], from a simple object with the same properties.
   * Used for deserialization.
   *
   * @param requestForAttestationInput - An object built from simple [[Claim]], [[Identity]] and legitimation objects.
   * @returns  A new [[RequestForAttestation]] `object`.
   * @example ```javascript
   * const serializedRequest =
   *   '{ "claim": { "cType": "0x981...", "contents": { "name": "Alice", "age": 29 }, owner: "5Gf..." }, ... }, ... }';
   * const parsedRequest = JSON.parse(serializedRequest);
   * RequestForAttestation.fromRequest(parsedRequest);
   * ```
   */
  public static fromRequest(
    requestForAttestationInput: IRequestForAttestation
  ): RequestForAttestation {
    return new RequestForAttestation(requestForAttestationInput)
  }

  /**
   * [STATIC] Builds a new instance of [[RequestForAttestation]], from a complete set of required parameters.
   *
   * @param claimInput - An `IClaim` object the request for attestation is built for.
   * @param identity - The Claimer's [Identity].
   * @param legitimationsInput - Array of [AttestedClaim] objects of the Attester which the Claimer requests to include into the attestation as legitimations.
   * @param delegationIdInput - The id of the DelegationNode of the Attester, which should be used in the attestation.
   * @param privacyEnhanced - If true a privacy enhanced attestation is requested in addition to a normal attestation.
   * @returns  A new [[RequestForAttestation]] object.
   */
  public static async fromClaimAndIdentity(
    claimInput: IClaim,
    identity: Identity,
    legitimationsInput: AttestedClaim[] = [],
    delegationIdInput: IDelegationBaseNode['id'] | null = null,
    privacyEnhanced = true,
    initiateAttestationMsg: IInitiateAttestation | null = null,
    attesterPubKey: AttesterPublicKey | null = null
  ): Promise<[RequestForAttestation, ClaimerAttestationSession | null]> {
    if (claimInput.owner !== identity.address) {
      throw Error('Claim owner is not Identity')
    }

    let peRequest: AttestationRequest | null = null
    let session: ClaimerAttestationSession | null = null
    if (
      privacyEnhanced &&
      initiateAttestationMsg !== null &&
      attesterPubKey !== null
    ) {
      // TODO: FIXME: how to generate keys?
      // FIXME: Check message type!?
      const claimer = await GabiClaimer.create()
      const peSessionMessage = await claimer.requestAttestation({
        claim: claimInput,
        startAttestationMsg: initiateAttestationMsg.content,
        attesterPubKey,
      })
      peRequest = peSessionMessage.message
      session = peSessionMessage.session
    } else if (privacyEnhanced) {
      throw new Error(`Required InitiateAttestationRequest (was ${initiateAttestationMsg}) 
      and public key (was ${attesterPubKey}) for privacy enhanced attestation`)
    }
    const claimOwnerGenerated = generateHash(claimInput.owner)
    const cTypeHashGenerated = generateHash(claimInput.cTypeHash)
    const claimHashTreeGenerated = generateHashTree(claimInput.contents)
    const calculatedRootHash = RequestForAttestation.calculateRootHash(
      claimOwnerGenerated,
      cTypeHashGenerated,
      claimHashTreeGenerated,
      legitimationsInput,
      delegationIdInput
    )
    let legitimations: AttestedClaim[] = []
    if (Array.isArray(legitimationsInput)) {
      legitimations = legitimationsInput
    }

    return [
      new RequestForAttestation({
        claim: claimInput,
        legitimations,
        claimOwner: claimOwnerGenerated,
        claimHashTree: claimHashTreeGenerated,
        cTypeHash: cTypeHashGenerated,
        rootHash: calculatedRootHash,
        claimerSignature: RequestForAttestation.sign(
          identity,
          calculatedRootHash
        ),
        delegationId: delegationIdInput,
        privacyEnhanced: peRequest,
      }),
      session,
    ]
  }

  public claim: IClaim
  public legitimations: AttestedClaim[]
  public claimOwner: NonceHash
  public claimerSignature: string
  public claimHashTree: object
  public cTypeHash: NonceHash
  public rootHash: Hash
  public privacyEnhanced: AttestationRequest | null
  public delegationId: IDelegationBaseNode['id'] | null

  /**
   * Builds a new [[RequestForAttestation]] instance.
   *
   * @param requestForAttestationInput - The base object from which to create the requestForAttestation.
   * @example ```javascript
   * // create a new request for attestation
   * const rfa = new RequestForAttestation(requestForAttestationInput);
   * ```
   */
  public constructor(requestForAttestationInput: IRequestForAttestation) {
    if (
      !requestForAttestationInput.claim ||
      !requestForAttestationInput.legitimations ||
      !requestForAttestationInput.claimOwner ||
      !requestForAttestationInput.claimerSignature ||
      !requestForAttestationInput.claimHashTree ||
      !requestForAttestationInput.cTypeHash ||
      !requestForAttestationInput.rootHash ||
      typeof requestForAttestationInput.privacyEnhanced === 'undefined'
    ) {
      throw new Error(
        `Property Not Provided while building RequestForAttestation:\n
          requestInput.claim: 
          ${requestForAttestationInput.claim}\n
          requestInput.legitimations: 
          ${requestForAttestationInput.legitimations}\n
          requestInput.claimOwner: 
          ${requestForAttestationInput.claimOwner}\n
          requestInput.claimerSignature: 
          ${requestForAttestationInput.claimerSignature}
          requestInput.claimHashTree: 
          ${requestForAttestationInput.claimHashTree}\n
          requestInput.rootHash: 
          ${requestForAttestationInput.rootHash}\n
          requestInput.cTypeHash: 
          ${requestForAttestationInput.cTypeHash}\n
          requestInput.privacyEnhanced: 
          ${requestForAttestationInput.privacyEnhanced}\n`
      )
    }
    this.claim = requestForAttestationInput.claim
    this.claimOwner = requestForAttestationInput.claimOwner
    this.cTypeHash = requestForAttestationInput.cTypeHash
    if (
      typeof requestForAttestationInput.legitimations !== 'undefined' &&
      Array.isArray(requestForAttestationInput.legitimations) &&
      requestForAttestationInput.legitimations.length
    ) {
      this.legitimations = requestForAttestationInput.legitimations.map(
        legitimation => AttestedClaim.fromAttestedClaim(legitimation)
      )
    } else {
      this.legitimations = []
    }
    this.delegationId = requestForAttestationInput.delegationId
    this.claimHashTree = requestForAttestationInput.claimHashTree
    this.rootHash = requestForAttestationInput.rootHash
    this.claimerSignature = requestForAttestationInput.claimerSignature
    this.verifySignature()
    this.verifyData()
    this.privacyEnhanced = requestForAttestationInput.privacyEnhanced
  }

  /**
   * Removes [[Claim]] properties from the [[RequestForAttestation]] object, provides anonymity and security when building the [[createPresentation]] method.
   *
   * @param properties - Properties to remove from the [[Claim]] object.
   * @throws An error when a property which should be deleted wasn't found.
   * @example ```javascript
   * const rawClaim = {
   *   name: 'Alice',
   *   age: 29,
   * };
   * const claim = Claim.fromCTypeAndClaimContents(ctype, rawClaim, alice);
   * const reqForAtt = RequestForAttestation.fromClaimAndIdentity(
   *   claim,
   *   alice,
   *   [],
   *   null
   * );
   * reqForAtt.removeClaimProperties(['name']);
   * // reqForAtt does not contain `name` in its claimHashTree and its claim contents anymore.
   * ```
   */
  public removeClaimProperties(properties: string[]): void {
    properties.forEach(key => {
      if (!this.claimHashTree[key]) {
        throw Error(`Property '${key}' not found in claim`)
      }
      delete this.claim.contents[key]
      delete this.claimHashTree[key].nonce
    })
  }

  /**
   * Removes the [[Claim]] owner from the [[RequestForAttestation]] object.
   *
   * @example ```javascript
   * const reqForAtt = RequestForAttestation.fromClaimAndIdentity(
   *   claim,
   *   alice,
   *   [],
   *   null
   * );
   * reqForAtt.removeClaimOwner();
   * // `requestForAttestation` does not contain the claim `owner` or the `claimOwner`'s nonce anymore.
   * ```
   */
  public removeClaimOwner(): void {
    delete this.claim.owner
    delete this.claimOwner.nonce
  }

  /**
   * Verifies the data of the [[RequestForAttestation]] object; used to check that the data was not tampered with, by checking the data against hashes.
   *
   * @returns Whether the data is valid.
   * @example ```javascript
   * const reqForAtt = RequestForAttestation.fromClaimAndIdentity(
   *   claim,
   *   alice,
   *   [],
   *   null
   * );
   * reqForAtt.verifyData(); // returns true if the data is correct
   * ```
   */
  public verifyData(): boolean {
    // check claim hash
    if (
      this.rootHash !==
      RequestForAttestation.calculateRootHash(
        this.claimOwner,
        this.cTypeHash,
        this.claimHashTree,
        this.legitimations,
        this.delegationId
      )
    ) {
      return false
    }
    // check claim owner hash
    if (this.claim.owner) {
      if (
        this.claimOwner.hash !==
        hashNonceValue(this.claimOwner.nonce, this.claim.owner)
      ) {
        throw Error('Invalid hash for claim owner')
      }
    }

    // check cType hash
    if (
      this.cTypeHash.hash !==
      hashNonceValue(this.cTypeHash.nonce, this.claim.cTypeHash)
    ) {
      throw Error('Invalid hash for CTYPE')
    }

    // check all hashes for provided claim properties
    Object.keys(this.claim.contents).forEach(key => {
      const value = this.claim.contents[key]
      if (!this.claimHashTree[key]) {
        throw Error(`Property '${key}' not in claim hash tree`)
      }
      const hashed: NonceHash = this.claimHashTree[key]
      if (hashed.hash !== hashNonceValue(hashed.nonce, value)) {
        throw Error(`Invalid hash for property '${key}' in claim hash tree`)
      }
    })

    // check legitimations
    let valid = true
    if (this.legitimations) {
      this.legitimations.forEach(legitimation => {
        valid = valid && legitimation.verifyData()
      })
    }
    if (!valid) {
      return false
    }

    // check signature
    return this.verifySignature()
  }

  /**
   * Verifies the signature of the [[RequestForAttestation]] object.
   *
   * @returns Whether the signature is correct.
   * @example ```javascript
   * const reqForAtt = RequestForAttestation.fromClaimAndIdentity(
   *   claim,
   *   alice,
   *   [],
   *   null
   * );
   * reqForAtt.verifySignature(); // returns `true` if the signature is correct
   * ```
   */
  public verifySignature(): boolean {
    return verifyClaimerSignature(this)
  }

  private static sign(identity: Identity, rootHash: Hash): string {
    return identity.signStr(rootHash)
  }

  private static getHashLeaves(
    claimOwner: NonceHash,
    cTypeHash: NonceHash,
    claimHashTree: object,
    legitimations: AttestedClaim[],
    delegationId: IDelegationBaseNode['id'] | null
  ): Uint8Array[] {
    const result: Uint8Array[] = []
    result.push(coToUInt8(claimOwner.hash))
    result.push(coToUInt8(cTypeHash.hash))
    Object.keys(claimHashTree).forEach(key => {
      result.push(coToUInt8(claimHashTree[key].hash))
    })
    if (legitimations) {
      legitimations.forEach(legitimation => {
        result.push(coToUInt8(legitimation.getHash()))
      })
    }
    if (delegationId) {
      result.push(coToUInt8(delegationId))
    }

    return result
  }

  private static calculateRootHash(
    claimOwner: NonceHash,
    cTypeHash: NonceHash,
    claimHashTree: object,
    legitimations: AttestedClaim[],
    delegationId: IDelegationBaseNode['id'] | null
  ): Hash {
    const hashes: Uint8Array[] = RequestForAttestation.getHashLeaves(
      claimOwner,
      cTypeHash,
      claimHashTree,
      legitimations,
      delegationId
    )
    const root: Uint8Array =
      hashes.length === 1 ? hashes[0] : getHashRoot(hashes)
    return u8aToHex(root)
  }
}
