/**
 * Universally unique identifiers (UUIDs) are needed in KILT to uniquely identify specific information.
 *
 * UUIDs are used for example in [[RequestForAttestation]] to generate hashes.
 *
 * @module UUID
 * @packageDocumentation
 */

import { v4 as uuid } from 'uuid'

/**
 * Generates a H256 compliant UUID.
 *
 * @returns The hashed uuid.
 */
export function generate(): string {
  const undashedPaddedUUID = uuid()
    .replace(/-/g, '')
    .padEnd(64, 'F')
  return `0x${undashedPaddedUUID}`
}

export default {
  generate,
}
