/**
 * Copyright 2018-2021 BOTLabs GmbH.
 *
 * This source code is licensed under the BSD 4-Clause "Original" license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * @packageDocumentation
 * @module BalanceUtils
 */

import BN from 'bn.js'
import { formatBalance } from '@polkadot/util'
import type {
  BalanceNumber,
  BalanceOptions,
  metricPrefix,
} from '@kiltprotocol/types'

export const KILT_COIN = new BN(1)

export const prefixes = new Map<metricPrefix, number>([
  ['femto', -15],
  ['pico', -12],
  ['nano', -9],
  ['micro', -6],
  ['milli', -3],
  ['centi', -2],
  ['kilt', 0],
  ['kilo', 3],
  ['mega', 6],
  ['mill', 6],
  ['giga', 9],
  ['bill', 9],
  ['tera', 12],
  ['tril', 12],
  ['peta', 15],
  ['exa', 18],
  ['zetta', 21],
  ['yotta', 24],
])

export function formatKiltBalance(
  amount: BN,
  additionalOptions?: BalanceOptions
): string {
  const options = {
    withSi: true,
    decimals: 15,
    withSiFull: true,
    withUnit: 'KILT',
    ...additionalOptions,
  }
  return formatBalance(amount, options)
}

export function convertToTxUnit(balance: BN, power: number): BN {
  return new BN(balance).mul(new BN(10).pow(new BN(15 + power)))
}
/**
 * Safely converts the given [[BalanceNumber]] to a string, using the supplied methods,
 * or it given a string checks for valid number representation.
 *
 * @param input [[BalanceNumber]] to convert.
 * @returns String representation of the given [[BalanceNumber]].
 * @throws On invalid number representation if given a string.
 * @throws On malformed input.
 */
export function balanceNumberToString(input: BalanceNumber): string {
  if (typeof input === 'string') {
    if (!input.match(/^-?\d*\.?\d+$/)) {
      throw new Error('not a string representation of number')
    }
    return input
  }
  if (
    typeof input === 'number' ||
    (typeof input === 'object' &&
      ((input instanceof BN && input.toString) ||
        (input instanceof BigInt && input.toLocaleString)))
  ) {
    return input.toString()
  }
  throw new Error('could not convert to String')
}
/**
 * Converts the given [[BalanceNumber]] to the femto Kilt equivalent.
 *
 * @param input [[BalanceNumber]] to convert.
 * @param unit Metric prefix of the given [[BalanceNumber]].
 * @returns Exact BN representation in femtoKilt, to use in tx and calculations.
 * @throws Unknown metricPrefix, or if the input has too many decimal places for it's unit.
 */
export function toFemtoKilt(
  input: BalanceNumber,
  unit: metricPrefix = 'kilt'
): BN {
  const stringRepresentation = balanceNumberToString(input)

  if (!prefixes.has(unit)) {
    throw new Error('Unknown metric prefix')
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const unitVal = prefixes.get(unit)!
  const negative = stringRepresentation.substring(0, 1) === '-'

  const [integer, fraction] = negative
    ? stringRepresentation.substring(1).split('.')
    : stringRepresentation.split('.')
  if (fraction && fraction.length > unitVal + 15) {
    throw new Error(
      `Too many decimal places: input with unit ${unit} and value ${stringRepresentation} exceeds the ${
        unitVal + 15
      } possible decimal places by ${fraction.length - unitVal + 15}`
    )
  }
  const fractionBN = fraction
    ? convertToTxUnit(new BN(fraction), unitVal - fraction.length)
    : new BN(0)
  const resultingBN = convertToTxUnit(new BN(integer), unitVal).add(fractionBN)

  return resultingBN.mul(new BN(negative ? -1 : 1))
}
/**
 * Converts the given [[BalanceNumber]] to a human readable number with metric prefix and Unit.
 * This function uses the polkadot formatBalance function,
 * it's output can therefore be formatted via the polkadot formatting options.
 *
 * @param input [[BalanceNumber]] to convert from Femto Kilt.
 * @param options [[BalanceOptions]] for internationalization and formatting.
 * @returns String representation of the given [[BalanceNumber]] with unit und metric prefix.
 */
export function fromFemtoKilt(
  input: BalanceNumber,
  options?: BalanceOptions
): string {
  const inputBN = new BN(balanceNumberToString(input))
  const formatted = formatKiltBalance(inputBN, options)
  const [number, ...rest] = formatted.split(' ')
  const localeNumber = new Intl.NumberFormat(options?.locale, {
    minimumFractionDigits: 3,
  }).format(Number(number))
  return `${localeNumber} ${rest.join(' ')}`
}
export const TRANSACTION_FEE = convertToTxUnit(new BN(125), -9)

export default {
  KILT_COIN,
  TRANSACTION_FEE,
  formatKiltBalance,
  toFemtoKilt,
  fromFemtoKilt,
  convertToTxUnit,
}
