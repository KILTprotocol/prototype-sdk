/**
 * Copyright 2018-2021 BOTLabs GmbH.
 *
 * This source code is licensed under the BSD 4-Clause "Original" license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * @packageDocumentation
 * @module IRequestForAttestation
 */

import type { IAttestedClaim, CompressedAttestedClaim } from './AttestedClaim'
import type { IClaim, CompressedClaim } from './Claim'
import type { IDelegationBaseNode } from './Delegation'

export type Hash = string

export type NonceHash = {
  hash: Hash
  nonce?: string
}

export interface IRequestForAttestation {
  claim: IClaim
  claimNonceMap: Record<Hash, string>
  claimHashes: Hash[]
  claimerSignature: string
  delegationId: IDelegationBaseNode['id'] | null
  legitimations: IAttestedClaim[]
  rootHash: Hash
}

export type CompressedRequestForAttestation = [
  CompressedClaim,
  IRequestForAttestation['claimNonceMap'],
  IRequestForAttestation['claimerSignature'],
  IRequestForAttestation['claimHashes'],
  IRequestForAttestation['rootHash'],
  CompressedAttestedClaim[],
  IRequestForAttestation['delegationId']
]
