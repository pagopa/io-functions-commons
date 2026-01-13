import { Container } from "@azure/cosmos";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/lib/ReadonlyArray";
import * as TE from "fp-ts/lib/TaskEither";
import * as t from "io-ts";

import { asyncIterableToArray } from "../utils/async";
import {
  AzureCosmosResource,
  CosmosdbModel,
  CosmosErrors,
  toCosmosErrorResponse,
} from "../utils/cosmosdb_model";

export const USER_RC_CONFIGURATIONS_COLLECTION_NAME = "user-configurations";
export const USER_RC_CONFIGURATIONS_MODEL_PK_FIELD = "userId";

export const UserRCConfiguration = t.interface({
  id: NonEmptyString,
  userId: NonEmptyString,
});
export type UserRCConfiguration = t.TypeOf<typeof UserRCConfiguration>;

export const RetrievedUserRCConfiguration = t.intersection([
  UserRCConfiguration,
  AzureCosmosResource,
]);
export type RetrievedUserRCConfiguration = t.TypeOf<
  typeof RetrievedUserRCConfiguration
>;

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
    super(container, UserRCConfiguration, RetrievedUserRCConfiguration);
  }

  /**
   * Returns all the UserRCConfiguration associated to the userId
   *
   * @param userId The userId of the caller
   */
  public findAllByUserId(
    userId: NonEmptyString,
  ): TE.TaskEither<CosmosErrors, readonly RetrievedUserRCConfiguration[]> {
    const querySpec = {
      parameters: [
        {
          name: "@userId",
          value: userId,
        },
      ],
      query: `SELECT * FROM n WHERE n.userId = @userId`,
    };
    return pipe(
      TE.tryCatch(
        () => asyncIterableToArray(this.getQueryIterator(querySpec)),
        toCosmosErrorResponse,
      ),
      TE.map(RA.flatten),
      TE.map(RA.rights),
    );
  }
}
