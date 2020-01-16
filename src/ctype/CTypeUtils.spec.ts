import { CTypeModel, CTypeInputModel, CTypeWrapperModel } from './CTypeSchema'
import {
  verifyClaimStructure,
  verifySchema,
  verifySchemaWithErrors,
} from './CTypeUtils'
import ICType from '../types/CType'

jest.mock('../blockchain/Blockchain')

const ctypeInput = {
  $id: 'http://example.com/ctype-1',
  $schema: 'http://kilt-protocol.org/draft-01/ctype-input#',
  properties: [
    {
      title: 'First Property',
      $id: 'first-property',
      type: 'integer',
    },
    {
      title: 'Second Property',
      $id: 'second-property',
      type: 'string',
    },
  ],
  type: 'object',
  title: 'CType Title',
  required: ['first-property', 'second-property'],
}

const ctypeWrapperModel: ICType['schema'] = {
  $id: 'http://example.com/ctype-1',
  $schema: 'http://kilt-protocol.org/draft-01/ctype#',
  title: 'title',
  properties: {
    'first-property': { type: 'integer' },
    'second-property': { type: 'string' },
  },
  type: 'object',
}

const goodClaim = {
  'first-property': 10,
  'second-property': '12',
}

const badClaim = {
  'first-property': '1',
  'second-property': '12',
  'third-property': true,
}

describe('CTypeUtils', () => {
  it('verifies claims', () => {
    expect(verifyClaimStructure(goodClaim, ctypeWrapperModel)).toBeTruthy()
    expect(verifyClaimStructure(badClaim, ctypeWrapperModel)).toBeFalsy()
    expect(verifySchemaWithErrors(badClaim, CTypeWrapperModel, [])).toBeFalsy()
    expect(() => {
      verifyClaimStructure(badClaim, ctypeInput)
    }).toThrow(new Error('CType does not correspond to schema'))
  })
  it('verifies ctypes', () => {
    expect(verifySchema(ctypeInput, CTypeInputModel)).toBeTruthy()
    expect(verifySchema(ctypeWrapperModel, CTypeModel)).toBeTruthy()
    expect(verifySchema(ctypeWrapperModel, CTypeInputModel)).toBeFalsy()
    expect(verifySchema(ctypeWrapperModel, CTypeInputModel)).toBeFalsy()
    expect(
      verifySchema(
        {
          $id: 'http://example.com/ctype-1',
          $schema: 'http://kilt-protocol.org/draft-01/ctype-input#',
          properties: [],
          type: 'object',
          title: '',
        },
        CTypeInputModel
      )
    ).toBeFalsy()
  })
})
