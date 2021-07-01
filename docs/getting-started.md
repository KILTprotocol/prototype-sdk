# Getting Started with the KILT SDK <!-- omit in toc -->

In this simple tutorial we show how you can start developing your own applications on top of the KILT Protocol.
The next examples give you a simple skeleton on how to use the KILT SDK to create identities, CTYPEs and claims, and also how to issue an attestation with the use of our messaging framework.

# Quick Start Guide <!-- omit in toc -->

- [1. How to install the SDK](#1-how-to-install-the-sdk)
  - [1.1. Prerequisites](#11-prerequisites)
- [2. How to generate an Identity](#2-how-to-generate-an-identity)
- [3. How to build and store a Claim Type (CTYPE)](#3-how-to-build-and-store-a-claim-type-ctype)
  - [3.1. Building a CTYPE](#31-building-a-ctype)
  - [3.2. Storing a CTYPE](#32-storing-a-ctype)
- [4. How to build a Claim](#4-how-to-build-a-claim)
- [5. How to request, create and send an Attestation](#5-how-to-request-create-and-send-an-attestation)
  - [5.1. Requesting an Attestation](#51-requesting-an-attestation)
  - [5.2. Sending an Attestation](#52-sending-an-attestation)
- [6. Verify a claim](#6-verify-a-claim)
  - [6.1. Request presentation for CTYPE](#61-request-presentation-for-ctype)
  - [6.2. Verify presentation](#62-verify-presentation)
- [7. Disconnect from chain](#7-disconnect-from-chain)

## 1. How to install the SDK

Install the KILT-SDK by running either of the following commands:

```bash
npm install @kiltprotocol/sdk-js
```

Or (recommended) with `yarn`:

```bash
yarn add @kiltprotocol/sdk-js
```

### 1.1. Prerequisites

1. Make a new directory and navigate into it with `mkdir kilt-rocks && cd kilt-rocks`
2. Install the SDK with `yarn add @kiltprotocol/sdk-js`
3. Install typescript with `yarn add typescript`
4. Make a new file, e.g. `touch getting-started.ts`
5. Execute the file with `npx ts-node getting-started.ts`

### Note <!-- omit in toc -->

Some calls in this example are made to asynchronous functions. Therefore, you have to wrap your functions inside an `async` function to execute them properly:

```javascript
async function main() {
  await foo()
}
// execute
main()
```

To keep the examples short, we will not wrap each one in an asynchronous function and expect you to do this on your own. Also, the compiler will complain when you try to `await` a promise on the root level - except if you are using TypeScript 3.8+ and configure your _tsconfig.json_ to enable this (see [the typescript doc](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html#top-level-await) for more).

In case you are unsure, please have a look at our [workshop](https://kiltprotocol.github.io/kilt-workshop-101/#/) where we provide everything ready to be copied and pasted.

💡 At any point, you can **check out our [getting-started.ts](./getting-started.ts) for a working example of the code presented in the following**.

### 1.2 Initializing the KILT SDK

When using the SDK, there are two things you'll always want to do before anything else:

1. Initialize cryptographic dependencies.
   If you don't do this, certain operations like identity generation could fail with the notice that "the WASM interface has not been initialized".
2. Set essential configurations, most importantly the endpoint of the KILT node to which you'll want to connect for actions that read or write to blockchain state.
   These operations would throw an error if called before an endpoint has been set.

To keep things simple, we grouped these two steps in a function you can call first thing, before any other code that used the KILT SDK.

```typescript
import Kilt from '@kiltprotocol/sdk-js'

await Kilt.init({ address: YOUR_CHAIN_ADDRESS })
```

Again, this is asynchronous, so be sure to wrap this in an `async` function as described above.
Add this line to the `async` functions wrapping the examples below if you run them individually.

## 2. How to generate an Identity

To generate an Identity first you have to generate a [BIP39 mnemonic](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) and then use it to create the Identity:

```typescript
import Kilt from '@kiltprotocol/sdk-js'

const claimerMnemonic = Kilt.Identity.generateMnemonic()
// mnemonic: coast ugly state lunch repeat step armed goose together pottery bind mention
console.log('claimer mnemonic', claimerMnemonic)
const claimer = Kilt.Identity.buildFromMnemonic(claimerMnemonic)
// claimer.address: 4rjPNrzFDMrp9BudjmAV8ED7vzFBaF1Dgf8FwUjmWbso4Eyd
console.log('claimer address', claimer.address)
```

At this point the generated Identity has no tokens. If you want to interact with the blockchain, you will have to get some by [requesting them from our faucet](https://faucet.kilt.io/).

## 3. How to build and store a Claim Type (CTYPE)

When building a CTYPE, you only need a JSON schema and your public [SS58 address](<https://github.com/paritytech/substrate/wiki/External-Address-Format-(SS58)>) which you automatically receive when generating an identity.

### 3.1. Building a CTYPE

```typescript
import Kilt from '@kiltprotocol/sdk-js'

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
```

### 3.2. Storing a CTYPE

Before you can store the CTYPE on the blockchain, you have to configure your blockchain address and connect to it.
Either explicitly:

```typescript
Kilt.config({ address: YOUR_CHAIN_ADDRESS })
await Kilt.connect()
```

Or by setting a default address in the configuration, connecting implicitly.

```typescript
Kilt.config({ address: YOUR_CHAIN_ADDRESS })
```

Note that calling (as described in [1.2](#initializing-the-kilt-sdk))

```typescript
Kilt.init({ address: YOUR_CHAIN_ADDRESS })
```

initializes the SDK _and_ sets the config, so it is related to the second approach.

There are [three types](https://dev.kilt.io/#/?id=source-code-and-deployed-instances) of KILT chains which you can use, each one having a different address:

1. The prod-net: `wss://full-nodes.kilt.io`
2. The dev-net: `wss://full-nodes-lb.devnet.kilt.io`
3. A local node: `ws://127.0.0.1:9944`

In case you go with option #1 or #2, you have to request test money ([prod-net](https://faucet.kilt.io/), [dev-net](https://faucet-devnet.kilt.io/)) **since storing a CTYPE on the chain requires tokens** as transaction fee.
However, **we recommend to start your local node** and use a mnemonic which already has tokens by using our docker image. Depending on which version of the SDK you are using, you might need to spin up the latest officially released version of the node (working with the latest release of the SDK) or the latest development version of the node (working with the latest development version of the SDK). Either version can be started with the following command by using one between the `latest` and `develop` tag.

```
docker run -p 9944:9944 kiltprotocol/mashnet-node:{latest,develop} --dev --ws-port 9944 --ws-external --rpc-external
```

To store the CTYPE on the blockchain, you have to call:

```typescript
// the account behind this mnemonic already has tokens
const identity = Kilt.Identity.buildFromMnemonic(
  'receive clutch item involve chaos clutch furnace arrest claw isolate okay together',
  // using ed25519 as key type because this is how the endowed identity is set up
  { signingKeyPairType: 'ed25519' }
)
const tx = await ctype.store()

// either sign and send in one step
await Kilt.BlockchainUtils.signAndSubmitTx(tx, identity)
// signAndSubmitTx can be passed SubscriptionPromise.Options, to control resolve and reject criteria:
await Kilt.BlockchainUtils.signAndSubmitTx(tx, identity, {
  resolveOn: Kilt.BlockchainUtils.IS_READY, // resolve once tx is in the tx pool
  rejectOn: Kilt.BlockchainUtils.IS_ERROR, // only reject when IS_ERROR criteria is matched
  timeout: 10_000, // Promise timeout in ms
  tip: 10_000_000, // Amount of Femto-KILT to tip the validator
})

// or step by step
const chain = Kilt.connect()
const signed = chain.signTx(identity, tx)
await Kilt.BlockchainUtils.submitSignedTx(tx)
```

Please note that the **same CTYPE can only be stored once** on the blockchain.

If a transaction fails with an by re-signing recoverable error (e.g. multi device nonce collision),
BlockchainUtils.signAndSubmitTx has the ability to re-sign and re-send the failed tx up to 2 times, if the appropriate flag is set:

```typescript
await Kilt.BlockchainUtils.signAndSubmitTx(tx, identity, {
  resolveOn: Kilt.BlockchainUtils.IS_FINALIZED,
  reSign: true,
})
```

At the end of the process, the `CType` object should match the CType below.
This can be saved anywhere, for example on a CTYPE registry service:

```typescript
CType {
  schema: {
    '$schema': 'http://kilt-protocol.org/draft-01/ctype#',
    title: 'Drivers License',
    properties: { name: [Object], age: [Object] },
    type: 'object',
    '$id': 'kilt:ctype:0xd8ad043d91d8fdbc382ee0ce33dc96af4ee62ab2d20f7980c49d3e577d80e5f5'
  },
  owner: null,
  hash: '0xd8ad043d91d8fdbc382ee0ce33dc96af4ee62ab2d20f7980c49d3e577d80e5f5'
}
```

## 4. How to build a Claim

To construct a claim, we need to know the structure of the claim that is defined in a CTYPE. Based on the CTYPE, we need to build a basic claim object with the respective fields filled out. In our example, the claim would be:

```typescript
const rawClaim = {
  name: 'Alice',
  age: 29,
}
```

Now we can easily create the KILT compliant claim. We have to include the full CType object, the raw claim object and the address of the owner/creator of the claim in the constructor:

```typescript
const claim = Kilt.Claim.fromCTypeAndClaimContents(
  ctype,
  rawClaim,
  claimer.address
)
```

As a result we get the following KILT claim:

```typescript
Claim {
  cTypeHash: '0xd8ad043d91d8fdbc382ee0ce33dc96af4ee62ab2d20f7980c49d3e577d80e5f5',
  contents: { name: 'Alice', age: 29 },
  owner: '4tJbxxKqYRv3gDvY66BKyKzZheHEH8a27VBiMfeGX2iQrire'
}
```

## 5. How to request, create and send an Attestation

First, we need to build a request for an attestation, which has to include a claim and the address of the Claimer.
(_Note_ that this object offers many more functionalities, however, we do not go into the details here).

#### 5.1. Requesting an Attestation

```typescript
import Kilt from '@kiltprotocol/sdk-js'

const requestForAttestation = Kilt.RequestForAttestation.fromClaimAndIdentity(
  claim,
  claimer
)
```

The `requestForAttestation` object looks like this:

```typescript
RequestForAttestation {
  claim: Claim {
    cTypeHash: '0xd8ad043d91d8fdbc382ee0ce33dc96af4ee62ab2d20f7980c49d3e577d80e5f5',
    contents: { name: 'Alice', age: 29 },
    owner: '4tJbxxKqYRv3gDvY66BKyKzZheHEH8a27VBiMfeGX2iQrire'
  },
  claimHashes: [
    '0x051e915e7f2803b54ab30d7206605662b55118412b7f295f30614b3940a2d539',
    '0x87a924cba55705004adb0459ebdea0129abb7224f46f54e04da82790872fe435',
    '0xfad78ebe1b27bdd09514b8d04361859677252457f88c2ff5c6dc777fd5cc9a22'
  ],
  claimNonceMap: {
    '0x824e3be9e41827b05a6960edc1978c127d5fc8f4dfcc0ce832ea929c77f0d4e5': '8981fcea-c3ab-49e3-ae61-3b5fcc5ee81b',
    '0xa919076ce52e7a5e3d90fb3b8b7d0f8931cbfb3c8ab92d25369bb977948e6b71': 'c64b3f6a-23f4-4b5e-abd3-ad19f50385db',
    '0x9848c59c5ec1e05bf60e49736623ee1eb531496a53f04322d9442cf49d96333c': 'ce9fbef1-ec96-47f5-b217-a7c14131a637'
  },
  legitimations: [],
  delegationId: null,
  rootHash: '0x68afffbf7a554209f645d04a23f34aeb1c370b9dae609e4702d257514c51ce58',
  claimerSignature: '0x01744511d6c594876f12295473721b30bbc6f355bc73e33464425f2db56e3e4a2e2de5df463e9483ce6ea9daaa5b3a28b779fd7a479d065be9052c7e7956445785'
}
```

#### 5.2. Sending an Attestation

Before we can send the request for an attestation to an Attester, we should first create an Attester identity, like done [above](#how-to-generate-an-identity).

```typescript
const attesterMnemonic = Kilt.Identity.generateMnemonic()
// Alternatively, a well-known mnemonic is -> prepare neither execute excuse return visit claim hill around riot valid humor
const attester = Kilt.Identity.buildFromMnemonic(mnemonic)
// Using the well-known mnemonic, attester.address = 4tEpuncfo6HYdkH8LKg4KJWYSB3mincgdX19VHivk9cxSz3F
```

If the Attester doesn't live on the same machine, we need to send them a message with the request.
KILT contains a simple messaging system and we describe it through the following example.

First, we create the request for attestation message which the Claimer encrypts with the public key of the Attester:

```typescript
import Kilt, { MessageBody } from '@kiltprotocol/sdk-js'

const messageBody: MessageBody = {
  content: { requestForAttestation },
  type: Kilt.Message.BodyType.REQUEST_ATTESTATION_FOR_CLAIM,
}
const message = new Kilt.Message(
  messageBody,
  claimer.getPublicIdentity(),
  attester.getPublicIdentity()
)
```

The complete `message` looks as follows:

```typescript
Message {
  body: {
    content: { requestForAttestation: [RequestForAttestation] },
    type: 'request-attestation-for-claim'
  },
  createdAt: 1595252779597,
  receiverAddress: '4tEpuncfo6HYdkH8LKg4KJWYSB3mincgdX19VHivk9cxSz3F',
  senderAddress: '4tJbxxKqYRv3gDvY66BKyKzZheHEH8a27VBiMfeGX2iQrire',
  senderBoxPublicKey: '0x04c84fc046c9c783161d9f60a9b884592e58388a99eed2b3824e90951980dd25',
  message: '0xFEED....CAFE',
  nonce: '0x231e9050c63838987c4d956592550fccacf7fd2d065f7e0c',
  hash: '0x60ab82bf615c024ec662b80edbe5f84cb4bcea515fb845c1b0ce21e30d757378',
  signature: '0x01ea1b24e07cc5830764ed3b23631d0d894738384f3ae321d23bcf1501d2893761c92d38fccb8e7269325c03a62e31f36fb3ce23f76de5811a718b73888d2fab89'
}
```

The message can be encrypted as follows:

```typescript
const encrypted = message.encrypt(claime, attester.getPublicIdentity())
```

The messaging system is transport agnostic.

```typescript
const decrypted = Kilt.Message.decrypt(encrypted, attester)
```

As sender identity and message validity are also checked during decryption, if the decryption process completes successfully, you can assume that the sender of the message is also the owner of the claim, as the two identities match.
At this point the Attester has the original request for attestation object:

```typescript
if (
  decrypted.body.type === Kilt.Message.BodyType.REQUEST_ATTESTATION_FOR_CLAIM
) {
  const extractedRequestForAttestation: IRequestForAttestation =
    decrypted.body.content.requestForAttestation
}
```

The Attester creates the attestation based on the IRequestForAttestation object she received:

```typescript
const attestation = Kilt.Attestation.fromRequestAndPublicIdentity(
  extractedRequestForAttestation,
  attester.getPublicIdentity()
)
```

The complete `attestation` object looks as follows:

```typescript
Attestation {
  claimHash: '0x7e72a141ae9581dfb7a4d5bc27c84a41366b8ba9bea558fbddd2d9997d3d4c2b',
  cTypeHash: '0xd8ad043d91d8fdbc382ee0ce33dc96af4ee62ab2d20f7980c49d3e577d80e5f5',
  delegationId: null,
  owner: '4tEpuncfo6HYdkH8LKg4KJWYSB3mincgdX19VHivk9cxSz3F',
  revoked: false
}
```

Now the Attester must store the attestation on the blockchain, which also costs tokens:

```typescript
const tx = await attestation.store()
await Kilt.BlockchainUtils.submitSignedTx(tx)
```

The request for attestation is fulfilled with the attestation, but it needs to be combined into the `AttestedClaim` object before sending it back to the Claimer:

```typescript
const attestedClaim = Kilt.AttestedClaim.fromRequestAndAttestation(
  extractedRequestForAttestation,
  attestation
)
```

The complete `attestedClaim` object looks as follows:

```typescript
AttestedClaim {
  request: RequestForAttestation {
    claim: Claim {
      cTypeHash: '0xd8ad043d91d8fdbc382ee0ce33dc96af4ee62ab2d20f7980c49d3e577d80e5f5',
      contents: [Object],
      owner: '4tJbxxKqYRv3gDvY66BKyKzZheHEH8a27VBiMfeGX2iQrire'
    },
    claimHashes: [
      '0x20dd4bb18fd12025cf652db358bc82849ff632ec3e6382ca120a3eb7b138f2b2',
      '0x2573b10946e030bd360d78dff267949129cfad39cc62a9c0e7c882c0c50f640b',
      '0xa31383cf733c4b73406eb4fab8b18148eee4e447b6b525edf248186303a1b2cd'
    ],
    claimNonceMap: {
      '0xe9173f9ff8fd2150e61302fae998dc297624de0b37d63da9a0e24d1ef9a02783': '5f702e9d-a978-4225-9c71-3aeaca96813c',
      '0xa919076ce52e7a5e3d90fb3b8b7d0f8931cbfb3c8ab92d25369bb977948e6b71': '7ee86b0c-0810-4793-b7f4-ee037cdc5e1b',
      '0x9848c59c5ec1e05bf60e49736623ee1eb531496a53f04322d9442cf49d96333c': '59e2dec6-9fe9-4f22-a703-3defe45c9c5e'
    },
    legitimations: [],
    delegationId: null,
    rootHash: '0x7e72a141ae9581dfb7a4d5bc27c84a41366b8ba9bea558fbddd2d9997d3d4c2b',
    claimerSignature: '0x01aacef00e5fb93658754dbe1678c50c3d5a5085257a6b194f29b1fa2ea37aac4b15e63a758422984ef73c44954a758762821cf29b1708eac69c4b5896c561818d'
  },
  attestation: Attestation {
    claimHash: '0x7e72a141ae9581dfb7a4d5bc27c84a41366b8ba9bea558fbddd2d9997d3d4c2b',
    cTypeHash: '0xd8ad043d91d8fdbc382ee0ce33dc96af4ee62ab2d20f7980c49d3e577d80e5f5',
    delegationId: null,
    owner: '4tEpuncfo6HYdkH8LKg4KJWYSB3mincgdX19VHivk9cxSz3F',
    revoked: false
  }
}
```

The Attester has to send the `attestedClaim` object back to the Claimer in the following message:

```typescript
const messageBodyBack: MessageBody = {
  content: attestedClaim,
  type: Kilt.Message.BodyType.SUBMIT_ATTESTATION_FOR_CLAIM,
}
const messageBack = new Kilt.Message(
  messageBodyBack,
  attester.getPublicIdentity(),
  claimer.getPublicIdentity()
)
```

The complete `messageBack` message then looks as follows:

```typescript
Message {
  body: {
    content: AttestedClaim {
      request: [RequestForAttestation],
      attestation: [Attestation]
    },
    type: 'submit-attestation-for-claim'
  },
  createdAt: 1595254601814,
  receiverAddress: '4tJbxxKqYRv3gDvY66BKyKzZheHEH8a27VBiMfeGX2iQrire',
  senderAddress: '4tEpuncfo6HYdkH8LKg4KJWYSB3mincgdX19VHivk9cxSz3F',
  senderBoxPublicKey: '0x97a9f05a70fe934b365d8b63dea7424b4070d49f64f2baa70e74d984da797d2d',
  message: '0xFEED...CAFE',
  nonce: '0x8f18d3394f4d325106c7b618046f6a8415bff1d5b4d267a8',
  hash: '0x4f4108cf390eda665315cbff7cc21c155ae5895918a8691b04e0c27b803c3bc8',
  signature: '0x01ee177a0ce94603de8958f854d7cec84adc09f6f5ec400e1432dfe6cf69418174b8c841f92664dd7c89818560aafee747e453200dab8a47b39a5fdfa3b4b3d880'
}
```

After receiving the message, the Claimer just needs to save it and use it later for verification:

```typescript
let myAttestedClaim: AttestedClaim
if (
  messageBack.body.type === Kilt.Message.BodyType.SUBMIT_ATTESTATION_FOR_CLAIM
) {
  myAttestedClaim = Kilt.AttestedClaim.fromAttestedClaim({
    ...messageBack.body.content,
    request: requestForAttestation,
  })
}
```

## 6. How to verify a Claim

As in the attestation, you need a second identity to act as the verifier:

```typescript
const verifierMnemonic = Kilt.Identity.generateMnemonic()
const verifier = Kilt.Identity.buildFromMnemonic(verifierMnemonic)
```

Before a claimer sends any data to a verifier, the verifier needs to initiate the verification process by requesting a presentation for a specific CTYPE.
Therefore, the verifier knows which properties are included in the attested claim.
A claimer can also hide selected properties from their credential.
This is an **important feature for the privacy of a claimer** as this enables them to only show necessary properties for a specific verification.

### 6.1. Request presentation for CTYPE

```typescript
const messageBodyForClaimer: MessageBody = {
  type: Kilt.Message.BodyType.REQUEST_CLAIMS_FOR_CTYPES,
  content: { ctypes: [ctype.hash] },
}
const messageForClaimer = new Kilt.Message(
  messageBodyForClaimer,
  verifier.getPublicIdentity(),
  claimer.getPublicIdentity()
)
```

Now the claimer can send a message to the verifier including the attested claim.
They may choose to create a copy disclosing only selected properties. In the following example, we only disclose the `name` attribute of our credential, omitting `age`:

```typescript
const credentialCopy = myAttestedClaim.createPresentation(['name'])

const messageBodyForVerifier: MessageBody = {
  content: [credentialCopy],
  type: Kilt.Message.BodyType.SUBMIT_CLAIMS_FOR_CTYPES,
}
const messageForVerifier = new Kilt.Message(
  messageBodyForVerifier,
  claimer.getPublicIdentity(),
  verifier.getPublicIdentity()
)

const encrypted = messageForVerifier.encrypt(
  claimer,
  verifier.getPublicIdentity()
)
```

### 6.2. Verify presentation

When verifying the claimer's message, the verifier checks that 3 important requirements are met:

- The credential is valid, i.e. it has been registered to the public ledger, has not been revoked, and the data has not been tampered with.
- The attester who registered the credential is one that this verifier trusts.
- The submission is coming from the legitimate owner of this credential, i.e. the credential has not been stolen.

```typescript
const messageForVerifier = Kilt.Message.decrypt(encrypted, verifier)
// Our messages are signed, so we authenticate the sender already during decryption, which internally calls:
Kilt.Message.ensureHashAndSignature(encrypted, claimer.address)
Kilt.Message.ensureOwnerIsSender(messageForVerifier)

if (
  messageForVerifier.body.type ===
  Kilt.Message.BodyType.SUBMIT_CLAIMS_FOR_CTYPES
) {
  const claims = messageForVerifier.body.content
  console.log('Attested claims from verifier perspective:\n', claims)

  const credential = Kilt.AttestedClaim.fromAttestedClaim(claims[0])

  // credential is registered on chain, has not been tampered with, and has not been revoked
  const isValid = await credential.verify()
  console.log('Verification success?', isValid)

  // AttestedClaim exposes attester address to compare against a whitelist of trusted attesters
  console.log('Attester address:', credential)
}
```

### 6.3. Replay Protection

In certain use cases, an attacker may intercept and copy credential submissions traveling from claimers to verifiers in an attempt to convince the verifier to accept the credential submission again later on.
To give an example for illustration purposes only, think of a turnstile that allows passage only upon presentation of a valid access credential.
To prevent these types of attacks, KILT messages are timestamped and expose a unique identifier (the message hash).
Verifiers should impose limits on the acceptable range for these timestamps and keep a record of previous submissions, which can be purged after their acceptance range has run out.

Define acceptance range and set up a record of past submissions:

```typescript
const MAX_ACCEPTED_AGE = 60_000 // ms -> 1 minute
const MIN_ACCEPTED_AGE = -1_000 // allow for some imprecision in system time
const submissions = new Map<string, number>()
```

Check record for each incoming message and update if accepted:

```typescript
// is hash fresh and createdAt recent ?
if (
  submissions.has(encrypted.hash) ||
  encrypted.createdAt < Date.now() - MAX_ACCEPTED_AGE ||
  encrypted.createdAt > Date.now() - MIN_ACCEPTED_AGE
) {
  // no -> reject message
} else {
  submissions.set(encrypted.hash, encrypted.createdAt)
  // yes -> accept & process message
}
```

Purge at regular intervals:

```typescript
setInterval(() => {
  const maxTime = Date.now() - MAX_ACCEPTED_AGE
  submissions.forEach((timestamp, hash) => {
    if (timestamp < maxTime) submissions.delete(hash)
  })
}, 1000)
```

## 7. Disconnect from chain

Closing the connection to your chain is as simple as connecting to it:

```typescript
await Kilt.disconnect()
```
