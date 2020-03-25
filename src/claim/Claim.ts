/**
 * Claims are a core building block of the KILT SDK. A claim represents **something an entity claims about itself**. Once created, a claim can be used to create a [[RequestForAttestation]].
 *
 * A claim object has:
 * * contents - among others, the pure content of a claim, for example `"isOver18": yes`;
 * * a [[CType]] that represents its data structure.
 *
 * A claim object's owner is (should be) the same entity as the claimer.
 *
 * @packageDocumentation
 * @module Claim
 * @preferred
 */

import { validateAddress, validateHash } from '../util/DataUtils'
import ICType from '../ctype/CType'
import CTypeUtils from '../ctype/CType.utils'
import IClaim, { CompressedClaim } from '../types/Claim'
import IPublicIdentity from '../types/PublicIdentity'
import ClaimUtils from './Claim.utils'

function verifyClaim(
  claimContents: object,
  cTypeSchema: ICType['schema']
): boolean {
  return CTypeUtils.verifyClaimStructure(claimContents, cTypeSchema)
}

export default class Claim implements IClaim {
  public static fromClaim(
    claimInput: IClaim,
    cTypeSchema: ICType['schema']
  ): Claim {
    if (!verifyClaim(claimInput.contents, cTypeSchema)) {
      throw Error('Claim not valid')
    }

    return new Claim(claimInput)
  }

  public static fromCTypeAndClaimContents(
    ctypeInput: ICType,
    claimContents: object,
    claimOwner: IPublicIdentity['address']
  ): Claim {
    if (ctypeInput.schema) {
      if (!verifyClaim(claimContents, ctypeInput.schema)) {
        throw Error('Claim not valid')
      }
    }
    return new Claim({
      cTypeHash: ctypeInput.hash,
      contents: claimContents,
      owner: claimOwner,
    })
  }

  static isIClaim(input: IClaim): input is IClaim {
    if (!input.cTypeHash || !input.contents || !input.owner) {
      throw new Error('property of provided Claim not set')
    }
    validateAddress(input.owner, 'Claim Owner')
    validateHash(input.cTypeHash, 'Claim CType')
    // TODO: check whether ctype hash is on chain, access schema and verify Claim Structure
    return true
  }

  public cTypeHash: IClaim['cTypeHash']
  public contents: IClaim['contents']
  public owner: IClaim['owner']

  public constructor(claimInput: IClaim) {
    Claim.isIClaim(claimInput)
    this.cTypeHash = claimInput.cTypeHash
    this.contents = claimInput.contents
    this.owner = claimInput.owner
  }

  /**
   * Compresses an [[Claim]] object from the [[CompressedClaim]].
   *
   * @returns An array that contains the same properties of an [[Claim]].
   */

  public compress(): CompressedClaim {
    return ClaimUtils.compress(this)
  }

  /**
   * [STATIC] Builds an [[Claim]] from the decompressed array.
   *
   * @returns A new [[Claim]] object.
   */

  public static decompress(compressedClaim: CompressedClaim): Claim {
    const decompressedClaim = ClaimUtils.decompress(compressedClaim)
    return new Claim(decompressedClaim)
  }
}
