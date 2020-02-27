/* eslint-disable no-console */
import Kilt, {
  ICType,
  CTypeUtils,
  IRequestAttestationForClaim,
  MessageBodyType,
  Message,
  ISubmitAttestationForClaim,
} from '../src'

// How to generate an Identity
const mnemonic = Kilt.Identity.generateMnemonic()
const claimer = Kilt.Identity.buildFromMnemonic(mnemonic)

// At this point the generated Identity has no tokens.
// If you want to interact with the blockchain, you will have to get some.
// Contact faucet@kilt.io and provide the address of the identity

// How to build a Ctype
// First build a schema
const ctypeSchema: ICType['schema'] = {
  $id: 'DriversLicense',
  $schema: 'http://kilt-protocol.org/draft-01/ctype#',
  properties: {
    name: {
      type: 'string',
    },
    age: {
      type: 'integer',
    },
  },
  type: 'object',
}
// Generate the Hash for it
const ctypeHash = CTypeUtils.getHashForSchema(ctypeSchema)

// Put everything together
const rawCtype: ICType = {
  schema: ctypeSchema,
  hash: ctypeHash,
  owner: claimer.address,
}

// Build the CType object
const ctype = new Kilt.CType(rawCtype)

// Before you can store the ctype on the blockchain, you have to connect to it.
// Setup your local node and start it, using the dev chain
// Kilt.connect('ws://localhost:9944')

// Store ctype on blockchain
// ! This costs tokens !
// Also note, that an identical ctype can only be stored once on the blockchain.
// ctype.store(claimer)

// How to build a Claim

const rawClaim = {
  name: 'Alice',
  age: 29,
}

const claim = Kilt.Claim.fromCTypeAndClaimContents(
  ctype,
  rawClaim,
  claimer.address
)

// How to get an Attestation

// To get an attestation, we need an Attester
const mnemonicForAttester = Kilt.Identity.generateMnemonic()
const attester = Kilt.Identity.buildFromMnemonic(mnemonicForAttester)

// And we need to build a request for an attestation
const requestForAttestation = Kilt.RequestForAttestation.fromClaimAndIdentity(
  claim,
  claimer
)

// Excursion to the messaging system
// If the Attester doesn't live on the same machine, we need to send her a message
const messageBody: IRequestAttestationForClaim = {
  content: {
    requestForAttestation,
  },
  type: MessageBodyType.REQUEST_ATTESTATION_FOR_CLAIM,
}
const message = new Kilt.Message(messageBody, claimer, attester)
// The message can be encrypted as follows
const encrypted = message.getEncryptedMessage()

// Check the validity of the message
Message.ensureHashAndSignature(encrypted, claimer.address)
// When the Attester receives the message, she can decrypt it
const decrypted = Message.createFromEncryptedMessage(encrypted, attester)

// And make sure, that the sender is the owner of the identity.
// This prevents claimers to use attested claims of another claimer.
Message.ensureOwnerIsSender(decrypted)

if (decrypted.body.type === MessageBodyType.REQUEST_ATTESTATION_FOR_CLAIM) {
  // const extractedRequestForAttestation: IRequestForAttestation =
  //   decrypted.body.content
}

// Lets continue with the original object
const attestation = Kilt.Attestation.fromRequestAndPublicIdentity(
  requestForAttestation,
  attester
)
// Store it on the blockchain
// ! This costs tokens !
// attestation.store(attester)

// Build the AttestedClaim object, which the claimer can store and use
const attestedClaim = Kilt.AttestedClaim.fromRequestAndAttestation(
  requestForAttestation,
  attestation
)

// And send a message back
const messageBodyBack: ISubmitAttestationForClaim = {
  content: attestedClaim,
  type: MessageBodyType.SUBMIT_ATTESTATION_FOR_CLAIM,
}
const messageBack = new Message(messageBodyBack, attester, claimer)

if (messageBack.body.type === MessageBodyType.SUBMIT_ATTESTATION_FOR_CLAIM) {
  // const myAttestedClaim = messageBack.body.content
  // The claimer just needs to save it now and can use it later for verification
}

console.log('Claimer', claimer.address, '\n')
console.log('Attester', attester.address, '\n')

console.log('Ctype', ctype, '\n')
console.log('Claim', claim, '\n')

console.log('RequestForAttestation', requestForAttestation, '\n')
console.log('RFO Message', message, '\n')

console.log('Attestation', attestation, '\n')
console.log('AttestedClaim', attestedClaim, '\n')
console.log('AttestedClaim message', messageBack, '\n')
