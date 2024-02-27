import * as t from "io-ts";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Container } from "@azure/cosmos";
import { AzureCosmosResource, CosmosdbModel } from "../utils/cosmosdb_model";

export const USER_RC_CONFIGURATIONS_COLLECTION_NAME = "user-configurations";
const USER_RC_CONFIGURATIONS_MODEL_PK_FIELD = "userId";

export const UserRCConfiguration = t.interface({
  userId: NonEmptyString,
  id: NonEmptyString
});
export type UserRCConfiguration = t.TypeOf<typeof UserRCConfiguration>;

export const RetrievedUserRCConfiguration = t.intersection([
  UserRCConfiguration,
  AzureCosmosResource
]);
export type RetrievedUserRCConfiguration = t.TypeOf<
  typeof RetrievedUserRCConfiguration
>;

/**
 * @deprecated This model is deprecated, use the one inside ./remote_content.ts instead
 */
export class UserRCConfigurationModel extends CosmosdbModel<
  UserRCConfiguration,
  UserRCConfiguration,
  RetrievedUserRCConfiguration,
  typeof USER_RC_CONFIGURATIONS_MODEL_PK_FIELD
> {
  /**
   * Creates a new RemoteContentConfiguration model
   *
   * @param container the Cosmos container client
   */
  constructor(container: Container) {
    super(
      container,
      UserRCConfiguration,
      RetrievedUserRCConfiguration
    );
  }
}
