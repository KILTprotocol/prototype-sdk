/**
 * Copyright 2018-2021 BOTLabs GmbH.
 *
 * This source code is licensed under the BSD 4-Clause "Original" license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * @packageDocumentation
 * @module IAttestation
 */
import type { ICType } from './CType'
import type { IDelegationBaseNode } from './Delegation'
import type { IPublicIdentity } from './PublicIdentity'

export interface IAttestation {
  claimHash: string
  cTypeHash: ICType['hash']
  owner: IPublicIdentity['address']
  delegationId: IDelegationBaseNode['id'] | null
  revoked: boolean
}

export type CompressedAttestation = [
  IAttestation['claimHash'],
  IAttestation['cTypeHash'],
  IAttestation['owner'],
  IAttestation['revoked'],
  IAttestation['delegationId']
]
