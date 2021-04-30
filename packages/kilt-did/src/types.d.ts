import type { IIdentity } from '@kiltprotocol/types'

export type KeypairType = 'ed25519' | 'sr15519' | 'x25519' | string

export interface TypedPublicKey {
  type: KeypairType
  publicKeyHex: string
}

export interface IDidRecord {
  did: IIdentity['address']
  auth_key: TypedPublicKey
  key_agreement_key: TypedPublicKey
  delegation_key?: TypedPublicKey
  attestation_key?: TypedPublicKey
  verification_keys: TypedPublicKey[]
  endpoint_url?: string
  last_tx_counter: number
}

export type Nullable<T> = { [P in keyof T]: T[P] | null }
