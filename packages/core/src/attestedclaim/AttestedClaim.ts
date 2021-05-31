/**
 * In KILT, an [[AttestedClaim]] is a **credential**, which a Claimer can store locally and share with Verifiers as they wish.
 *
 * Once a [[RequestForAttestation]] has been made, the [[Attestation]] can be built and the Attester submits it wrapped in an [[AttestedClaim]] object.
 * This [[AttestedClaim]] also contains the original request for attestation.
 * RequestForAttestation also exposes a [[createPresentation]] method, that can be used by the claimer to hide some specific information from the verifier for more privacy.
 *
 * @packageDocumentation
 * @module AttestedClaim
 */

import type {
  IAttestedClaim,
  CompressedAttestedClaim,
  IAttestation,
  IRequestForAttestation,
  IPresentationOptions,
  IPresentationSigningOptions,
} from '@kiltprotocol/types'
import { SDKErrors } from '@kiltprotocol/utils'
import Attestation from '../attestation/Attestation'
import RequestForAttestation from '../requestforattestation/RequestForAttestation'
import AttestedClaimUtils from './AttestedClaim.utils'
import { Presentation, SignedPresentation } from './Presentation'

export default class AttestedClaim implements IAttestedClaim {
  /**
   * [STATIC] Builds an instance of [[AttestedClaim]], from a simple object with the same properties.
   * Used for deserialization.
   *
   * @param attestedClaimInput - The base object from which to create the attested claim.
   * @returns A new instantiated [[AttestedClaim]] object.
   * @example ```javascript
   * // create an AttestedClaim object, so we can call methods on it (`serialized` is a serialized AttestedClaim object)
   * AttestedClaim.fromAttestedClaim(JSON.parse(serialized));
   * ```
   */
  public static fromAttestedClaim(
    attestedClaimInput: IAttestedClaim
  ): AttestedClaim {
    return new AttestedClaim(attestedClaimInput)
  }

  /**
   * [STATIC] Builds a new instance of [[AttestedClaim]], from all required properties.
   *
   * @param request - The request for attestation for the claim that was attested.
   * @param attestation - The attestation for the claim by the attester.
   * @returns A new [[AttestedClaim]] object.
   * @example ```javascript
   * // create an AttestedClaim object after receiving the attestation from the attester
   * AttestedClaim.fromRequestAndAttestation(request, attestation);
   * ```
   */
  public static fromRequestAndAttestation(
    request: IRequestForAttestation,
    attestation: IAttestation
  ): AttestedClaim {
    return new AttestedClaim({
      request,
      attestation,
    })
  }

  /**
   *  [STATIC] Custom Type Guard to determine input being of type IAttestedClaim using the AttestedClaimUtils errorCheck.
   *
   * @param input The potentially only partial IAttestedClaim.
   *
   * @returns Boolean whether input is of type IAttestedClaim.
   */
  public static isIAttestedClaim(input: unknown): input is IAttestedClaim {
    try {
      AttestedClaimUtils.errorCheck(input as IAttestedClaim)
    } catch (error) {
      return false
    }
    return true
  }

  public request: RequestForAttestation
  public attestation: Attestation

  /**
   * Builds a new [[AttestedClaim]] instance.
   *
   * @param attestedClaimInput - The base object with all required input, from which to create the attested claim.
   * @example ```javascript
   * // Create an `AttestedClaim` upon successful `Attestation` creation:
   * const credential = new AttestedClaim(attestedClaimInput);
   * ```
   */
  public constructor(attestedClaimInput: IAttestedClaim) {
    AttestedClaimUtils.errorCheck(attestedClaimInput)
    this.request = RequestForAttestation.fromRequest(attestedClaimInput.request)
    this.attestation = Attestation.fromAttestation(
      attestedClaimInput.attestation
    )
  }

  /**
   * (ASYNC) Verifies whether the attested claim is valid. It is valid if:
   * * the data is valid (see [[verifyData]]);
   * and
   * * the [[Attestation]] object for this attested claim is valid (see [[Attestation.checkValidity]], where the **chain** is queried).
   *
   * Upon presentation of an attested claim, a verifier would call this [[verify]] function.
   *
   * @param attestedClaim - The attested claim to check for validity.
   * @returns A promise containing whether this attested claim is valid.
   * @example ```javascript
   * attestedClaim.verify().then((isVerified) => {
   *   // `isVerified` is true if the attestation is verified, false otherwise
   * });
   * ```
   */
  public static async verify(attestedClaim: IAttestedClaim): Promise<boolean> {
    return (
      AttestedClaim.verifyData(attestedClaim) &&
      Attestation.checkValidity(attestedClaim.attestation)
    )
  }

  public async verify(): Promise<boolean> {
    return AttestedClaim.verify(this)
  }

  /**
   * Verifies whether the data of the given attested claim is valid. It is valid if:
   * * the [[RequestForAttestation]] object associated with this attested claim has valid data (see [[RequestForAttestation.verifyData]]);
   * and
   * * the hash of the [[RequestForAttestation]] object for the attested claim, and the hash of the [[Claim]] for the attested claim are the same.
   *
   * @param attestedClaim - The attested claim to verify.
   * @returns Whether the attested claim's data is valid.
   * @example ```javascript
   * const verificationResult = attestedClaim.verifyData();
   * ```
   */
  public static verifyData(attestedClaim: IAttestedClaim): boolean {
    if (
      attestedClaim.request.claim.cTypeHash !==
      attestedClaim.attestation.cTypeHash
    )
      return false
    return (
      attestedClaim.request.rootHash === attestedClaim.attestation.claimHash &&
      RequestForAttestation.verifyData(attestedClaim.request)
    )
  }

  public verifyData(): boolean {
    return AttestedClaim.verifyData(this)
  }

  /**
   *  [STATIC] Verifies the data of each element of the given Array of IAttestedClaims.
   *
   * @param legitimations Array of IAttestedClaims to validate.
   * @throws [[ERROR_LEGITIMATIONS_UNVERIFIABLE]] when one of the IAttestedClaims data is unable to be verified.
   *
   * @returns Boolean whether each element of the given Array of IAttestedClaims is verifiable.
   */
  public static validateLegitimations(
    legitimations: IAttestedClaim[]
  ): boolean {
    legitimations.forEach((legitimation: IAttestedClaim) => {
      if (!AttestedClaim.verifyData(legitimation)) {
        throw SDKErrors.ERROR_LEGITIMATIONS_UNVERIFIABLE()
      }
    })
    return true
  }

  /**
   * Gets the hash of the claim that corresponds to this attestation.
   *
   * @returns The hash of the claim for this attestation (claimHash).
   * @example ```javascript
   * attestation.getHash();
   * ```
   */
  public getHash(): string {
    return this.attestation.claimHash
  }

  public getAttributes(): Set<string> {
    // TODO: move this to claim or contents
    return new Set(Object.keys(this.request.claim.contents))
  }

  public createPresentation({
    showAttributes,
    hideAttributes = [],
    signer,
    challenge,
  }: IPresentationOptions & Partial<IPresentationSigningOptions> = {}):
    | Presentation
    | SignedPresentation {
    const allAttributes = Array.from(this.getAttributes())
    const excludedClaimProperties = showAttributes
      ? allAttributes.filter((i) => !showAttributes.includes(i))
      : []
    excludedClaimProperties.push(...hideAttributes)
    const deepCopy = new AttestedClaim(JSON.parse(JSON.stringify(this)))
    deepCopy.request.removeClaimProperties(excludedClaimProperties)
    const signingOpts = signer && challenge ? { signer, challenge } : undefined
    return Presentation.fromAttestedClaims([deepCopy], signingOpts)
  }

  /**
   * Compresses an [[AttestedClaim]] object.
   *
   * @returns An array that contains the same properties of an [[AttestedClaim]].
   */
  public compress(): CompressedAttestedClaim {
    return AttestedClaimUtils.compress(this)
  }

  /**
   * [STATIC] Builds an [[AttestedClaim]] from the decompressed array.
   *
   * @param attestedClaim The [[CompressedAttestedClaim]] that should get decompressed.
   * @returns A new [[AttestedClaim]] object.
   */
  public static decompress(
    attestedClaim: CompressedAttestedClaim
  ): AttestedClaim {
    const decompressedAttestedClaim = AttestedClaimUtils.decompress(
      attestedClaim
    )
    return AttestedClaim.fromAttestedClaim(decompressedAttestedClaim)
  }
}
