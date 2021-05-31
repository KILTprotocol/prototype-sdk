import { IAttestedClaim } from './AttestedClaim'

export interface IPresentation {
  credentials: IAttestedClaim[]
  challenge?: string
  signature?: string
}

export interface Signer {
  sign: (data: Uint8Array) => Uint8Array
}

export interface IPresentationSigningOptions {
  challenge: string
  signer: Signer
}

export interface IPresentationOptions {
  showAttributes?: string[]
  hideAttributes?: string[]
}
