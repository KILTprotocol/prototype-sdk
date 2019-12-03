import { IQuote } from '../types/Offer'

export default class Quote implements IQuote {
  public attesterID: IQuote['attesterID']
  public cTypeHash: IQuote['cTypeHash']
  public cost: IQuote['cost']
  public currency: IQuote['currency']
  public offerTimeframe: IQuote['offerTimeframe']
  public termsAndConditions: IQuote['termsAndConditions']
  public version: IQuote['version']

  public constructor(quoteInput: Quote) {
    this.attesterID = quoteInput.attesterID
    this.cTypeHash = quoteInput.cTypeHash
    this.cost = quoteInput.cost
    this.currency = quoteInput.currency
    this.offerTimeframe = quoteInput.offerTimeframe
    this.termsAndConditions = quoteInput.termsAndConditions
    this.version = quoteInput.version
  }
}
