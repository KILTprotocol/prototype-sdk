/**
 * Universally unique identifiers (UUIDs) are needed in KILT to uniquely identify specific information.
 *
 * UUIDs are used for example in [[RequestForAttestation]] to generate hashes.
 *
 * @packageDocumentation
 * @module UUID
 */

import { v4 as uuid } from 'uuid'
import { hashStr } from './Crypto'

/**
 * Generates a H256 compliant UUID.
 *
 * @returns The hashed uuid.
 */
export function generate(): string {
  return hashStr(uuid())
}

export default {
  generate,
}
