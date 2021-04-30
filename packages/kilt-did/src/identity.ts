import nacl from 'tweetnacl'
import { encodeAddress } from '@polkadot/util-crypto'
import type { IIdentity, SubmittableExtrinsic } from '@kiltprotocol/types'
import { SDKErrors } from '@kiltprotocol/utils'
import { TypeRegistry } from '@polkadot/types'
import { BlockchainApiConnection } from '@kiltprotocol/chain-helpers'
import { Codec } from '@polkadot/types/types'
import {
  DidSignature,
  DidSigned,
  IDidCreationOperation,
  IDidDeletionOperation,
  IDidUpdateOperation,
  Url,
} from './types.chain'
import { create, queryByDID, update, deactivate } from './Did.chain'
import { Nullable } from './types'

export interface IKeyPair {
  publicKey: Uint8Array
  type: string
  // do we need the identifier?
}

const TYPE_REGISTRY = new TypeRegistry()
TYPE_REGISTRY.register(BlockchainApiConnection.CUSTOM_TYPES)

function isIKeyPair(keypair: unknown): keypair is IKeyPair {
  return (
    typeof keypair === 'object' &&
    !!keypair &&
    'publicKey' in keypair &&
    keypair['publicKey'] instanceof Uint8Array &&
    'type' in keypair &&
    typeof keypair['type'] === 'string'
  )
}

function encodeUrl(url: string): Url {
  const typedUrl: Record<string, unknown> = {}
  Array.from(['http', 'ftp', 'ipfs']).some((type) => {
    if (url.startsWith(type)) {
      typedUrl[type] = { payload: url }
      return true
    }
    return false
  })
  return new (TYPE_REGISTRY.getOrThrow<Url>('Url'))(TYPE_REGISTRY, typedUrl)
}

export interface ISigningKeyPair extends IKeyPair {
  sign: (message: string | Uint8Array) => Uint8Array
}

export interface IEncryptionKeyPair extends IKeyPair {
  decrypt: (
    message: Uint8Array,
    nonce: Uint8Array,
    senderPublicKey: Uint8Array
  ) => Uint8Array | null
}

type Ed25519 = 'ed25519'

export interface IEd25519KeyPair extends ISigningKeyPair {
  type: Ed25519
  deriveEncryptionKeyPair: () => IEncryptionKeyPair
}

// TODO: should this use the same keys as the chain type?
export interface KeySet {
  authentication: ISigningKeyPair
  encryption: IEncryptionKeyPair
  attestation?: ISigningKeyPair
  delegation?: ISigningKeyPair
}

export class Curve25519KeyPair implements IEncryptionKeyPair {
  public publicKey: Uint8Array
  public readonly type = 'x55519'
  private secretKey: Uint8Array

  constructor(secretKey: Uint8Array, publicKey: Uint8Array) {
    this.publicKey = publicKey
    this.secretKey = secretKey
  }

  public decrypt(message: Uint8Array, nonce: Uint8Array, senderPk: Uint8Array) {
    return nacl.box.open(message, nonce, senderPk, this.secretKey)
  }
}

const KILT_DID_PREFIX = 'did:kilt:'

export function getDidFromIdentifier(identifier: string): string {
  return KILT_DID_PREFIX + identifier
}

export function getIdentifierFromDid(did: string): string {
  if (!did.startsWith(KILT_DID_PREFIX)) {
    throw SDKErrors.ERROR_INVALID_DID_PREFIX(did)
  }
  return did.substr(KILT_DID_PREFIX.length)
}

function formatPublicKey(
  keypair: IKeyPair
): Record<IKeyPair['type'], IKeyPair['publicKey']> {
  const { type, publicKey } = keypair
  return { [type]: publicKey }
}

function signDidOperation<PayloadType extends Codec>(
  payload: PayloadType,
  key: ISigningKeyPair
): DidSigned<PayloadType> {
  const signature = new (TYPE_REGISTRY.getOrThrow<DidSignature>(
    'DidSignature'
  ))(TYPE_REGISTRY, {
    [key.type]: key.sign(payload.toU8a()),
  })
  return { payload, signature }
}

export class LightDID {
  public did: string
  protected keys: KeySet

  public get authenticationKey(): ISigningKeyPair {
    return this.keys.authentication
  }

  public get encryptionKey(): IEncryptionKeyPair {
    return this.keys.encryption
  }

  constructor(
    did: string,
    authenticationKey: ISigningKeyPair,
    encryptionKey: IEncryptionKeyPair
  ) {
    this.did = did
    this.keys = { authentication: authenticationKey, encryption: encryptionKey }
  }

  public static fromKeyPair(keyPair: IEd25519KeyPair): LightDID {
    const address = encodeAddress(keyPair.publicKey, 38)
    const did = getDidFromIdentifier(address)
    const boxKeyPair = keyPair.deriveEncryptionKeyPair()
    return new LightDID(did, keyPair, boxKeyPair)
  }

  public static fromIdentity(identity: IIdentity): LightDID {
    const did = getDidFromIdentifier(identity.address)
    const boxKeyPair = new Curve25519KeyPair(
      identity.boxKeyPair.secretKey,
      identity.boxKeyPair.publicKey
    )
    return new LightDID(did, identity.signKeyringPair, boxKeyPair)
  }
}

export class FullDID extends LightDID {
  public get delegationKey(): ISigningKeyPair | undefined {
    return this.keys.delegation
  }

  public get attestationKey(): ISigningKeyPair | undefined {
    return this.keys.attestation
  }

  constructor(
    did: string,
    authenticationKey: ISigningKeyPair,
    encryptionKey: IEncryptionKeyPair,
    attestationKey?: ISigningKeyPair,
    delegationKey?: ISigningKeyPair
  ) {
    super(did, authenticationKey, encryptionKey)
    this.setKeys({ attestation: attestationKey, delegation: delegationKey })
  }

  public static fromLightDID(
    did: LightDID,
    attestationKey?: ISigningKeyPair,
    delegationKey?: ISigningKeyPair
  ): FullDID {
    return new FullDID(
      did.did,
      did.authenticationKey,
      did.encryptionKey,
      attestationKey,
      delegationKey
    )
  }

  public static fromKeyPair(
    keyPair: IEd25519KeyPair,
    attestationKey?: ISigningKeyPair,
    delegationKey?: ISigningKeyPair
  ): FullDID {
    return FullDID.fromLightDID(
      super.fromKeyPair(keyPair),
      attestationKey,
      delegationKey
    )
  }

  public static fromIdentity(
    identity: IIdentity,
    attestationKey?: ISigningKeyPair,
    delegationKey?: ISigningKeyPair
  ): FullDID {
    return FullDID.fromLightDID(
      super.fromIdentity(identity),
      attestationKey,
      delegationKey
    )
  }

  public setKeys(keys: Partial<Nullable<KeySet>>): void {
    // copy current keys
    const keysCopy = { ...this.keys }
    // apply changes to copy
    Object.entries(keys).forEach(([name, keyPair]) => {
      if (
        isIKeyPair(keyPair) &&
        ['authentication', 'encryption', 'attestation', 'delegation'].includes(
          name
        )
      ) {
        keysCopy[name] = keyPair
      } else if (
        keyPair === null &&
        ['attestation', 'delegation'].includes(name)
      ) {
        delete keysCopy[name]
      } else if (typeof keyPair === 'undefined') {
      } else {
        throw Error(`erroneous input: entry "${name}" with value ${keyPair}`)
      }
    })
    // if no errors, apply
    this.keys = keysCopy
  }

  public unsetKeys(names: Array<keyof KeySet>): void {
    // copy current keys
    const keysCopy = { ...this.keys }
    // apply changes to copy
    names.forEach((name) => {
      if (Object.keys(keysCopy).includes(name)) {
        delete keysCopy[name]
      } else {
        throw Error(`erroneous input: no key ${name}`)
      }
    })
    // apply changes if no errors
    this.keys = keysCopy
  }

  public getDidCreate(endpoint_url?: string): DidSigned<IDidCreationOperation> {
    // build did create object
    const didCreateRaw = {
      did: getIdentifierFromDid(this.did),
      new_auth_key: formatPublicKey(this.authenticationKey),
      new_key_agreement_key: formatPublicKey(this.encryptionKey),
      new_attestation_key: this.attestationKey
        ? formatPublicKey(this.attestationKey)
        : undefined,
      new_delegation_key: this.delegationKey
        ? formatPublicKey(this.delegationKey)
        : undefined,
      new_endpoint_url: endpoint_url ? encodeUrl(endpoint_url) : undefined,
    }
    const didCreate: IDidCreationOperation = new (TYPE_REGISTRY.getOrThrow<
      IDidCreationOperation
    >('DidCreationOperation'))(TYPE_REGISTRY, didCreateRaw)
    return signDidOperation(didCreate, this.authenticationKey)
  }

  public getDidUpdate(
    keyUpdate: Partial<Nullable<KeySet>>,
    tx_counter: number,
    verification_keys_to_remove: Array<IKeyPair['publicKey']> = [],
    new_endpoint_url?: string
  ): DidSigned<IDidUpdateOperation> {
    // build key update object
    function matchKeyOperation(
      keypair: IKeyPair | undefined | null
    ): ReturnType<typeof formatPublicKey> | undefined {
      return keypair ? formatPublicKey(keypair) : undefined
    }
    const didUpdateRaw = {
      did: getIdentifierFromDid(this.did),
      new_auth_key: matchKeyOperation(keyUpdate.authentication),
      new_key_agreement_key: matchKeyOperation(keyUpdate.encryption),
      new_attestation_key: matchKeyOperation(keyUpdate.attestation),
      new_delegation_key: matchKeyOperation(keyUpdate.delegation),
      verification_keys_to_remove,
      new_endpoint_url: new_endpoint_url
        ? encodeUrl(new_endpoint_url)
        : undefined,
      tx_counter,
    }
    const didUpdate = new (TYPE_REGISTRY.getOrThrow<IDidUpdateOperation>(
      'DidUpdateOperation'
    ))(TYPE_REGISTRY, didUpdateRaw)
    return signDidOperation(didUpdate, this.authenticationKey)
  }

  public getDidDeactivate(txIndex: number): DidSigned<IDidDeletionOperation> {
    const didDeactivate: IDidDeletionOperation = new (TYPE_REGISTRY.getOrThrow<
      IDidDeletionOperation
    >('DidDeletionOperation'))(TYPE_REGISTRY, {
      did: getIdentifierFromDid(this.did),
      tx_counter: txIndex,
    })
    return signDidOperation(didDeactivate, this.authenticationKey)
  }

  public async getTxIndex(): Promise<number> {
    const didRecord = await queryByDID(this.did)
    if (!didRecord) throw new Error('did not on chain')
    return didRecord.last_tx_counter
  }

  // the following are optional, not sure if we want to include them

  public async getDidCreateTx(
    endpoint_url?: string
  ): Promise<SubmittableExtrinsic> {
    return create(this.getDidCreate(endpoint_url))
  }

  public async getKeyUpdateTx(
    newKeys: Partial<KeySet>,
    txIndex: number,
    verification_keys_to_remove: [] = [],
    new_endpoint_url?: string
  ): Promise<SubmittableExtrinsic> {
    return update(
      this.getDidUpdate(
        newKeys,
        txIndex,
        verification_keys_to_remove,
        new_endpoint_url
      )
    )
  }

  public async getKeyRemovalTx(txIndex: number): Promise<SubmittableExtrinsic> {
    return deactivate(this.getDidDeactivate(txIndex))
  }
}
