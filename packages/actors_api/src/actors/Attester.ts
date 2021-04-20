/**
 * @packageDocumentation
 * @module Attester
 */

import {
  Attestation,
  PublicIdentity,
  SDKErrors,
  Identity,
  DelegationNodeUtils,
} from '@kiltprotocol/core'
import type {
  IAttestation,
  IMessage,
  IRequestAttestationForClaim,
} from '@kiltprotocol/types'
import Message from '@kiltprotocol/messaging'
import { Blockchain } from '@kiltprotocol/chain-helpers'

export interface IRevocationHandle {
  claimHash: IAttestation['claimHash']
}

/**
 * [ASYNC] Initiates the [[Attestation]] session.
 *
 * @param identity The [[Identity]] representing the entity which is eligible to attest and sign the [[Claim]].
 * @param claimer The [[PublicIdentity]] representing the entity which is eligible to attest and sign the [[Claim]].
 * @returns A session and a message object.
 * The **message** should be sent over to the Claimer to be used in [[requestAttestation]].
 * The **session** should be kept private and used in [[issueAttestation]].
 */
// export async function initiateAttestation(
//   identity: Identity,
//   claimer: IPublicIdentity
// ): Promise<{
//   message: Message
// }> {
//   return {
//     message: new Message(messageBody, identity, claimer),
//   }
// }

/**
 * [ASYNC] Creates an [[Attestation]] for the [[Claim]] inside the request.
 *
 * @param attester The [[Identity]] representing the entity which should attest the [[Claim]].
 * @param message The message result of the Claimer's attestation request in [[requestAttestation]].
 * @param claimer The [[PublicIdentity]] of the claimer. This is also the receiver of the returned message.
 * @throws [[ERROR_MESSAGE_TYPE]].
 * @returns The [[Message]] object containing the [[Attestation]] which should be sent to the Claimer and
 * a handle which can be used to revoke the [[Attestation]] in [[revokeAttestation]].
 */
export async function issueAttestation(
  attester: Identity,
  message: IMessage,
  claimer: PublicIdentity
): Promise<{
  revocationHandle: IRevocationHandle
  message: Message
}> {
  if (message.body.type !== Message.BodyType.REQUEST_ATTESTATION_FOR_CLAIM) {
    throw SDKErrors.ERROR_MESSAGE_TYPE(
      message.body.type,
      Message.BodyType.REQUEST_ATTESTATION_FOR_CLAIM
    )
  }

  const request: IRequestAttestationForClaim = message.body
  // Lets continue with the original object
  const attestation = Attestation.fromRequestAndPublicIdentity(
    request.content.requestForAttestation,
    attester.getPublicIdentity()
  )

  const tx = await attestation.store()
  Blockchain.signAndSubmitTx(tx, attester, { reSign: true })

  const revocationHandle = { claimHash: attestation.claimHash }
  return {
    message: new Message(
      {
        content: {
          attestation,
        },
        type: Message.BodyType.SUBMIT_ATTESTATION_FOR_CLAIM,
      },
      attester,
      claimer
    ),
    revocationHandle,
  }
}

/**
 * [ASYNC] Revokes an [[Attestation]] created in [[issueAttestation]].
 *
 * @param attester The attester [[Identity]] which signed the [[Attestation]] in [[issueAttestation]].
 * @param revocationHandle A reference to the [[Attestation]] which was created in [[issueAttestation]].
 * @throws [[ERROR_UNAUTHORIZED]], [[ERROR_NOT_FOUND]].
 */
export async function revokeAttestation(
  attester: Identity,
  revocationHandle: IRevocationHandle
): Promise<void> {
  const attestation = await Attestation.query(revocationHandle.claimHash)

  if (attestation === null) {
    throw SDKErrors.ERROR_NOT_FOUND('Attestation not on chain')
  }
  // count the number of steps we have to go up the delegation tree for calculating the transaction weight
  const delegationTreeTraversalSteps = await DelegationNodeUtils.countNodeDepth(
    attester,
    attestation
  )

  const tx = await Attestation.revoke(
    revocationHandle.claimHash,
    attester,
    delegationTreeTraversalSteps
  )
  Blockchain.signAndSubmitTx(tx, attester, { reSign: true })
}
