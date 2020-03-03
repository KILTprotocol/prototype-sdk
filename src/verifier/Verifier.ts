import {
  CombinedRequestBuilder,
  CombinedVerificationSession,
  Verifier,
  Accumulator,
  AttesterPublicKey,
} from '@kiltprotocol/portablegabi'
import CType from '../ctype/CType'
import {
  IRequestClaimsForCTypes,
  MessageBodyType,
  ISubmitClaimsForCTypesPE,
  ISubmitClaimsForCTypes,
} from '../messaging/Message'
import AttestedClaim from '../attestedclaim/AttestedClaim'

export class PresentationRequestBuilder {
  private builder: CombinedRequestBuilder
  private ctypes: Array<CType['hash']>
  constructor() {
    this.builder = new CombinedRequestBuilder()
    this.ctypes = []
  }

  public requestPresentationForCtype({
    ctypeHash,
    attributes,
    legitimations,
    delegationId,
    reqUpdatedAfter,
  }: {
    attributes: string[]
    ctypeHash: CType['hash']
    legitimations?: boolean
    delegationId?: boolean
    reqUpdatedAfter?: Date
  }): PresentationRequestBuilder {
    const rawAttribute = attributes.map(attr => `claim.contents.${attr}`)
    rawAttribute.push('claim.cTypeHash')
    if (typeof legitimations !== 'undefined' && legitimations) {
      rawAttribute.push('legitimation')
    }
    if (typeof delegationId !== 'undefined' && delegationId) {
      rawAttribute.push('delegationId')
    }
    this.builder.requestPresentation({
      requestedAttributes: rawAttribute,
      reqUpdatedAfter,
    })
    this.ctypes.push(ctypeHash)
    return this
  }

  public async finalize(
    allowPE: boolean
  ): Promise<[CombinedVerificationSession, IRequestClaimsForCTypes]> {
    const { session, message } = await this.builder.finalise()
    return [
      session,
      {
        type: MessageBodyType.REQUEST_CLAIMS_FOR_CTYPES,
        content: {
          ctypes: this.ctypes,
          peRequest: message,
          allowPE,
        },
      },
    ]
  }
}

export function newRequest(): PresentationRequestBuilder {
  return new PresentationRequestBuilder()
}

export async function verifyPresentation(
  presentation: ISubmitClaimsForCTypesPE | ISubmitClaimsForCTypes,
  session?: CombinedVerificationSession,
  latestAccumulators?: Accumulator[],
  attesterPubKeys?: AttesterPublicKey[]
): Promise<[boolean, any[]]> {
  if (presentation.type === MessageBodyType.SUBMIT_CLAIMS_FOR_CTYPES) {
    const attestedClaims = presentation.content.map(
      AttestedClaim.fromAttestedClaim
    )
    const allVerified = await Promise.all(attestedClaims.map(ac => ac.verify()))
    return [allVerified.every(b => b), attestedClaims]
  }
  if (presentation.type === MessageBodyType.SUBMIT_CLAIMS_FOR_CTYPES_PE) {
    if (
      typeof session === 'undefined' ||
      typeof latestAccumulators === 'undefined' ||
      typeof attesterPubKeys === 'undefined'
    ) {
      throw new Error(`Received privacy enhanced presentation. Require:
      Session: ${session}
      accumulators: ${latestAccumulators}
      public keys: ${attesterPubKeys}`)
    }
    const { verified, claims } = await Verifier.verifyCombinedPresentation({
      proof: presentation.content,
      verifierSession: session,
      latestAccumulators,
      attesterPubKeys,
    })
    return [verified, claims]
  }
  return [false, []]
}
