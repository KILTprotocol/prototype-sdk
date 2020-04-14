/**
 * @group integration/ctype
 */

import { faucet } from './utils'
import CType from '../ctype/CType'
import ICType from '../types/CType'
import { getOwner } from '../ctype/CType.chain'
import { Identity } from '..'
import getCached from '../blockchainApiConnection'
import { generate } from '../util/UUID'

describe('When there is an CtypeCreator and a verifier', () => {
  const CtypeCreator = faucet

  function newCType(identifier: string): CType {
    return CType.fromCType({
      schema: {
        $id: `http://example.com/ctype-10-${identifier}`,
        $schema: 'http://kilt-protocol.org/draft-01/ctype#',
        properties: {
          name: { type: 'string' },
        },
        type: 'object',
      } as ICType['schema'],
    } as ICType)
  }

  it('should not be possible to create a claim type w/o tokens', async () => {
    const BobbyBroke = Identity.buildFromMnemonic()
    const ctype = newCType(generate())
    await expect(ctype.store(BobbyBroke)).rejects.toThrowError()
    await expect(ctype.verifyStored()).resolves.toBeFalsy()
  }, 20_000)

  it('should be possible to create a claim type', async () => {
    const ctype = newCType(generate())
    await ctype.store(CtypeCreator)
    await expect(getOwner(ctype.hash)).resolves.toBe(CtypeCreator.address)
    await expect(ctype.verifyStored()).resolves.toBeTruthy()
  }, 20_000)

  it('should not be possible to create a claim type that exists', async () => {
    const ctype = newCType(generate())
    await expect(ctype.store(CtypeCreator)).resolves.toBeTruthy()
    await expect(ctype.store(CtypeCreator)).rejects.toThrowError(
      'CTYPE already exists'
    )
    // console.log('Triggered error on re-submit')
    await expect(getOwner(ctype.hash)).resolves.toBe(CtypeCreator.address)
  }, 30_000)

  it('should tell when a ctype is not on chain', async () => {
    const iAmNotThere = CType.fromCType({
      schema: {
        $id: 'http://example.com/ctype-2',
        $schema: 'http://kilt-protocol.org/draft-01/ctype#',
        properties: {
          game: { type: 'string' },
        },
        type: 'object',
      } as ICType['schema'],
    } as ICType)

    const iAmNotThereWowner = CType.fromCType({
      schema: {
        $id: 'http://example.com/ctype-2',
        $schema: 'http://kilt-protocol.org/draft-01/ctype#',
        properties: {
          game: { type: 'string' },
        },
        type: 'object',
      } as ICType['schema'],
      owner: CtypeCreator.address,
    } as ICType)

    await Promise.all([
      expect(iAmNotThere.verifyStored()).resolves.toBeFalsy(),
      expect(getOwner(iAmNotThere.hash)).resolves.toBeNull(),
      expect(getOwner('0x012012012')).resolves.toBeNull(),
      expect(iAmNotThereWowner.verifyStored()).resolves.toBeFalsy(),
    ])
  })
})

afterAll(() => {
  return getCached().then((bc) => bc.api.disconnect())
})
