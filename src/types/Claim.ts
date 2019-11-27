/**
 * @module TypeInterfaces/Claim
 */
/**
 * Dummy comment needed for correct doc display, do not remove.
 */
import ICType from './CType'
import IPublicIdentity from './PublicIdentity'

export default interface IClaim {
  cTypeHash: ICType['hash']
  cTypeSchema: ICType['schema'] | null
  contents: object
  owner: IPublicIdentity['address']
}
