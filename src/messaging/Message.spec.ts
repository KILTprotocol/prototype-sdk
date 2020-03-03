import Identity from '../identity/Identity'
import Message, {
  MessageBodyType,
  IEncryptedMessage,
  IRequestAttestationForClaim,
  ISubmitAttestationForClaim,
  ISubmitClaimsForCTypes,
} from './Message'
import { EncryptedAsymmetricString } from '../crypto/Crypto'
import Crypto from '../crypto'
import IRequestForAttestation from '../types/RequestForAttestation'
import * as Quote from '../quote/Quote'
import IClaim from '../types/Claim'
import { IQuote } from '../types/Quote'
import { IAttestedClaim, Verifier } from '..'

describe('Messaging', () => {
  let identityAlice: Identity
  let identityBob: Identity
  let date: Date

  beforeAll(async () => {
    identityAlice = await Identity.buildFromURI('//Alice')
    identityBob = await Identity.buildFromURI('//Bob')
    date = new Date(2019, 11, 10)
  })

  it('verify message encryption and signing', async () => {
    const messageBody = (await Verifier.newRequest()
      .requestPresentationForCtype({
        ctypeHash: '0x12345678',
        attributes: ['age'],
      })
      .finalize(false))[1]

    const message = new Message(
      messageBody,
      identityAlice,
      identityBob.getPublicIdentity()
    )

    const encryptedMessage = message.getEncryptedMessage()

    const decryptedMessage = Message.createFromEncryptedMessage(
      encryptedMessage,
      identityBob
    )
    expect(JSON.stringify(messageBody)).toEqual(
      JSON.stringify(decryptedMessage.body)
    )

    const encryptedMessageWrongHash: IEncryptedMessage = JSON.parse(
      JSON.stringify(encryptedMessage)
    ) as IEncryptedMessage
    encryptedMessageWrongHash.hash = '0x00000000'
    expect(() =>
      Message.createFromEncryptedMessage(encryptedMessageWrongHash, identityBob)
    ).toThrowError(new Error('Hash of message not correct'))

    const encryptedMessageWrongSignature: IEncryptedMessage = JSON.parse(
      JSON.stringify(encryptedMessage)
    ) as IEncryptedMessage
    encryptedMessageWrongSignature.signature = encryptedMessageWrongSignature.signature.substr(
      0,
      encryptedMessageWrongSignature.signature.length - 4
    )
    encryptedMessageWrongSignature.signature += '1234'
    expect(() =>
      Message.createFromEncryptedMessage(
        encryptedMessageWrongSignature,
        identityBob
      )
    ).toThrowError(new Error('Signature of message not correct'))

    const encryptedMessageWrongContent: IEncryptedMessage = JSON.parse(
      JSON.stringify(encryptedMessage)
    ) as IEncryptedMessage
    encryptedMessageWrongContent.message = '1234'
    const hashStrWrongContent: string = Crypto.hashStr(
      encryptedMessageWrongContent.message +
        encryptedMessageWrongContent.nonce +
        encryptedMessageWrongContent.createdAt
    )
    encryptedMessageWrongContent.hash = hashStrWrongContent
    encryptedMessageWrongContent.signature = identityAlice.signStr(
      hashStrWrongContent
    )
    expect(() =>
      Message.createFromEncryptedMessage(
        encryptedMessageWrongContent,
        identityBob
      )
    ).toThrowError(new Error('Error decoding message'))

    const encryptedWrongBody: EncryptedAsymmetricString = identityAlice.encryptAsymmetricAsStr(
      '{ wrong JSON',
      identityBob.boxPublicKeyAsHex
    )
    const ts: number = Date.now()
    const hashStrBadContent: string = Crypto.hashStr(
      encryptedWrongBody.box + encryptedWrongBody.nonce + ts
    )
    const encryptedMessageWrongBody: IEncryptedMessage = {
      createdAt: ts,
      receiverAddress: encryptedMessage.receiverAddress,
      senderAddress: encryptedMessage.senderAddress,
      message: encryptedWrongBody.box,
      nonce: encryptedWrongBody.nonce,
      hash: hashStrBadContent,
      signature: identityAlice.signStr(hashStrBadContent),
      senderBoxPublicKey: encryptedMessage.senderBoxPublicKey,
    } as IEncryptedMessage
    expect(() =>
      Message.createFromEncryptedMessage(encryptedMessageWrongBody, identityBob)
    ).toThrowError(new Error('Error parsing message body'))
  })

  it('verify message sender is owner', () => {
    const content = {
      claim: {
        cTypeHash: '0x12345678',
        owner: identityAlice.getPublicIdentity().address,
        contents: {},
      },
      delegationId: null,
      legitimations: [],
      claimOwner: { nonce: '0x12345678', hash: '0x12345678' },
      claimHashTree: {},
      cTypeHash: { nonce: '0x12345678', hash: '0x12345678' },
      rootHash: '0x12345678',
      claimerSignature: '0x12345678',
      privacyEnhanced: null,
    } as IRequestForAttestation

    const quoteData: IQuote = {
      attesterAddress: identityAlice.address,
      cTypeHash: '0x12345678',
      cost: {
        tax: { vat: 3.3 },
        net: 23.4,
        gross: 23.5,
      },
      currency: 'Euro',
      termsAndConditions: 'https://coolcompany.io/terms.pdf',
      timeframe: date,
    }
    const quoteAttesterSigned = Quote.createAttesterSignature(
      quoteData,
      identityAlice
    )
    const bothSigned = Quote.createAgreedQuote(
      identityAlice,
      quoteAttesterSigned,
      content.rootHash
    )
    const requestAttestationBody: IRequestAttestationForClaim = {
      content: {
        requestForAttestation: content,
        quote: bothSigned,
        prerequisiteClaims: [] as IClaim[],
      },
      type: MessageBodyType.REQUEST_ATTESTATION_FOR_CLAIM,
    }

    Message.ensureOwnerIsSender(
      new Message(
        requestAttestationBody,
        identityAlice,
        identityBob.getPublicIdentity()
      )
    )
    expect(() =>
      Message.ensureOwnerIsSender(
        new Message(
          requestAttestationBody,
          identityBob,
          identityAlice.getPublicIdentity()
        )
      )
    ).toThrowError(new Error('Sender is not owner of the claim'))

    const submitAttestationBody: ISubmitAttestationForClaim = {
      content: {
        attestation: {
          delegationId: null,
          claimHash:
            requestAttestationBody.content.requestForAttestation.rootHash,
          cTypeHash: '0x12345678',
          owner: identityBob.getPublicIdentity().address,
          revoked: false,
        },
      },
      type: MessageBodyType.SUBMIT_ATTESTATION_FOR_CLAIM,
    }
    expect(() =>
      Message.ensureOwnerIsSender(
        new Message(
          submitAttestationBody,
          identityAlice,
          identityBob.getPublicIdentity()
        )
      )
    ).toThrowError(new Error('Sender is not owner of the attestation'))
    Message.ensureOwnerIsSender(
      new Message(
        submitAttestationBody,
        identityBob,
        identityAlice.getPublicIdentity()
      )
    )

    const attestedClaim: IAttestedClaim = {
      credential: null,
      request: content,
      attestation: submitAttestationBody.content.attestation,
    }

    const submitClaimsForCTypeBody: ISubmitClaimsForCTypes = {
      content: [attestedClaim],
      type: MessageBodyType.SUBMIT_CLAIMS_FOR_CTYPES,
    }

    Message.ensureOwnerIsSender(
      new Message(
        submitClaimsForCTypeBody,
        identityAlice,
        identityBob.getPublicIdentity()
      )
    )
    expect(() =>
      Message.ensureOwnerIsSender(
        new Message(
          submitClaimsForCTypeBody,
          identityBob,
          identityAlice.getPublicIdentity()
        )
      )
    ).toThrowError(new Error('Sender is not owner of the claims'))
  })
})
