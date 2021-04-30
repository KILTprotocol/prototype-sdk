import type {
  BTreeSet,
  Enum,
  Option,
  Struct,
  u64,
  u8,
  Vec,
} from '@polkadot/types'
import { AccountId } from '@polkadot/types/interfaces'

export interface PublicVerificationKey extends Enum {
  isEd25519: boolean
  isSr25519: boolean
  asEd25519: Vec<u8>
  asSr25519: Vec<u8>
}

export interface PublicEncryptionKey extends Enum {
  isX25519: boolean
  asX25519: Vec<u8>
}

type DidIdentifier = AccountId

export interface UrlEncoding extends Struct {
  payload: Vec<u8>
}

export interface Url extends Enum {
  isHttp: boolean
  isFtp: boolean
  isIpfs: boolean
  asHttp: UrlEncoding
  asFtp: UrlEncoding
  asIpfs: UrlEncoding
}

export interface DidDetails extends Struct {
  auth_key: PublicVerificationKey
  key_agreement_key: PublicEncryptionKey
  delegation_key: Option<PublicVerificationKey>
  attestation_key: Option<PublicVerificationKey>
  verification_keys: BTreeSet<PublicVerificationKey>
  endpoint_url: Option<Url>
  last_tx_counter: u64
}

export interface IDidCreationOperation extends Struct {
  did: DidIdentifier
  new_auth_key: PublicVerificationKey
  new_key_agreement_key: PublicEncryptionKey
  new_attestation_key: Option<PublicVerificationKey>
  new_delegation_key: Option<PublicVerificationKey>
  new_endpoint_url: Option<Url>
}

export interface IDidUpdateOperation extends Struct {
  did: DidIdentifier
  new_auth_key: Option<PublicVerificationKey>
  new_key_agreement_key: Option<PublicEncryptionKey>
  new_attestation_key: Option<PublicVerificationKey>
  new_delegation_key: Option<PublicVerificationKey>
  verification_keys_to_remove: Option<BTreeSet<PublicVerificationKey>>
  new_endpoint_url: Option<Url>
  tx_counter: u64
}

export interface IDidDeletionOperation extends Struct {
  did: DidIdentifier
  tx_counter: u64
}

export interface DidSignature extends Enum {
  isEd25519: boolean
  isSr25519: boolean
  asEd25519: Vec<u8>
  asSr25519: Vec<u8>
}

export interface DidSigned<PayloadType> {
  payload: PayloadType
  signature: DidSignature
}
