import * as u8aUtil from '@polkadot/util/u8a'
import * as gabi from '@kiltprotocol/portablegabi'
import { KeyringPair } from '@polkadot/keyring/types'
import { IRevocableAttestation } from '../types/Attestation'
import Identity from '../identity/Identity'
import { MessageBodyType, IInitiateAttestation } from '../messaging/Message'
import IRequestForAttestation from '../types/RequestForAttestation'
import PublicAttesterIdentity from './PublicAttesterIdentity'
import Attestation from '../attestation/Attestation'

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

export default class AttesterIdentity extends Identity {
  protected attester: gabi.Attester
  public accumulator: gabi.Accumulator

  constructor(
    seed: Uint8Array,
    signKeyringPair: KeyringPair,
    claimer: gabi.Claimer,
    attester: gabi.Attester,
    accumulator: gabi.Accumulator
  ) {
    super(seed, signKeyringPair, claimer)
    this.attester = attester
    this.accumulator = accumulator
  }

  /**
   * Returns the private key used to create privacy enhanced attestations.
   *
   * @returns The private key used for attesting.
   */
  public getPrivateGabiKey(): gabi.AttesterPrivateKey {
    return this.attester.privateKey
  }

  /**
   * Returns the private key used to create privacy enhanced attestations.
   *
   * @returns The private key used for attesting.
   */
  public getPublicGabiKey(): gabi.AttesterPublicKey {
    return this.attester.publicKey
  }

  public static async buildFromIdentity(
    identity: Identity,
    validityDuration: number,
    maxAttributes: number
  ): Promise<AttesterIdentity> {
    const attester = await gabi.Attester.create({
      validityDuration,
      maxAttributes,
    })
    const acc = await attester.createAccumulator()

    return new AttesterIdentity(
      identity.seed,
      identity.signKeyringPair,
      identity.claimer,
      attester,
      acc
    )
  }

  public static async buildFromIdentityAndKeys(
    identity: Identity,
    rawPublicKey: string,
    rawPrivateKey: string,
    accumulator?: string
  ): Promise<AttesterIdentity> {
    const privateGabiKey = new gabi.AttesterPrivateKey(rawPrivateKey)
    const publicGabiKey = new gabi.AttesterPublicKey(rawPublicKey)
    const attester = new gabi.Attester(publicGabiKey, privateGabiKey)
    let acc: gabi.Accumulator
    if (typeof accumulator !== 'undefined') {
      acc = new gabi.Accumulator(accumulator)
    } else {
      acc = await attester.createAccumulator()
    }
    const attesterId = new AttesterIdentity(
      identity.seed,
      identity.signKeyringPair,
      identity.claimer,
      attester,
      acc
    )
    attesterId.accumulator = acc
    return attesterId
  }

  public static async buildFromMnemonic(
    phraseArg?: string,
    validityDuration = ONE_YEAR_MS,
    maxAttributes = 70
  ): Promise<AttesterIdentity> {
    return this.buildFromIdentity(
      await Identity.buildFromMnemonic(phraseArg),
      validityDuration,
      maxAttributes
    )
  }

  public static async buildFromMnemonicAndKey(
    publicGabiKey: string,
    privateGabiKey: string,
    phraseArg?: string,
    accumulator?: string
  ): Promise<AttesterIdentity> {
    return this.buildFromIdentityAndKeys(
      await Identity.buildFromMnemonic(phraseArg),
      publicGabiKey,
      privateGabiKey,
      accumulator
    )
  }

  public static async buildFromSeedString(
    seedArg: string,
    validityDuration = ONE_YEAR_MS,
    maxAttributes = 70
  ): Promise<AttesterIdentity> {
    return this.buildFromIdentity(
      await Identity.buildFromSeedString(seedArg),
      validityDuration,
      maxAttributes
    )
  }

  public static async buildFromSeed(
    seed: Uint8Array,
    validityDuration = ONE_YEAR_MS,
    maxAttributes = 70
  ): Promise<AttesterIdentity> {
    return this.buildFromIdentity(
      await Identity.buildFromSeed(seed),
      validityDuration,
      maxAttributes
    )
  }

  public static async buildFromURI(
    uri: string,
    validityDuration = ONE_YEAR_MS,
    maxAttributes = 70
  ): Promise<AttesterIdentity> {
    return this.buildFromIdentity(
      await Identity.buildFromURI(uri),
      validityDuration,
      maxAttributes
    )
  }

  public static async buildFromURIAndKey(
    uri: string,
    publicGabiKey: string,
    privateGabiKey: string,
    accumulator?: string
  ): Promise<AttesterIdentity> {
    return this.buildFromIdentityAndKeys(
      await Identity.buildFromURI(uri),
      publicGabiKey,
      privateGabiKey,
      accumulator
    )
  }

  public getPublicIdentity(): PublicAttesterIdentity {
    return new PublicAttesterIdentity(
      this.signKeyringPair.address,
      u8aUtil.u8aToHex(this.boxKeyPair.publicKey),
      this.attester.publicKey,
      this.accumulator,
      this.serviceAddress
    )
  }

  public getAccumulator(): gabi.Accumulator {
    return this.accumulator
  }

  public async issuePrivacyEnhancedAttestation(
    session: gabi.AttesterAttestationSession,
    reqForAttestation: IRequestForAttestation
  ): Promise<[gabi.Witness, gabi.Attestation]> {
    if (reqForAttestation.privacyEnhanced != null) {
      const { witness, attestation } = await this.attester.issueAttestation({
        attestationSession: session,
        attestationRequest: reqForAttestation.privacyEnhanced,
        accumulator: this.accumulator,
      })
      return [witness, attestation]
    }
    throw new Error(
      'Privacy enhancement was missing in request for attestation'
    )
  }

  public async initiateAttestation(): Promise<{
    message: IInitiateAttestation
    session: gabi.AttesterAttestationSession
  }> {
    const { message, session } = await this.attester.startAttestation()
    return {
      message: {
        content: message,
        type: MessageBodyType.INITIATE_ATTESTATION,
      },
      session,
    }
  }

  public async revokeAttestation(
    attestation: IRevocableAttestation
  ): Promise<void> {
    if (attestation.witness !== null) {
      this.accumulator = await this.attester.revokeAttestation({
        witnesses: [attestation.witness],
        accumulator: this.accumulator,
      })
    }
    await new Attestation(attestation).revoke(this)
  }
}
