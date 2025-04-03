import * as t from "io-ts";
import { Container } from "@azure/cosmos";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { readonlySetType } from "@pagopa/ts-commons/lib/types";
import { CIDR } from "../../generated/definitions/v2/CIDR";
import {
  CosmosdbModelVersioned,
  RetrievedVersionedModel
} from "../utils/cosmosdb_model_versioned";
import { wrapWithKind } from "../utils/types";

export const SUBSCRIPTION_CIDRS_COLLECTION_NAME = "subscription-cidrs";
export const SUBSCRIPTION_CIDRS_MODEL_PK_FIELD = "subscriptionId";

/** List of Authorized IP (in CIDRs format) to allow *subscription keys* use */
export const SubscriptionCIDRs = t.interface({
  /** source CIDRs */
  cidrs: readonlySetType(CIDR, "CIDRs"),
  /** related subscription id */
  subscriptionId: NonEmptyString
});
export type SubscriptionCIDRs = t.TypeOf<typeof SubscriptionCIDRs>;

export type NewSubscriptionCIDRs = t.TypeOf<typeof NewSubscriptionCIDRs>;
export const NewSubscriptionCIDRs = wrapWithKind(
  SubscriptionCIDRs,
  "INewSubscriptionCIDRs" as const
);

/** Subscription CIDRs model decorated with Cosmos resource properties */
export const RetrievedSubscriptionCIDRs = wrapWithKind(
  t.intersection([SubscriptionCIDRs, RetrievedVersionedModel]),
  "IRetrievedSubscriptionCIDRs" as const
);
export type RetrievedSubscriptionCIDRs = t.TypeOf<
  typeof RetrievedSubscriptionCIDRs
>;

/**
 * A model for handling Subscription CIDRs
 */
export class SubscriptionCIDRsModel extends CosmosdbModelVersioned<
  SubscriptionCIDRs,
  NewSubscriptionCIDRs,
  RetrievedSubscriptionCIDRs,
  typeof SUBSCRIPTION_CIDRS_MODEL_PK_FIELD
> {
  /**
   * Creates a new SubscriptionCIDRs model
   *
   * @param container the Cosmos container client
   */
  constructor(container: Container) {
    super(
      container,
      NewSubscriptionCIDRs,
      RetrievedSubscriptionCIDRs,
      SUBSCRIPTION_CIDRS_MODEL_PK_FIELD
    );
  }
}
