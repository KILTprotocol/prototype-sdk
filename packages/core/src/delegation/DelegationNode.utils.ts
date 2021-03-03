/**
 * @packageDocumentation
 * @ignore
 */

import { IDelegationNode } from '@kiltprotocol/types'

/**
 * Creates a bitset from the permissions in the array where each enum value
 * is used to set the bit flag in the set.
 *
 * ATTEST has `0000000000000001`  (decimal 1).
 * DELEGATE has `0000000000000010` (decimal 2).
 *
 * Adding the enum values results in a decimal representation of the bitset.
 *
 * @param delegation The delegation from which you want to convert the permissions to bitset.
 * @returns The bitset as single value uint8 array.
 */
// eslint-disable-next-line import/prefer-default-export
export default function permissionsAsBitset(
  delegation: IDelegationNode
): Uint8Array {
  const permissionsBitsetData: number = delegation.permissions.reduce(
    (accumulator, currentValue) => accumulator + currentValue
  )
  const uint8: Uint8Array = new Uint8Array(4)
  uint8[0] = permissionsBitsetData
  return uint8
}
