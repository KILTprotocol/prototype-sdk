/**
 * Copyright 2018-2021 BOTLabs GmbH.
 *
 * This source code is licensed under the BSD 4-Clause "Original" license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * @group unit/balance
 */

import BN from 'bn.js'
import type {
  BalanceNumber,
  BalanceOptions,
  metricPrefix,
} from '@kiltprotocol/types'
import {
  formatKiltBalance,
  convertToTxUnit,
  toFemtoKilt,
  TRANSACTION_FEE,
  fromFemtoKilt,
  balanceNumberToString,
} from './Balance.utils'

const TESTVALUE = new BN('123456789000')
describe('formatKiltBalance', () => {
  const alterExistingOptions: BalanceOptions = {
    decimals: 17,
    withUnit: 'KIL',
  }
  const addingOptions: BalanceOptions = {
    // When enables displays the full unit - micro KILT
    withSiFull: false,
  }
  const baseValue = new BN('1')
  it('formats the given balance', async () => {
    expect(formatKiltBalance(TESTVALUE)).toEqual('123.4567 micro KILT')
    expect(formatKiltBalance(baseValue.mul(new BN(10).pow(new BN(3))))).toEqual(
      '1.0000 pico KILT'
    )
    expect(formatKiltBalance(baseValue.mul(new BN(10).pow(new BN(6))))).toEqual(
      '1.0000 nano KILT'
    )
    expect(formatKiltBalance(baseValue.mul(new BN(10).pow(new BN(9))))).toEqual(
      '1.0000 micro KILT'
    )
    expect(
      formatKiltBalance(baseValue.mul(new BN(10).pow(new BN(12))))
    ).toEqual('1.0000 milli KILT')
    expect(
      formatKiltBalance(baseValue.mul(new BN(10).pow(new BN(15))))
    ).toEqual('1.0000 KILT')
    expect(
      formatKiltBalance(baseValue.mul(new BN(10).pow(new BN(18))))
    ).toEqual('1.0000 Kilo KILT')
    expect(
      formatKiltBalance(baseValue.mul(new BN(10).pow(new BN(21))))
    ).toEqual('1.0000 Mill KILT')
    expect(
      formatKiltBalance(baseValue.mul(new BN(10).pow(new BN(24))))
    ).toEqual('1.0000 Bill KILT')
    expect(
      formatKiltBalance(baseValue.mul(new BN(10).pow(new BN(27))))
    ).toEqual('1.0000 Tril KILT')
  })
  it('changes formatting options for given balances', () => {
    expect(
      formatKiltBalance(
        baseValue.mul(new BN(10).pow(new BN(12))),
        alterExistingOptions
      )
    ).toEqual('10.0000 micro KIL')
    expect(
      formatKiltBalance(
        baseValue.mul(new BN(10).pow(new BN(12))),
        alterExistingOptions
      )
    ).not.toEqual('1.0000 micro KILT')
    expect(
      formatKiltBalance(
        baseValue.mul(new BN(10).pow(new BN(12))),
        addingOptions
      )
    ).toEqual('1.0000 mKILT')
    expect(
      formatKiltBalance(
        baseValue.mul(new BN(10).pow(new BN(18))),
        addingOptions
      )
    ).toEqual('1.0000 kKILT')
    expect(
      formatKiltBalance(
        baseValue.mul(new BN(10).pow(new BN(21))),
        addingOptions
      )
    ).toEqual('1.0000 MKILT')
  })
})

describe('convertToTxUnit', () => {
  it('converts given value with given power to femto KILT', () => {
    expect(new BN(convertToTxUnit(new BN(1), -15).toString())).toEqual(
      new BN(1)
    )
    expect(new BN(convertToTxUnit(new BN(1), -12).toString())).toEqual(
      new BN('1000')
    )
    expect(new BN(convertToTxUnit(new BN(1), -9).toString())).toEqual(
      new BN('1000000')
    )
    expect(new BN(convertToTxUnit(new BN(1), -6).toString())).toEqual(
      new BN('1000000000')
    )
    expect(new BN(convertToTxUnit(new BN(1), -3).toString())).toEqual(
      new BN('1000000000000')
    )
    expect(new BN(convertToTxUnit(new BN(1), 0).toString())).toEqual(
      new BN('1000000000000000')
    )
    expect(new BN(convertToTxUnit(new BN(1), 3).toString())).toEqual(
      new BN('1000000000000000000')
    )
    expect(new BN(convertToTxUnit(new BN(-1), 6).toString())).toEqual(
      new BN('-1000000000000000000000')
    )
    expect(new BN(convertToTxUnit(new BN(1), 9).toString())).toEqual(
      new BN('1000000000000000000000000')
    )
    expect(new BN(convertToTxUnit(new BN(1), 12).toString())).toEqual(
      new BN('1000000000000000000000000000')
    )
    expect(new BN(convertToTxUnit(new BN(1), 15).toString())).toEqual(
      new BN('1000000000000000000000000000000')
    )
    expect(new BN(convertToTxUnit(new BN(1), 18).toString())).toEqual(
      new BN('1000000000000000000000000000000000')
    )
  })
})
describe('balanceNumberToString', () => {
  it('verifies string input for valid number representation', () => {
    expect(() => balanceNumberToString('1.1')).not.toThrowError()
    expect(() => balanceNumberToString('.1')).not.toThrowError()
    expect(() => balanceNumberToString('462246261.14462264')).not.toThrowError()
    expect(() =>
      balanceNumberToString('-462246261.14462264')
    ).not.toThrowError()
  })
  it('string input negative tests', () => {
    expect(() => balanceNumberToString('1.')).toThrowError()
    expect(() => balanceNumberToString('1.1.1')).toThrowError()
    expect(() => balanceNumberToString('462246261..14462264')).toThrowError()
    expect(() => balanceNumberToString('.462246261.14462264')).toThrowError()
    expect(() => balanceNumberToString('.')).toThrowError()
    expect(() => balanceNumberToString('dewf')).toThrowError()
    expect(() => balanceNumberToString('1.24e15')).toThrowError()
    expect(() => balanceNumberToString('-.462246261.14462264')).toThrowError()
    expect(() => balanceNumberToString('.')).toThrowError()
    expect(() => balanceNumberToString('313145314.d')).toThrowError()
    expect(() => balanceNumberToString('1.24e15')).toThrowError()
    expect(() => balanceNumberToString('-.462246261.14462264')).toThrowError()
  })
  it('verifies BN and BigInt', () => {
    expect(() => balanceNumberToString({} as BN)).toThrowError()
    expect(() => balanceNumberToString(([] as unknown) as BN)).toThrowError()
    expect(() =>
      balanceNumberToString(({ toString: 'blurt' } as unknown) as BN)
    ).toThrowError()
    expect(() => balanceNumberToString({} as BigInt)).toThrowError()
    expect(() =>
      balanceNumberToString(([] as unknown) as BigInt)
    ).toThrowError()
    expect(() =>
      balanceNumberToString(({ toLocaleString: 'blurt' } as unknown) as BigInt)
    ).toThrowError()
  })
})
describe('toFemtoKilt', () => {
  it('converts whole KILT', () => {
    expect(toFemtoKilt(new BN(1000)).toString()).toEqual(
      new BN('1000000000000000000').toString()
    )
  })
  it('converts any metric amount', () => {
    expect(new BN(toFemtoKilt('123456789', 'femto').toString())).toEqual(
      new BN('123456789')
    )
    expect(new BN(toFemtoKilt('123456.789', 'pico').toString())).toEqual(
      new BN('123456789')
    )
    expect(new BN(toFemtoKilt('123456.789', 'nano').toString())).toEqual(
      new BN('123456789000')
    )
    expect(new BN(toFemtoKilt('123456.789', 'micro').toString())).toEqual(
      new BN('123456789000000')
    )
    expect(new BN(toFemtoKilt('123456.789', 'milli').toString())).toEqual(
      new BN('123456789000000000')
    )
    expect(new BN(toFemtoKilt('123456.789', 'kilo').toString())).toEqual(
      new BN('123456789000000000000000')
    )
    expect(new BN(toFemtoKilt('123456.789', 'mega').toString())).toEqual(
      new BN('123456789000000000000000000')
    )
    expect(new BN(toFemtoKilt('123456.789', 'mill').toString())).toEqual(
      new BN('123456789000000000000000000')
    )
    expect(new BN(toFemtoKilt('123456.789', 'giga').toString())).toEqual(
      new BN('123456789000000000000000000000')
    )
    expect(new BN(toFemtoKilt('123456.789', 'bill').toString())).toEqual(
      new BN('123456789000000000000000000000')
    )
    expect(new BN(toFemtoKilt('123456.789', 'tera').toString())).toEqual(
      new BN('123456789000000000000000000000000')
    )
    expect(new BN(toFemtoKilt('123456.789', 'tril').toString())).toEqual(
      new BN('123456789000000000000000000000000')
    )
    expect(new BN(toFemtoKilt('123456.789', 'peta').toString())).toEqual(
      new BN('123456789000000000000000000000000000')
    )
    expect(new BN(toFemtoKilt('123456.789', 'exa').toString())).toEqual(
      new BN('123456789000000000000000000000000000000')
    )
    expect(new BN(toFemtoKilt('123.456789', 'zetta').toString())).toEqual(
      new BN('123456789000000000000000000000000000000')
    )
    expect(new BN(toFemtoKilt('0.123456789', 'yotta').toString())).toEqual(
      new BN('123456789000000000000000000000000000000')
    )
  })
  it('handles too many decimal places', () => {
    expect(toFemtoKilt('-0.000001', 'nano').toString()).toEqual(
      new BN('-1').toString()
    )
    expect(() => toFemtoKilt('-0.0000001', 'nano').toString()).toThrowError()
  })
  it('handles invalid input', () => {
    expect(() => toFemtoKilt(undefined!).toString()).toThrowError()

    expect(() => toFemtoKilt({} as BalanceNumber).toString()).toThrowError()
    expect(() =>
      toFemtoKilt(([] as unknown) as BalanceNumber).toString()
    ).toThrowError()
    expect(() =>
      toFemtoKilt(1, 'nono' as metricPrefix).toString()
    ).toThrowError()
  })
  it('handles edge cases', () => {
    expect(() => toFemtoKilt('-2412d.3411').toString()).toThrowError()
    expect(() => toFemtoKilt('-24.1.2').toString()).toThrowError()
    expect(() => toFemtoKilt('1e12').toString()).toThrowError()
    expect(() => toFemtoKilt('').toString()).toThrowError()
    expect(() => toFemtoKilt('.').toString()).toThrowError()
    expect(() => toFemtoKilt('1.').toString()).toThrowError()
    expect(toFemtoKilt('-0').toString()).toEqual(new BN('0').toString())
    expect(toFemtoKilt('-0.000001', 'nano').toString()).toEqual(
      new BN('-1').toString()
    )
    expect(toFemtoKilt('-.25', 'pico').toString()).toEqual(
      new BN('-250').toString()
    )
  })
})
describe('fromFemtoKilt', () => {
  it('converts femtoKilt to whole KILT using convertToTxUnit', () => {
    expect(fromFemtoKilt(new BN('1'))).toEqual(`1.000 femto KILT`)
    expect(fromFemtoKilt(new BN('1000'))).toEqual(`1.000 pico KILT`)
    expect(fromFemtoKilt(new BN('1000000'))).toEqual(`1.000 nano KILT`)
    expect(fromFemtoKilt(new BN('1000000000'))).toEqual(`1.000 micro KILT`)
    expect(fromFemtoKilt(new BN('1000000000000'))).toEqual(`1.000 milli KILT`)
    expect(fromFemtoKilt(new BN('1000000000000000'))).toEqual(`1.000 KILT`)
    expect(fromFemtoKilt(new BN('1000000000000000000'))).toEqual(
      `1.000 Kilo KILT`
    )
    expect(fromFemtoKilt(new BN('1000000000000000000000'))).toEqual(
      `1.000 Mill KILT`
    )
    expect(fromFemtoKilt(new BN('1000000000000000000000000'))).toEqual(
      `1.000 Bill KILT`
    )
    expect(fromFemtoKilt(new BN('1000000000000000000000000000'))).toEqual(
      `1.000 Tril KILT`
    )
    expect(fromFemtoKilt(new BN('1000000000000000000000000000000'))).toEqual(
      `1.000 Peta KILT`
    )
    expect(fromFemtoKilt(new BN('1234'))).toEqual(`1.234 pico KILT`)
    expect(fromFemtoKilt(new BN('1234567'))).toEqual(`1.235 nano KILT`)
    expect(fromFemtoKilt(new BN('1234567890'))).toEqual(`1.235 micro KILT`)
    expect(fromFemtoKilt(new BN('1234567890000'))).toEqual(`1.235 milli KILT`)
    expect(fromFemtoKilt(new BN('1234567890000000'))).toEqual(`1.235 KILT`)
    expect(fromFemtoKilt(new BN('1234567890000000000'))).toEqual(
      `1.235 Kilo KILT`
    )
    expect(fromFemtoKilt(new BN('1234567890000000000000'))).toEqual(
      `1.235 Mill KILT`
    )
    expect(fromFemtoKilt(new BN('1234567890000000000000000'))).toEqual(
      `1.235 Bill KILT`
    )
    expect(fromFemtoKilt(new BN('1234567890000000000000000000'))).toEqual(
      `1.235 Tril KILT`
    )
    expect(fromFemtoKilt(new BN('1234567890000000000000000000000'))).toEqual(
      `1.235 Peta KILT`
    )
  })
  it('returns localized number string', () => {
    expect(
      fromFemtoKilt(new BN('1000000000000000000'), { locale: 'ar-EG' })
    ).toEqual(`١٫٠٠٠ Kilo KILT`)
    expect(
      fromFemtoKilt(new BN('1000000000000000000'), { locale: 'de-DE' })
    ).toEqual(`1,000 Kilo KILT`)
  })
  it('rounds to 3 decimal places', () => {
    expect(fromFemtoKilt(new BN('1234560000000000000'))).toEqual(
      `1.235 Kilo KILT`
    )
    expect(fromFemtoKilt(new BN('12345600000000000000'))).toEqual(
      `12.346 Kilo KILT`
    )
  })
  it('converts negative femtoKilt to whole KILT using convertToTxUnit', () => {
    expect(fromFemtoKilt(new BN('-1000000000000000000'))).toEqual(
      `-1.000 Kilo KILT`
    )
  })
  it('handles invalid input', () => {
    expect(() => fromFemtoKilt(undefined!)).toThrowError()
    expect(() => fromFemtoKilt({} as BN)).toThrowError()
    expect(() => fromFemtoKilt(([] as unknown) as BN)).toThrowError()
    expect(() => fromFemtoKilt({} as BigInt)).toThrowError()
    expect(() => fromFemtoKilt(([] as unknown) as BigInt)).toThrowError()
  })
})

describe('TRANSACTION_FEE', () => {
  it('equals 125 nano KILT', () => {
    expect(formatKiltBalance(TRANSACTION_FEE)).toEqual('125.0000 nano KILT')
  })
})
