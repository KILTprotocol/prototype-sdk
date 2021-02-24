/* eslint-disable no-console */
import Kilt from '@kiltprotocol/sdk-js'
import type {
  SubmittableExtrinsic,
  IRequestForAttestation,
  IRequestAttestationForClaim,
  ISubmitAttestationForClaim,
  ISubmitClaimsForCTypes,
} from '@kiltprotocol/sdk-js'

const NODE_URL = 'ws://127.0.0.1:9944'

let tx: SubmittableExtrinsic

async function main(): Promise<void> {
  /* 1. Initialize KILT SDK and set up node endpoint */
  await Kilt.init({ address: NODE_URL })

  /* 2. How to generate an Identity */
  const claimerMnemonic = Kilt.Identity.generateMnemonic()
  // mnemonic: coast ugly state lunch repeat step armed goose together pottery bind mention
  console.log('claimer mnemonic', claimerMnemonic)
  const claimer = Kilt.Identity.buildFromMnemonic(claimerMnemonic)
  // claimer.address: 4rjPNrzFDMrp9BudjmAV8ED7vzFBaF1Dgf8FwUjmWbso4Eyd
  console.log('claimer address', claimer.address)

  /* 3.1. Building a CTYPE */
  const ctype = Kilt.CType.fromSchema({
    $schema: 'http://kilt-protocol.org/draft-01/ctype#',
    title: 'Drivers License',
    properties: {
      name: {
        type: 'string',
      },
      age: {
        type: 'integer',
      },
    },
    type: 'object',
  })

  /* To store the CTYPE on the blockchain, you have to call: */
  const identity = Kilt.Identity.buildFromMnemonic(
    'receive clutch item involve chaos clutch furnace arrest claw isolate okay together',
    // using ed25519 as key type because this is how the endowed identity is set up
    { signingKeyPairType: 'ed25519' }
  )
  tx = await ctype.store(identity)
  await Kilt.BlockchainUtils.submitSignedTx(tx, {
    resolveOn: Kilt.BlockchainUtils.IS_IN_BLOCK,
  })

  /* At the end of the process, the `CType` object should contain the following. */
  console.log(ctype)

  /* To construct a claim, we need to know the structure of the claim that is defined in a CTYPE */
  const rawClaim = {
    name: 'Alice',
    age: 29,
  }

  /* Now we can easily create the KILT compliant claim */
  const claim = Kilt.Claim.fromCTypeAndClaimContents(
    ctype,
    rawClaim,
    claimer.address
  )

  /* As a result we get the following KILT claim: */
  console.log(claim)

  /* 5.1.1. Requesting an Attestation */
  const requestForAttestation = Kilt.RequestForAttestation.fromClaimAndIdentity(
    claim,
    claimer
  )

  /* The `requestForAttestation` object looks like this: */
  console.log(requestForAttestation)

  /* before we can send the request for an attestation to an Attester, we should first create an Attester identity like above */
  const attesterMnemonic =
    'receive clutch item involve chaos clutch furnace arrest claw isolate okay together'
  const attester = Kilt.Identity.buildFromMnemonic(
    attesterMnemonic,
    // using ed25519 as this is an identity that has funds by default
    { signingKeyPairType: 'ed25519' }
  )

  /* First, we create the request for an attestation message in which the Claimer automatically encodes the message with the public key of the Attester: */
  const messageBody: IRequestAttestationForClaim = {
    content: { requestForAttestation },
    type: Kilt.Message.BodyType.REQUEST_ATTESTATION_FOR_CLAIM,
  }
  const message = new Kilt.Message(
    messageBody,
    claimer,
    attester.getPublicIdentity()
  )

  /* The complete `message` looks as follows: */
  console.log(message)

  /* The message can be encrypted as follows: */
  const encrypted = message.encrypt()

  /* Therefore, **during decryption** both the **sender identity and the validity of the message are checked automatically**. */
  const decrypted = Kilt.Message.decrypt(encrypted, attester)

  /* At this point the Attester has the original request for attestation object: */
  if (
    decrypted.body.type === Kilt.Message.BodyType.REQUEST_ATTESTATION_FOR_CLAIM
  ) {
    const extractedRequestForAttestation: IRequestForAttestation =
      decrypted.body.content.requestForAttestation

    /* The Attester creates the attestation based on the IRequestForAttestation object she received: */
    const attestation = Kilt.Attestation.fromRequestAndPublicIdentity(
      extractedRequestForAttestation,
      attester.getPublicIdentity()
    )

    /* The complete `attestation` object looks as follows: */
    console.log(attestation)

    /* Now the Attester can store the attestation on the blockchain, which also costs tokens: */
    tx = await attestation.store(attester)
    await Kilt.BlockchainUtils.submitSignedTx(tx, {
      resolveOn: Kilt.BlockchainUtils.IS_IN_BLOCK,
    })

    /* The request for attestation is fulfilled with the attestation, but it needs to be combined into the `AttestedClaim` object before sending it back to the Claimer: */
    const attestedClaim = Kilt.AttestedClaim.fromRequestAndAttestation(
      extractedRequestForAttestation,
      attestation
    )
    /* The complete `attestedClaim` object looks as follows: */
    console.log(attestedClaim)

    /* The Attester has to send the `attestedClaim` object back to the Claimer in the following message: */
    const messageBodyBack: ISubmitAttestationForClaim = {
      content: attestedClaim,
      type: Kilt.Message.BodyType.SUBMIT_ATTESTATION_FOR_CLAIM,
    }
    const messageBack = new Kilt.Message(
      messageBodyBack,
      attester,
      claimer.getPublicIdentity()
    )

    /* The complete `messageBack` message then looks as follows: */
    console.log(messageBack)

    /* After receiving the message, the Claimer just needs to save it and can use it later for verification: */
    if (
      messageBack.body.type ===
      Kilt.Message.BodyType.SUBMIT_ATTESTATION_FOR_CLAIM
    ) {
      const myAttestedClaim = Kilt.AttestedClaim.fromAttestedClaim({
        ...messageBack.body.content,
        request: requestForAttestation,
      })
      console.log(myAttestedClaim)

      /* As in the attestation, you need a second identity to act as the verifier: */
      const verifierMnemonic = Kilt.Identity.generateMnemonic()
      const verifier = Kilt.Identity.buildFromMnemonic(verifierMnemonic)

      const {
        session: verifierSession,
      } = Kilt.Actors.Verifier.newRequestBuilder()
        .requestPresentationForCtype({
          ctypeHash: ctype.hash,
          requestUpdatedAfter: new Date(), // request accumulator newer than NOW or the latest available
          properties: ['age', 'name'], // publicly shown to the verifier
        })
        .finalize(verifier, claimer.getPublicIdentity())

      /* Now the claimer can send a message to verifier including the attested claim: */
      const messageBodyForVerifier: ISubmitClaimsForCTypes = {
        content: [myAttestedClaim],
        type: Kilt.Message.BodyType.SUBMIT_CLAIMS_FOR_CTYPES,
      }
      const messageForVerifier = new Kilt.Message(
        messageBodyForVerifier,
        claimer,
        verifier.getPublicIdentity()
      )

      /* When verifying the claimer's message, the verifier has to use their session which was created during the CTYPE request: */
      const {
        verified: isValid, // whether the presented attested claim(s) are valid
        claims, // the attested claims (potentially only with requested properties)
      } = await Kilt.Actors.Verifier.verifyPresentation(
        messageForVerifier,
        verifierSession
      )
      console.log('Verifcation success?', isValid)
      console.log('Attested claims from verifier perspective:\n', claims)
    }
  }
}
// execute
main().finally(() => Kilt.disconnect())
