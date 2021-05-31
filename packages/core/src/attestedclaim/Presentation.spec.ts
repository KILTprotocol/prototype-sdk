/**
 * @group unit/presentation
 */

import { Crypto } from '@kiltprotocol/utils'
import AttestedClaim from './AttestedClaim'
import RequestForAttestation from '../requestforattestation'
import Identity from '../identity'
import { Presentation, SignedPresentation } from './Presentation'
import Attestation from '../attestation/Attestation'

let attestedClaim: AttestedClaim
let alice: Identity
let bob: Identity

beforeAll(() => {
  alice = Identity.buildFromURI('//Alice')
  bob = Identity.buildFromURI('//Bob')

  const cTypeHash = Crypto.hashStr('TestCType!')
  const request = RequestForAttestation.fromClaimAndIdentity(
    {
      cTypeHash,
      contents: {
        a: 'a',
        b: 1,
        c: true,
      },
      owner: alice.address,
    },
    alice
  )

  attestedClaim = AttestedClaim.fromRequestAndAttestation(request, {
    owner: bob.address,
    delegationId: null,
    cTypeHash,
    claimHash: request.rootHash,
    revoked: false,
  })
})

it('creates signed presentation', () => {
  let presentation = Presentation.fromAttestedClaims([attestedClaim], {
    signer: alice,
    challenge: 'abc',
  })
  expect(presentation).toMatchObject<Partial<SignedPresentation>>({
    signature: expect.any(String),
    challenge: 'abc',
  })
  expect(presentation.isSigned()).toBe(true)
  expect(presentation.verifyData()).toBe(true)

  presentation = attestedClaim.createPresentation({
    signer: alice,
    challenge: 'abc',
  })
  expect(presentation).toMatchObject<Partial<SignedPresentation>>({
    signature: expect.any(String),
    challenge: 'abc',
  })
  expect(presentation.isSigned()).toBe(true)
  expect(presentation.verifyData()).toBe(true)
})

it('does not verify if signer != owner', () => {
  const presentation = Presentation.fromAttestedClaims([attestedClaim], {
    signer: bob,
    challenge: 'abc',
  })
  expect(presentation).toMatchObject<Partial<SignedPresentation>>({
    signature: expect.any(String),
    challenge: 'abc',
  })
  expect(presentation.isSigned()).toBe(true)
  expect(presentation.verifySignature()).toBe(false)
  expect(presentation.verifyData()).toBe(false)
})

it('does not verify if nonce was changed after signing', () => {
  const presentation = Presentation.fromAttestedClaims([attestedClaim], {
    signer: alice,
    challenge: 'abc',
  })
  presentation.challenge = 'aaa'
  expect(presentation).toMatchObject<Partial<SignedPresentation>>({
    signature: expect.any(String),
    challenge: 'aaa',
  })
  expect(presentation.isSigned()).toBe(true)
  expect(presentation.verifySignature()).toBe(false)
  expect(presentation.verifyData()).toBe(false)
})

it('creates reduced presentations without changing the original', () => {
  // freeze attested claim for later comparison
  const attestedClaimJson = JSON.stringify(attestedClaim)

  let presentation = attestedClaim.createPresentation({
    hideAttributes: ['a'],
  })
  expect(presentation.credentials[0].request.claim.contents).not.toHaveProperty(
    'a'
  )
  expect(presentation.verifyData()).toBe(true)

  presentation = attestedClaim.createPresentation({
    showAttributes: ['a'],
  })
  expect(presentation.credentials[0].request.claim.contents).toEqual({ a: 'a' })
  expect(presentation.verifyData()).toBe(true)
  // attested claim still the same?
  expect(JSON.stringify(attestedClaim)).toEqual(attestedClaimJson)
})

it('verifies signed reduced presentations', () => {
  const presentation = attestedClaim.createPresentation({
    hideAttributes: ['a'],
    signer: alice,
    challenge: 'abc',
  })
  expect(presentation.credentials[0].request.claim.contents).not.toHaveProperty(
    'a'
  )
  expect(presentation.verifyData()).toBe(true)
})

it('verifies signature when calling verify', () => {
  const mock = jest.spyOn(Attestation, 'checkValidity')
  mock.mockImplementation(async () => true)

  let presentation = Presentation.fromAttestedClaims([attestedClaim], {
    signer: alice,
    challenge: 'abc',
  })
  const spy = jest.spyOn(presentation, 'verifySignature')
  expect(presentation.isSigned()).toBe(true)
  expect(presentation.verify()).resolves.toBe(true)
  expect(spy).toHaveBeenCalled()

  presentation = Presentation.fromAttestedClaims([attestedClaim], {
    signer: bob,
    challenge: 'abc',
  })
  expect(presentation.isSigned()).toBe(true)
  expect(presentation.verify()).resolves.toBe(false)
})
