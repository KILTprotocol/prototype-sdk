import { Crypto, DataUtils } from '@kiltprotocol/utils'
import type {
  IAttestedClaim,
  IClaim,
  IIdentity,
  IPresentation,
  IPresentationSigningOptions,
} from '@kiltprotocol/types'
import AttestedClaim from './AttestedClaim'

function ensureSingleOwner(credentials: IAttestedClaim[]): IClaim['owner'] {
  const owners = credentials.reduce((owns, credential) => {
    owns.add(credential.request.claim.owner)
    return owns
  }, new Set<IIdentity['address']>())
  if (owners.size !== 1) {
    throw new Error(
      'all credentials in a presentation must be owned by one claimer'
    )
  }
  const owner = owners.values().next().value
  DataUtils.validateAddress(owner, 'claim owner')
  return owner
}

export type SignedPresentation = Presentation &
  Pick<Required<Presentation>, 'challenge' | 'signature'>

export class Presentation implements IPresentation {
  public credentials: AttestedClaim[]
  public challenge?: string
  public signature?: string

  constructor({ credentials, challenge, signature }: IPresentation) {
    ensureSingleOwner(credentials)
    this.credentials = credentials.map((i) => new AttestedClaim(i))
    this.challenge = challenge
    this.signature = signature
  }

  public static fromPresentations(
    presentations: IPresentation[],
    signingOpts?: IPresentationSigningOptions
  ): Presentation {
    const credentials = ([] as IAttestedClaim[]).concat(
      ...presentations.map((i) => i.credentials)
    )
    const presentation = new Presentation({
      credentials,
    })
    if (!signingOpts) return presentation
    presentation.sign(signingOpts)
    return presentation
  }

  public static fromAttestedClaims(
    credentials: IAttestedClaim[],
    options?: IPresentationSigningOptions
  ): Presentation {
    const presentation = new Presentation({ credentials })

    // // remove attributes listed in `hideAttributes` or NOT listed in `showAttributes`, if specified
    // const excludedClaimProperties = showAttributes
    //   ? Array.from(presentation.getAttributes()).filter(
    //       (att) => !showAttributes.includes(att)
    //     )
    //   : []
    // if (hideAttributes) {
    //   excludedClaimProperties.push(...hideAttributes)
    // }
    // presentation.request.removeClaimProperties(excludedClaimProperties)
    if (options) {
      presentation.sign(options)
    }
    return presentation
  }

  public sign({
    challenge,
    signer,
  }: IPresentationSigningOptions): SignedPresentation {
    this.challenge = challenge
    delete this.signature
    const signature = signer.sign(Crypto.coToUInt8(JSON.stringify(this)))
    this.signature = Crypto.u8aToHex(signature)
    return this as SignedPresentation
  }

  public isSigned(): this is SignedPresentation {
    return !!this.challenge && !!this.signature
  }

  public verifySignature(): boolean {
    if (!this.isSigned()) return false
    const claimsOwner = ensureSingleOwner(this.credentials)
    const { signature, ...document } = this
    return Crypto.verify(JSON.stringify(document), signature, claimsOwner)
  }

  public verifyData(): boolean {
    if (this.isSigned() && !this.verifySignature()) return false
    return this.credentials.every((cred) => cred.verifyData())
  }

  public async verify(): Promise<boolean> {
    if (this.isSigned() && !this.verifySignature()) return false
    const results = await Promise.all(
      this.credentials.map((cred) => cred.verify())
    )
    return results.every((r) => !!r)
  }
}
