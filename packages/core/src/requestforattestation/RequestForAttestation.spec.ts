/**
 * @group unit/requestforattestation
 */

/* eslint-disable dot-notation */
import { hexToU8a } from '@polkadot/util'
import type {
  IClaim,
  IClaimContents,
  CompressedAttestedClaim,
  ICType,
  CompressedRequestForAttestation,
  IRequestForAttestation,
} from '@kiltprotocol/types'
import { Crypto, SDKErrors } from '@kiltprotocol/utils'
import Attestation from '../attestation/Attestation'
import AttestedClaim from '../attestedclaim/AttestedClaim'
import CType from '../ctype/CType'
import Identity from '../identity/Identity'

import RequestForAttestation from './RequestForAttestation'
import RequestForAttestationUtils from './RequestForAttestation.utils'

import '../../../../testingTools/jestErrorCodeMatcher'

function buildRequestForAttestation(
  claimer: Identity,
  contents: IClaimContents,
  legitimations: AttestedClaim[]
): RequestForAttestation {
  // create claim

  const identityAlice = Identity.buildFromURI('//Alice')

  const rawCType: ICType['schema'] = {
    $id: 'kilt:ctype:0x2',
    $schema: 'http://kilt-protocol.org/draft-01/ctype#',
    title: 'raw ctype',
    properties: {
      name: { type: 'string' },
    },
    type: 'object',
  }

  const testCType: CType = CType.fromSchema(
    rawCType,
    identityAlice.signKeyringPair.address
  )

  const claim: IClaim = {
    cTypeHash: testCType.hash,
    contents,
    owner: claimer.address,
  }
  // build request for attestation with legitimations
  const request = RequestForAttestation.fromClaimAndIdentity(claim, claimer, {
    legitimations,
  })
  return request
}

describe('RequestForAttestation', () => {
  let identityAlice: Identity
  let identityBob: Identity
  let identityCharlie: Identity
  let legitimationRequest: RequestForAttestation
  let legitimationAttestation: Attestation
  let legitimation: AttestedClaim
  let legitimationAttestationCharlie: Attestation
  let legitimationCharlie: AttestedClaim

  beforeEach(async () => {
    identityAlice = Identity.buildFromURI('//Alice')
    identityBob = Identity.buildFromURI('//Bob')
    identityCharlie = Identity.buildFromURI('//Charlie')
    legitimationRequest = buildRequestForAttestation(identityAlice, {}, [])
    // build attestation
    legitimationAttestation = Attestation.fromRequestAndPublicIdentity(
      legitimationRequest,
      identityCharlie.getPublicIdentity()
    )
    // combine to attested claim
    legitimation = new AttestedClaim({
      request: legitimationRequest,
      attestation: legitimationAttestation,
    })

    // build attestation
    legitimationAttestationCharlie = Attestation.fromRequestAndPublicIdentity(
      legitimationRequest,
      identityCharlie.getPublicIdentity()
    )
    // combine to attested claim
    legitimationCharlie = new AttestedClaim({
      request: legitimationRequest,
      attestation: legitimationAttestationCharlie,
    })
  })

  it('verify request for attestation', async () => {
    const request = buildRequestForAttestation(
      identityBob,
      {
        a: 'a',
        b: 'b',
        c: 'c',
      },
      [legitimation]
    )
    // check proof on complete data
    expect(request.verifyData()).toBeTruthy()

    // just deleting a field will result in a wrong proof
    delete request.claimNonceMap[Object.keys(request.claimNonceMap)[0]]
    expect(() => request.verifyData()).toThrowErrorWithCode(
      SDKErrors.ErrorCode.ERROR_NO_PROOF_FOR_STATEMENT
    )
  })

  it('throws on wrong hash in claim hash tree', async () => {
    const request = buildRequestForAttestation(
      identityBob,
      {
        a: 'a',
        b: 'b',
        c: 'c',
      },
      []
    )

    request.claimNonceMap[Object.keys(request.claimNonceMap)[0]] = '1234'
    expect(() => {
      RequestForAttestation.verifyData(request)
    }).toThrow()
  })

  it('compresses and decompresses the request for attestation object', async () => {
    const legitimationAttestationBob = Attestation.fromRequestAndPublicIdentity(
      legitimationRequest,
      identityBob.getPublicIdentity()
    )
    const legitimationBob = new AttestedClaim({
      request: legitimationRequest,
      attestation: legitimationAttestationBob,
    })
    const reqForAtt = buildRequestForAttestation(
      identityBob,
      {
        a: 'a',
        b: 'b',
        c: 'c',
      },
      [legitimationCharlie, legitimationBob]
    )

    const compressedLegitimationCharlie: CompressedAttestedClaim = [
      [
        [
          legitimationCharlie.request.claim.cTypeHash,
          legitimationCharlie.request.claim.owner,
          legitimationCharlie.request.claim.contents,
        ],
        legitimationCharlie.request.claimNonceMap,
        legitimationCharlie.request.claimerSignature,
        legitimationCharlie.request.claimHashes,
        legitimationCharlie.request.rootHash,
        [],
        legitimationCharlie.request.delegationId,
      ],
      [
        legitimationCharlie.attestation.claimHash,
        legitimationCharlie.attestation.cTypeHash,
        legitimationCharlie.attestation.owner,
        legitimationCharlie.attestation.revoked,
        legitimationCharlie.attestation.delegationId,
      ],
    ]

    const compressedLegitimationBob: CompressedAttestedClaim = [
      [
        [
          legitimationBob.request.claim.cTypeHash,
          legitimationBob.request.claim.owner,
          legitimationBob.request.claim.contents,
        ],
        legitimationBob.request.claimNonceMap,
        legitimationBob.request.claimerSignature,
        legitimationBob.request.claimHashes,
        legitimationBob.request.rootHash,
        [],
        legitimationBob.request.delegationId,
      ],
      [
        legitimationBob.attestation.claimHash,
        legitimationBob.attestation.cTypeHash,
        legitimationBob.attestation.owner,
        legitimationBob.attestation.revoked,
        legitimationBob.attestation.delegationId,
      ],
    ]

    const compressedReqForAtt: CompressedRequestForAttestation = [
      [
        reqForAtt.claim.cTypeHash,
        reqForAtt.claim.owner,
        reqForAtt.claim.contents,
      ],
      reqForAtt.claimNonceMap,
      reqForAtt.claimerSignature,
      reqForAtt.claimHashes,
      reqForAtt.rootHash,
      [compressedLegitimationCharlie, compressedLegitimationBob],
      reqForAtt.delegationId,
    ]

    expect(RequestForAttestationUtils.compress(reqForAtt)).toEqual(
      compressedReqForAtt
    )

    expect(RequestForAttestationUtils.decompress(compressedReqForAtt)).toEqual(
      reqForAtt
    )

    expect(reqForAtt.compress()).toEqual(compressedReqForAtt)

    expect(RequestForAttestation.decompress(compressedReqForAtt)).toEqual(
      reqForAtt
    )
    compressedReqForAtt.pop()
    delete reqForAtt.claim.owner

    expect(() => {
      RequestForAttestationUtils.compress(reqForAtt)
    }).toThrow()

    expect(() => {
      RequestForAttestationUtils.decompress(compressedReqForAtt)
    }).toThrow()

    expect(() => {
      reqForAtt.compress()
    }).toThrow()

    expect(() => {
      RequestForAttestation.decompress(compressedReqForAtt)
    }).toThrow()
  })

  it('hides claim properties', async () => {
    const request = buildRequestForAttestation(
      identityBob,
      { a: 'a', b: 'b' },
      []
    )
    request.removeClaimProperties(['a'])

    expect((request.claim.contents as any).a).toBeUndefined()
    expect(Object.keys(request.claimNonceMap)).toHaveLength(
      request.claimHashes.length - 1
    )
    expect((request.claim.contents as any).b).toBe('b')
    expect(request.verifyData()).toBe(true)
    expect(request.verifyRootHash()).toBe(true)
  })

  it('should throw error on faulty constructor input', async () => {
    const builtRequest = buildRequestForAttestation(
      identityBob,
      {
        a: 'a',
        b: 'b',
        c: 'c',
      },
      []
    )
    const builtRequestWithLegitimation = buildRequestForAttestation(
      identityBob,
      {
        a: 'a',
        b: 'b',
        c: 'c',
      },
      [legitimationCharlie]
    ) as IRequestForAttestation
    const builtRequestNoLegitimations = {
      ...buildRequestForAttestation(
        identityBob,
        {
          a: 'a',
          b: 'b',
          c: 'c',
        },
        []
      ),
    } as IRequestForAttestation
    delete builtRequestNoLegitimations.legitimations

    const builtRequestMalformedRootHash = {
      ...buildRequestForAttestation(
        identityBob,
        {
          a: 'a',
          b: 'b',
          c: 'c',
        },
        []
      ),
    } as IRequestForAttestation
    builtRequestMalformedRootHash.rootHash = [
      builtRequestMalformedRootHash.rootHash.slice(0, 15),
      (
        (parseInt(builtRequestMalformedRootHash.rootHash.charAt(15), 16) + 1) %
        16
      ).toString(16),
      builtRequestMalformedRootHash.rootHash.slice(16),
    ].join('')
    const builtRequestIncompleteClaimHashTree = {
      ...buildRequestForAttestation(
        identityBob,
        {
          a: 'a',
          b: 'b',
          c: 'c',
        },
        []
      ),
    } as IRequestForAttestation
    const deletedKey = Object.keys(
      builtRequestIncompleteClaimHashTree.claimNonceMap
    )[0]
    delete builtRequestIncompleteClaimHashTree.claimNonceMap[deletedKey]
    builtRequestIncompleteClaimHashTree.rootHash = RequestForAttestation[
      'calculateRootHash'
    ](builtRequestIncompleteClaimHashTree)
    const builtRequestMalformedSignature = {
      ...buildRequestForAttestation(
        identityBob,
        {
          a: 'a',
          b: 'b',
          c: 'c',
        },
        []
      ),
    } as IRequestForAttestation
    const signatureAsBytes = hexToU8a(
      builtRequestMalformedSignature.claimerSignature
    )
    signatureAsBytes[5] += 1
    builtRequestMalformedSignature.claimerSignature = Crypto.u8aToHex(
      signatureAsBytes
    )
    builtRequestMalformedSignature.rootHash = RequestForAttestation[
      'calculateRootHash'
    ](builtRequestMalformedSignature)
    const builtRequestMalformedHashes = {
      ...buildRequestForAttestation(
        identityBob,
        {
          a: 'a',
          b: 'b',
          c: 'c',
        },
        []
      ),
    } as IRequestForAttestation
    Object.entries(builtRequestMalformedHashes.claimNonceMap).forEach(
      ([hash, nonce]) => {
        const scrambledHash = [
          hash.slice(0, 15),
          ((parseInt(hash.charAt(15), 16) + 1) % 16).toString(16),
          hash.slice(16),
        ].join('')
        builtRequestMalformedHashes.claimNonceMap[scrambledHash] = nonce
        delete builtRequestMalformedHashes.claimNonceMap[hash]
      }
    )
    builtRequestMalformedHashes.rootHash = RequestForAttestation[
      'calculateRootHash'
    ](builtRequestMalformedHashes)
    expect(() =>
      RequestForAttestationUtils.errorCheck(builtRequestNoLegitimations)
    ).toThrowError(SDKErrors.ERROR_LEGITIMATIONS_NOT_PROVIDED())
    expect(() =>
      RequestForAttestationUtils.errorCheck(builtRequestMalformedRootHash)
    ).toThrowError(SDKErrors.ERROR_ROOT_HASH_UNVERIFIABLE())
    expect(() =>
      RequestForAttestationUtils.errorCheck(builtRequestIncompleteClaimHashTree)
    ).toThrowErrorWithCode(SDKErrors.ErrorCode.ERROR_NO_PROOF_FOR_STATEMENT)
    expect(() =>
      RequestForAttestationUtils.errorCheck(builtRequestMalformedSignature)
    ).toThrowError(SDKErrors.ERROR_SIGNATURE_UNVERIFIABLE())
    expect(() =>
      RequestForAttestationUtils.errorCheck(builtRequestMalformedHashes)
    ).toThrowErrorWithCode(SDKErrors.ErrorCode.ERROR_NO_PROOF_FOR_STATEMENT)
    expect(() =>
      RequestForAttestationUtils.errorCheck(builtRequest)
    ).not.toThrow()
    expect(() => {
      RequestForAttestationUtils.errorCheck(builtRequestWithLegitimation)
    }).not.toThrow()
  })
  it('checks Object instantiation', async () => {
    const builtRequest = buildRequestForAttestation(
      identityBob,
      {
        a: 'a',
        b: 'b',
        c: 'c',
      },
      []
    )
    expect(builtRequest instanceof RequestForAttestation).toEqual(true)
  })
})
