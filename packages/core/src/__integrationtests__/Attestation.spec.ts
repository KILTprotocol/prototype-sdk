/**
 * @packageDocumentation
 * @group integration/attestation
 * @ignore
 */

import { IAttestedClaim, IClaim } from '@kiltprotocol/types'
import Attestation from '../attestation/Attestation'
import { revoke } from '../attestation/Attestation.chain'
import AttestedClaim from '../attestedclaim/AttestedClaim'
import {
  IS_IN_BLOCK,
  IS_READY,
  submitTxWithReSign,
} from '../blockchain/Blockchain.utils'

import { config, disconnect } from '../kilt'
import Claim from '../claim/Claim'
import CType from '../ctype/CType'
import { ExtrinsicErrors } from '../errorhandling/ExtrinsicError'
import Identity from '../identity/Identity'
import RequestForAttestation from '../requestforattestation/RequestForAttestation'
import {
  CtypeOnChain,
  DriversLicense,
  IsOfficialLicenseAuthority,
  wannabeAlice,
  wannabeBob,
  wannabeFaucet,
  WS_ADDRESS,
} from './utils'

import '../../../../testingTools/jestErrorCodeMatcher'

let alice: Identity
beforeAll(async () => {
  config({ address: WS_ADDRESS })
  alice = Identity.buildFromURI('//Alice')
})

describe('handling attestations that do not exist', () => {
  it('Attestation.query', async () => {
    return expect(Attestation.query('0x012012012')).resolves.toBeNull()
  }, 30_000)

  it('Attestation.revoke', async () => {
    return expect(
      Attestation.revoke('0x012012012', alice, 0).then((tx) =>
        submitTxWithReSign(tx, alice, { resolveOn: IS_IN_BLOCK })
      )
    ).rejects.toThrow()
  }, 30_000)
})

describe('When there is an attester, claimer and ctype drivers license', () => {
  let faucet: Identity
  let attester: Identity
  let claimer: Identity

  beforeAll(async () => {
    faucet = wannabeFaucet
    attester = wannabeAlice
    claimer = wannabeBob

    const ctypeExists = await CtypeOnChain(DriversLicense)
    // console.log(`ctype exists: ${ctypeExists}`)
    // console.log(`verify stored: ${await DriversLicense.verifyStored()}`)
    if (!ctypeExists) {
      await DriversLicense.store(attester).then((tx) =>
        submitTxWithReSign(tx, attester, { resolveOn: IS_READY })
      )
    }
  }, 60_000)

  it('should be possible to make a claim', async () => {
    const content: IClaim['contents'] = { name: 'Ralph', age: 12 }
    const claim = Claim.fromCTypeAndClaimContents(
      DriversLicense,
      content,
      claimer.address
    )
    const request = RequestForAttestation.fromClaimAndIdentity(claim, claimer)
    expect(request.verifyData()).toBeTruthy()
    expect(request.claim.contents).toMatchObject(content)
  })

  it('should be possible to attest a claim', async () => {
    const content: IClaim['contents'] = { name: 'Ralph', age: 12 }

    const claim = Claim.fromCTypeAndClaimContents(
      DriversLicense,
      content,
      claimer.address
    )
    const request = RequestForAttestation.fromClaimAndIdentity(claim, claimer)
    expect(request.verifyData()).toBeTruthy()
    expect(request.verifySignature()).toBeTruthy()
    const attestation = Attestation.fromRequestAndPublicIdentity(
      request,
      attester.getPublicIdentity()
    )
    await attestation
      .store(attester)
      .then((tx) =>
        submitTxWithReSign(tx, attester, { resolveOn: IS_IN_BLOCK })
      )
    const aClaim = AttestedClaim.fromRequestAndAttestation(request, attestation)
    expect(aClaim.verifyData()).toBeTruthy()
    await expect(aClaim.verify()).resolves.toBeTruthy()
  }, 60_000)

  it('should not be possible to attest a claim w/o tokens', async () => {
    const content: IClaim['contents'] = { name: 'Ralph', age: 12 }

    const claim = Claim.fromCTypeAndClaimContents(
      DriversLicense,
      content,
      claimer.address
    )
    const request = RequestForAttestation.fromClaimAndIdentity(claim, claimer)
    expect(request.verifyData()).toBeTruthy()
    expect(request.verifySignature()).toBeTruthy()
    const attestation = Attestation.fromRequestAndPublicIdentity(
      request,
      attester.getPublicIdentity()
    )

    const bobbyBroke = Identity.buildFromMnemonic(Identity.generateMnemonic())

    await expect(
      attestation.store(bobbyBroke).then((tx) =>
        submitTxWithReSign(tx, bobbyBroke, {
          resolveOn: IS_IN_BLOCK,
        })
      )
    ).rejects.toThrow()
    const aClaim = AttestedClaim.fromRequestAndAttestation(request, attestation)

    await expect(aClaim.verify()).resolves.toBeFalsy()
  }, 60_000)

  it('should not be possible to attest a claim on a Ctype that is not on chain', async () => {
    const badCtype = CType.fromSchema({
      $id: 'kilt:ctype:0x1',
      $schema: 'http://kilt-protocol.org/draft-01/ctype#',
      title: 'badDriversLicense',
      properties: {
        name: {
          type: 'string',
        },
        weight: {
          type: 'integer',
        },
      },
      type: 'object',
    })

    const content: IClaim['contents'] = { name: 'Ralph', weight: 120 }
    const claim = Claim.fromCTypeAndClaimContents(
      badCtype,
      content,
      claimer.address
    )
    const request = RequestForAttestation.fromClaimAndIdentity(claim, claimer)
    const attestation = Attestation.fromRequestAndPublicIdentity(
      request,
      attester.getPublicIdentity()
    )
    await expect(
      attestation.store(attester).then((tx) =>
        submitTxWithReSign(tx, attester, {
          resolveOn: IS_IN_BLOCK,
        })
      )
    ).rejects.toThrowErrorWithCode(
      ExtrinsicErrors.CType.ERROR_CTYPE_NOT_FOUND.code
    )
  }, 60_000)

  describe('when there is an attested claim on-chain', () => {
    let attClaim: AttestedClaim

    beforeAll(async () => {
      const content: IClaim['contents'] = { name: 'Rolfi', age: 18 }
      const claim = Claim.fromCTypeAndClaimContents(
        DriversLicense,
        content,
        claimer.address
      )
      const request = RequestForAttestation.fromClaimAndIdentity(claim, claimer)
      const attestation = Attestation.fromRequestAndPublicIdentity(
        request,
        attester.getPublicIdentity()
      )
      await attestation.store(attester).then((tx) =>
        submitTxWithReSign(tx, attester, {
          resolveOn: IS_IN_BLOCK,
        })
      )
      attClaim = AttestedClaim.fromRequestAndAttestation(request, attestation)
      await expect(attClaim.verify()).resolves.toBeTruthy()
    }, 60_000)

    it('should not be possible to attest the same claim twice', async () => {
      await expect(
        attClaim.attestation.store(attester).then((tx) =>
          submitTxWithReSign(tx, attester, {
            resolveOn: IS_IN_BLOCK,
          })
        )
      ).rejects.toThrowErrorWithCode(
        ExtrinsicErrors.Attestation.ERROR_ALREADY_ATTESTED.code
      )
    }, 15_000)

    it('should not be possible to use attestation for different claim', async () => {
      const content = { name: 'Rolfi', age: 19 }
      const claim = Claim.fromCTypeAndClaimContents(
        DriversLicense,
        content,
        claimer.address
      )
      const request = RequestForAttestation.fromClaimAndIdentity(claim, claimer)
      const fakeAttClaim: IAttestedClaim = {
        request,
        attestation: attClaim.attestation,
      }

      await expect(AttestedClaim.verify(fakeAttClaim)).resolves.toBeFalsy()
    }, 15_000)

    it('should not be possible for the claimer to revoke an attestation', async () => {
      await expect(
        revoke(attClaim.getHash(), claimer, 0).then((tx) =>
          submitTxWithReSign(tx, claimer, { resolveOn: IS_IN_BLOCK })
        )
      ).rejects.toThrowError('not permitted')
      await expect(attClaim.verify()).resolves.toBeTruthy()
    }, 45_000)

    it('should be possible for the attester to revoke an attestation', async () => {
      await expect(attClaim.verify()).resolves.toBeTruthy()
      await revoke(attClaim.getHash(), attester, 0).then((tx) =>
        submitTxWithReSign(tx, attester, { resolveOn: IS_IN_BLOCK })
      )
      await expect(attClaim.verify()).resolves.toBeFalsy()
    }, 40_000)
  })

  describe('when there is another Ctype that works as a legitimation', () => {
    beforeAll(async () => {
      if (!(await CtypeOnChain(IsOfficialLicenseAuthority))) {
        await IsOfficialLicenseAuthority.store(faucet).then((tx) =>
          submitTxWithReSign(tx, faucet, { resolveOn: IS_IN_BLOCK })
        )
      }
      await expect(
        CtypeOnChain(IsOfficialLicenseAuthority)
      ).resolves.toBeTruthy()
    }, 45_000)

    it('can be included in a claim as a legitimation', async () => {
      // make credential to be used as legitimation
      const licenseAuthorization = Claim.fromCTypeAndClaimContents(
        IsOfficialLicenseAuthority,
        {
          LicenseType: "Driver's License",
          LicenseSubtypes: 'sportscars, tanks',
        },
        attester.address
      )
      const request1 = RequestForAttestation.fromClaimAndIdentity(
        licenseAuthorization,
        attester
      )
      const licenseAuthorizationGranted = Attestation.fromRequestAndPublicIdentity(
        request1,
        faucet.getPublicIdentity()
      )
      await licenseAuthorizationGranted
        .store(faucet)
        .then((tx) =>
          submitTxWithReSign(tx, faucet, { resolveOn: IS_IN_BLOCK })
        )
      // make request including legitimation
      const iBelieveICanDrive = Claim.fromCTypeAndClaimContents(
        DriversLicense,
        { name: 'Dominic Toretto', age: 52 },
        claimer.address
      )
      const request2 = RequestForAttestation.fromClaimAndIdentity(
        iBelieveICanDrive,
        claimer,
        {
          legitimations: [
            AttestedClaim.fromRequestAndAttestation(
              request1,
              licenseAuthorizationGranted
            ),
          ],
        }
      )
      const LicenseGranted = Attestation.fromRequestAndPublicIdentity(
        request2,
        attester.getPublicIdentity()
      )
      await LicenseGranted.store(attester).then((tx) =>
        submitTxWithReSign(tx, attester, { resolveOn: IS_IN_BLOCK })
      )
      const license = AttestedClaim.fromRequestAndAttestation(
        request2,
        LicenseGranted
      )
      await Promise.all([
        expect(license.verify()).resolves.toBeTruthy(),
        expect(
          licenseAuthorizationGranted.checkValidity()
        ).resolves.toBeTruthy(),
      ])
    }, 70_000)
  })
})

afterAll(() => {
  disconnect()
})
