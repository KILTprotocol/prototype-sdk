/**
 * @packageDocumentation
 * @module CTypeUtils
 * @preferred
 */

import Ajv from 'ajv'
import { CTypeModel } from './CTypeSchema'
import ICType from '../types/CType'
import Crypto from '../crypto'

export function verifySchemaWithErrors(
  object: any,
  schema: any,
  messages?: string[]
): boolean {
  const ajv = new Ajv()
  ajv.addMetaSchema(CTypeModel)
  const result = ajv.validate(schema, object)
  if (!result && ajv.errors) {
    if (messages) {
      ajv.errors.forEach((error: any) => {
        messages.push(error.message)
      })
    }
  }
  return !!result
}

export function verifySchema(object: any, schema: any): boolean {
  return verifySchemaWithErrors(object, schema)
}

export function verifyClaimStructure(claim: any, schema: any): boolean {
  if (!verifySchema(schema, CTypeModel)) {
    throw new Error('CType does not correspond to schema')
  }
  return verifySchema(claim, schema)
}

export function getHashForSchema(schema: ICType['schema']): string {
  const schemaWithoutID = { ...schema }
  delete schemaWithoutID.$id
  return Crypto.hashObjectAsStr(schemaWithoutID)
}

/**
 * Validates an array of [[CType]]s against a [[Claim]].
 *
 * @param cType - A [[CType]] that has nested [[CType]]s inside.
 * @param nestedCTypes - An array of [[CType]] schemas.
 * @param claimContents - The contents of a [[Claim]] to be validated.
 * @param messages
 *
 * @returns Whether the contents is valid.
 */

export function validateNestedSchemas(
  cType: ICType['schema'],
  nestedCTypes: Array<ICType['schema']>,
  claimContents: object,
  messages?: string[]
): boolean {
  const ajv = new Ajv()
  ajv.addMetaSchema(CTypeModel)
  const validate = ajv.addSchema(nestedCTypes).compile(cType)
  const result = validate(claimContents)
  if (!result && ajv.errors) {
    if (messages) {
      ajv.errors.forEach((error: any) => {
        messages.push(error.message)
      })
    }
  }
  return !!result
}

export default {
  verifySchema,
  verifySchemaWithErrors,
  verifyClaimStructure,
  getHashForSchema,
  validateNestedSchemas,
}
