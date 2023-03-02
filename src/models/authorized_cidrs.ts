import * as t from "io-ts";
import { Container } from "@azure/cosmos";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { readonlySetType } from "@pagopa/ts-commons/lib/types";
import { CosmosdbModel, CosmosResource } from "../utils/cosmosdb_model";
import { CIDR } from "../../generated/definitions/CIDR";

export const AUTHORIZED_CIDRS_COLLECTION_NAME = "subscription-cidrs";
const AUTHORIZED_CIDRS_MODEL_PK_FIELD = "id";

/** List of Authorized IP (in CIDRs format) to allow *subscription keys* use */
export const AuthorizedCIDRs = t.interface({
  /** authorized source CIDRs */
  cidrs: readonlySetType(CIDR, "CIDRs"),
  /** related subscription id */
  id: NonEmptyString
});
export type AuthorizedCIDRs = t.TypeOf<typeof AuthorizedCIDRs>;

/** Authorized CIDRs model decorated with Cosmos resource properties */
export const RetrievedAuthorizedCIDRs = t.intersection([
  AuthorizedCIDRs,
  CosmosResource
]);
export type RetrievedAuthorizedCIDRs = t.TypeOf<
  typeof RetrievedAuthorizedCIDRs
>;

/**
 * A model for handling Authorized CIDRs
 */
export class AuthorizedCIDRsModel extends CosmosdbModel<
  AuthorizedCIDRs,
  AuthorizedCIDRs,
  RetrievedAuthorizedCIDRs,
  typeof AUTHORIZED_CIDRS_MODEL_PK_FIELD
> {
  /**
   * Creates a new AuthorizedCIDRs model
   *
   * @param container the Cosmos container client
   */
  constructor(container: Container) {
    super(container, AuthorizedCIDRs, RetrievedAuthorizedCIDRs);
  }
}
