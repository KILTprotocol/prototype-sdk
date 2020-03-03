import Claim from './Claim'
import CType, {
  decompressCType,
  compressCType,
  CompressedCType,
  compressCTypeSchema,
} from '../ctype/CType'
import Identity from '../identity/Identity'
import ICType from '../types/CType'

describe('Claim', () => {
  const identityAlice = Identity.buildFromURI('//Alice')

  const claimContents = {
    name: 'Bob',
  }

  const rawCType: ICType['schema'] = {
    $id: 'http://example.com/ctype-1',
    $schema: 'http://kilt-protocol.org/draft-01/ctype#',
    properties: {
      name: { type: 'string' },
    },
    type: 'object',
  }

  const fromRawCType: ICType = {
    schema: rawCType,
    owner: identityAlice.address,
    hash: '',
  }

  const testCType: CType = CType.fromCType(fromRawCType)

  const claim = Claim.fromCTypeAndClaimContents(
    testCType,
    claimContents,
    identityAlice.address
  )

  it('can be made from object', () => {
    const claimObj = JSON.parse(JSON.stringify(claim))
    expect(Claim.fromClaim(claimObj, testCType.schema)).toEqual(claim)
  })

  it('compresses and decompresses the CType object', () => {
    const sortedCompressedCType: CompressedCType = [
      testCType.hash,
      testCType.owner,
      compressCTypeSchema(testCType.schema),
    ]

    expect(compressCType(testCType)).toEqual(sortedCompressedCType)

    expect(decompressCType(sortedCompressedCType)).toEqual(testCType)

    const decompressedCTypeObj = decompressCType(sortedCompressedCType)

    expect(CType.decompress(decompressedCTypeObj)).toEqual(testCType)
  })
})
