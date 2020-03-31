/**
 * @packageDocumentation
 * @ignore
 */

import { AnyJson } from '@polkadot/types/types'
import { getCached } from '../blockchainApiConnection'
import Blockchain, { QueryResult } from '../blockchain/Blockchain'
import { CodecWithId } from './DelegationDecoder'
import { IDelegationBaseNode } from '../types/Delegation'

function isString(element: AnyJson): element is string {
  return typeof element === 'string'
}

function decodeDelegatedAttestations(queryResult: QueryResult): string[] {
  const json =
    queryResult && queryResult.encodedLength ? queryResult.toJSON() : []
  if (json instanceof Array) {
    const delegatedAttestations: string[] = json.filter<string>(isString)
    return delegatedAttestations
  }
  return []
}

export async function getAttestationHashes(
  id: IDelegationBaseNode['id']
): Promise<string[]> {
  const blockchain = await getCached()
  const encodedHashes = await blockchain.api.query.attestation.delegatedAttestations(
    id
  )
  return decodeDelegatedAttestations(encodedHashes)
}

export async function getChildIds(
  id: IDelegationBaseNode['id']
): Promise<string[]> {
  const blockchain = await getCached()
  const childIds = Blockchain.asArray(
    await blockchain.api.query.delegation.children(id)
  )
  return childIds.filter((e): e is string => typeof e === 'string')
}

export async function fetchChildren(
  childIds: string[]
): Promise<CodecWithId[]> {
  const blockchain = await getCached()
  const val: CodecWithId[] = await Promise.all(
    childIds.map(async (childId: string) => {
      const queryResult: QueryResult = await blockchain.api.query.delegation.delegations(
        childId
      )
      return {
        id: childId,
        codec: queryResult,
      }
    })
  )
  return val
}
