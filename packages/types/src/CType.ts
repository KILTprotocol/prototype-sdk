/**
 * Copyright 2018-2021 BOTLabs GmbH.
 *
 * This source code is licensed under the BSD 4-Clause "Original" license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * @packageDocumentation
 * @module ICType
 */

import type { IPublicIdentity } from './PublicIdentity'

export interface ICTypeSchema {
  $id: string
  $schema: string
  title: string
  properties: {
    [key: string]: { $ref?: string; type?: string; format?: string }
  }
  type: 'object'
}

export type CTypeSchemaWithoutId = Omit<ICTypeSchema, '$id'>

export interface ICType {
  hash: string
  owner: IPublicIdentity['address'] | null
  schema: ICTypeSchema
}

export type CompressedCTypeSchema = [
  ICTypeSchema['$id'],
  ICTypeSchema['$schema'],
  ICTypeSchema['title'],
  ICTypeSchema['properties'],
  ICTypeSchema['type']
]

export type CompressedCType = [
  ICType['hash'],
  ICType['owner'],
  CompressedCTypeSchema
]
