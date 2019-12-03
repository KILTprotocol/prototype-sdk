import IClaim from './Claim'
// import IAttestedClaim from './AttestedClaim'
import DelegationNode from '../delegation/DelegationNode'

/**
 * @module TypeInterfaces/Offer
 */
/**
 * Dummy comment needed for correct doc display, do not remove.
 */

export interface ICostBreakdown {
  tax: number
  net: number
  gross: number
}

export interface IQuote {
  attesterID: string
  cTypeHash: IClaim['cTypeHash']
  cost: ICostBreakdown
  currency: string
  offerTimeframe: string
  termsAndConditions: string
  version: string
}

export interface ITerms {
  claim: string
  legitimations: object[]
  delegationId?: DelegationNode['id']
  quote?: IQuote
  prerequisiteClaims?: Array<IClaim['cTypeHash']>
}
