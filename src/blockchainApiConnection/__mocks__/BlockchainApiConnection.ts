/**
 * @packageDocumentation
 * @module BlockchainApiConnection
 * @ignore
 * @packageDocumentation
 */

/**
 * Mock implementation of BlockchainApiConnection to specifically mock Substrate api calls that
 * require a connection to a Substrate blockchain.
 *
 * Transaction (tx) calls will return a mocked SubmittableExtrinsic containing a SubmittableResult
 * which will be returned when calling the `.send()` method.
 * This result defaults to `Finalized`, a default which can be changed by means of the `__setDefaultResult()` function:
 * ```
 * require('../blockchainApiConnection/BlockchainApiConnection').__setDefaultResult(
 *   false
 * )
 * const transfer = blockchain.api.tx.balances.transfer(alice.address, amount) // returns a mock SubmittableExtrinsic that has a send() method
 * const result = await blockchain.submitTx(alice, transfer)                   // calls transfer.send() internally
 * ```
 * You can also queue results with
 * ```
 * require('../blockchainApiConnection/BlockchainApiConnection').__queueResults(
 *   [true, false]
 * )
 * ```
 * After queue results have been consumed via tx calls, the mock implementation will resume returning the default result.
 *
 * Mocked query methods return representations of 'not present' by default, such as Option(..., null) or Vec(..., []).
 * You can set different return values during test execution by importing __mocked_api, then calling jest's return
 * value setters `.mockReturnValue` or `.mockReturnValueOnce` on the method you want to modify:
 * ```
 *   const mocked_api = require('../blockchainApiConnection/BlockchainApiConnection').__mocked_api
 *   mocked_api.query.delegation.children.mockReturnValue(
 *     new Vec(
 *       'H256',
 *       ['0x123', '0x456', '0x789']
 *     )
 *   )
 * ```
 * `.mockReturnValue` changes the default return value for the scope of the current test file.
 * `.mockReturnValueOnce()` can be called multiple times to build a queue of return values. After the queue has
 * been emptied by calling the query in question repeatedly, jest will return the default value again.
 *
 */

import { ApiPromise, SubmittableResult } from '@polkadot/api'
import { SubmittableExtrinsic } from '@polkadot/api/promise/types'
import { Option, Tuple, TypeRegistry, u128, Vec } from '@polkadot/types'
import AccountId from '@polkadot/types/generic/AccountId'
import AccountIndex from '@polkadot/types/generic/AccountIndex'
import {
  AccountData,
  AccountInfo,
  ExtrinsicStatus,
} from '@polkadot/types/interfaces'
import Bool from '@polkadot/types/primitive/Bool'
import U32 from '@polkadot/types/primitive/U32'
import BN from 'bn.js'
import IPublicIdentity from 'src/types/PublicIdentity'
import Blockchain from '../../blockchain/Blockchain'

const BlockchainApiConnection = jest.requireActual('../BlockchainApiConnection')
const registry = new TypeRegistry()
const accumulator = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

async function getCached(): Promise<Blockchain> {
  if (!BlockchainApiConnection.instance) {
    BlockchainApiConnection.instance = Promise.resolve(
      new Blockchain(__mocked_api as ApiPromise)
    )
  }
  return BlockchainApiConnection.instance
}

const TxResultsQueue: SubmittableResult[] = []
let defaultTxResult: SubmittableResult = __makeSubmittableResult(true)

class MockSubmittableExtrinsic {
  result: SubmittableResult
  method: string = 'mock tx'

  constructor(result: SubmittableResult) {
    this.result = result
  }

  public sign() {
    return this
  }

  public send(callable: Function) {
    if (callable) {
      callable(this.result)
    }
  }

  public signAndSend(a: any, callable: Function) {
    if (callable) {
      callable(this.result)
    }
  }
}

function __getMockSubmittableExtrinsic(): SubmittableExtrinsic {
  const result: SubmittableResult = TxResultsQueue.shift() || defaultTxResult
  return (new MockSubmittableExtrinsic(result) as any) as SubmittableExtrinsic
}

function __makeSubmittableResult(success: boolean): SubmittableResult {
  const status: ExtrinsicStatus = {
    type: success ? 'Finalized' : 'Invalid',
    isFinalized: success,
    isDropped: false,
    isInvalid: !success,
    isUsurped: false,
    isFuture: false,
    isReady: true,
  } as any

  return new SubmittableResult({
    status,
    events: [
      {
        phase: {
          asApplyExtrinsic: {
            isEmpty: false,
          },
        },
        event: {
          section: 'system',
          index: {
            toHex: jest.fn(() => {
              return '0x0000'
            }),
          },
          // portablegabi checks if a transaction was successful
          method: 'ExtrinsicSuccess',
        },
      } as any,
    ],
  })
}

function __queueResults(results: boolean[]) {
  results.forEach(success => {
    TxResultsQueue.push(__makeSubmittableResult(success))
  })
}

function __setDefaultResult(success: boolean) {
  defaultTxResult = __makeSubmittableResult(success)
}

const __mocked_api: any = {
  rpc: {
    system: {
      chain: jest.fn(),
      name: jest.fn(),
      version: jest.fn(),
    },
    chain: { subscribeNewHeads: jest.fn() },
  },
  tx: {
    attestation: {
      add: jest.fn((claimHash, _cTypeHash) => {
        return __getMockSubmittableExtrinsic()
      }),
      revoke: jest.fn((claimHash: string) => {
        return __getMockSubmittableExtrinsic()
      }),
    },
    balances: {
      transfer: jest.fn(() => __getMockSubmittableExtrinsic()),
    },
    ctype: {
      add: jest.fn((hash, signature) => {
        return __getMockSubmittableExtrinsic()
      }),
    },
    delegation: {
      createRoot: jest.fn((rootId, _ctypeHash) => {
        return __getMockSubmittableExtrinsic()
      }),
      revokeRoot: jest.fn(rootId => {
        return __getMockSubmittableExtrinsic()
      }),
      revokeDelegation: jest.fn(delegationId => {
        return __getMockSubmittableExtrinsic()
      }),
    },
    did: {
      add: jest.fn((sign_key, box_key, doc_ref) => {
        return __getMockSubmittableExtrinsic()
      }),
      remove: jest.fn(() => {
        return __getMockSubmittableExtrinsic()
      }),
    },
    portablegabi: {
      updateAccumulator: jest.fn(acc => {
        // change the accumulator for each update
        accumulator.push(accumulator.length)
        return __getMockSubmittableExtrinsic()
      }),
    },
  },
  query: {
    system: {
      // default return value decodes to BN(0)
      // default return value decodes to AccountInfo with all entries holding BN(0)
      account: jest.fn(
        async (
          address: IPublicIdentity['address'],
          cb
        ): Promise<AccountInfo> => {
          return {
            data: {
              free: new BN(0),
              reserved: new BN(0),
              miscFrozen: new BN(0),
              feeFrozen: new BN(0),
            } as AccountData,
            nonce: new AccountIndex(registry, 0),
          } as AccountInfo
        }
      ),
    },
    attestation: {
      // default return value decodes to [], represents no delegated attestations
      delegatedAttestations: jest.fn(
        async (id: string) => new Vec(registry, 'H256')
      ),
      /* example return value:
      new Vec(
        registry
        'H256',
        ['0x123', '0x456', '0x789']
      )
      */

      // default return value decodes to null, represents attestation not found
      attestations: jest.fn(
        async (claim_hash: string) =>
          new Option(
            registry,
            Tuple.with(['H256', AccountId, 'Option<H256>', Bool])
          )
      ),
      /* example return value:
      new Option(
        registry,
        Tuple.with(
            ['H256', AccountId, 'Option<H256>', Bool]
            ),
            [
              '0x1234',                                            // ctype hash
              '5FA9nQDVg267DEd8m1ZypXLBnvN7SFxYwV7ndqSYGiN9TTpu',  // Account
              null,                                                // delegation-id?
              true,                                                // revoked flag
            ]
          )
      ) */
    },
    balances: {
      // default return value decodes to BN(0), represents unknown and broke accounts
      freeBalance: jest.fn(async (account: string) => new u128(registry)),
    },
    ctype: {
      // default return value decodes to null, represents CTYPE not found
      cTYPEs: jest.fn(async (hash: string) => new Option(registry, AccountId)),
    },
    delegation: {
      // default return value decodes to null, represents delegation not found
      root: jest.fn(
        async (rootId: string) =>
          new Option(registry, Tuple.with(['H256', AccountId, Bool]))
      ),
      /* example return value:
      new Option(
        registry,
        Tuple.with(
          ['H256', AccountId, Bool]
          ),
          [
            '0x1234',                                            // ctype hash
            '5FA9nQDVg267DEd8m1ZypXLBnvN7SFxYwV7ndqSYGiN9TTpu',  // Account
            false,                                               // revoked flag
          ]
        )
      ) */

      // default return value decodes to null, represents delegation not found
      delegations: jest.fn(
        async (delegationId: string) =>
          new Option(
            registry,
            Tuple.with(['H256', 'Option<H256>', AccountId, U32, Bool])
          )
      ),
      /* example return value:
      new Option(
        registry,
        Tuple.with(
          ['H256','Option<H256>',AccountId,U32,Bool]
        ),
        [
          '0x1234',                                            // root-id
          null,                                                // parent-id?
          '5FA9nQDVg267DEd8m1ZypXLBnvN7SFxYwV7ndqSYGiN9TTpu',  // Account
          0,                                                   // permissions
          false,                                               // revoked flag
        ]
      )
    ) */

      // default return value decodes to [], represents: no children found
      children: jest.fn(async (id: string) => new Vec(registry, 'H256')),
      /* example return value:
      new Vec(
        'H256',
        ['0x123', '0x456', '0x789']
      )
      */
    },
    did: {
      // default return value decodes to null, represents dID not found
      dIDs: jest.fn(
        async (address: string) =>
          new Option(registry, Tuple.with(['H256', 'H256', 'Option<Bytes>']))
      ),
      /* example return value:
      new Option(
        registry,
        Tuple.with(
          ['H256','H256','Option<Bytes>']
          ),
          [
            'publicSigningKey',                  // publicSigningKey
            'publicBoxKey',                      // publicBoxKey
            stringToHex('http://myDID.kilt.io'), // document store
          ]
      )
    ) */
    },
    portablegabi: {
      accumulatorList: jest.fn(
        (address: string, index: number) =>
          new Option(registry, 'Vec<u8>', new Vec(registry, 'u8', accumulator))
      ),
      accumulatorCount: jest.fn((address: string) => 1),
    },
  },
  runtimeMetadata: {
    asV11: {
      modules: [],
    },
  },
}

BlockchainApiConnection.getCached = getCached
BlockchainApiConnection.__queueResults = __queueResults
BlockchainApiConnection.__setDefaultResult = __setDefaultResult
BlockchainApiConnection.__mocked_api = __mocked_api

module.exports = BlockchainApiConnection
module.exports.default = BlockchainApiConnection.getCached
