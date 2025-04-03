import * as t from "io-ts";
import * as TE from "fp-ts/lib/TaskEither";
import * as RA from "fp-ts/lib/ReadonlyArray";
import * as O from "fp-ts/lib/Option";

import {
  FiscalCode,
  NonEmptyString,
  Ulid
} from "@pagopa/ts-commons/lib/strings";
import { enumType } from "@pagopa/ts-commons/lib/types";
import { Container } from "@azure/cosmos";
import { pipe } from "fp-ts/lib/function";
import { HasPreconditionEnum } from "../../generated/definitions/v2/HasPrecondition";
import {
  AzureCosmosResource,
  CosmosErrors,
  CosmosdbModel,
  toCosmosErrorResponse
} from "../utils/cosmosdb_model";
import { asyncIterableToArray } from "../utils/async";

export const RC_CONFIGURATION_COLLECTION_NAME = "message-configuration";

export const RC_CONFIGURATION_MODEL_PK_FIELD = "configurationId";

export const RCClientCert = t.interface({
  clientCert: NonEmptyString,
  clientKey: NonEmptyString,
  serverCa: NonEmptyString
});
export type RCClientCert = t.TypeOf<typeof RCClientCert>;

const RCAuthenticationDetails = t.interface({
  headerKeyName: NonEmptyString,
  key: NonEmptyString,
  type: NonEmptyString
});

export type RCAuthenticationConfig = t.TypeOf<typeof RCAuthenticationConfig>;
export const RCAuthenticationConfig = t.intersection([
  RCAuthenticationDetails,
  t.partial({ cert: RCClientCert })
]);

export type RCEnvironmentConfig = t.TypeOf<typeof RCEnvironmentConfig>;
export const RCEnvironmentConfig = t.interface({
  baseUrl: NonEmptyString,
  detailsAuthentication: RCAuthenticationConfig
});

export type RCTestEnvironmentConfig = t.TypeOf<typeof RCTestEnvironmentConfig>;
export const RCTestEnvironmentConfig = t.intersection([
  t.interface({
    testUsers: t.readonlyArray(FiscalCode)
  }),
  RCEnvironmentConfig
]);

const RCConfigurationR = t.interface({
  configurationId: Ulid,
  description: NonEmptyString,
  disableLollipopFor: t.readonlyArray(FiscalCode),
  hasPrecondition: enumType<HasPreconditionEnum>(
    HasPreconditionEnum,
    "hasPrecondition"
  ),
  id: NonEmptyString,
  isLollipopEnabled: t.boolean,
  name: NonEmptyString,
  userId: NonEmptyString
});

const RCConfigurationO = t.partial({});

export const RCConfigurationBase = t.intersection([
  RCConfigurationR,
  RCConfigurationO
]);
export type RCConfigurationBase = t.TypeOf<typeof RCConfigurationBase>;

export type RCConfiguration = t.TypeOf<typeof RCConfiguration>;
export const RCConfiguration = t.intersection([
  RCConfigurationBase,
  t.partial({ testEnvironment: RCTestEnvironmentConfig }),
  t.partial({ prodEnvironment: RCEnvironmentConfig })
]);

export const RetrievedRCConfiguration = t.intersection([
  RCConfiguration,
  AzureCosmosResource
]);
export type RetrievedRCConfiguration = t.TypeOf<
  typeof RetrievedRCConfiguration
>;

export class RCConfigurationModel extends CosmosdbModel<
  RCConfiguration,
  RCConfiguration,
  RetrievedRCConfiguration,
  typeof RC_CONFIGURATION_MODEL_PK_FIELD
> {
  constructor(container: Container) {
    super(container, RCConfiguration, RetrievedRCConfiguration);
  }

  /**
   * Returns a RCConfiguration identified by configurationId
   *
   * @param configurationId a configurationId
   */
  public findByConfigurationId(
    configurationId: Ulid
  ): TE.TaskEither<CosmosErrors, O.Option<RetrievedRCConfiguration>> {
    return this.find([configurationId, configurationId]);
  }

  /**
   * Returns all the RCConfiguration identified by every configurationId
   *
   * @param configurationIds an array of configurationId
   */
  public findAllByConfigurationId(
    configurationIds: ReadonlyArray<Ulid>
  ): TE.TaskEither<CosmosErrors, ReadonlyArray<RetrievedRCConfiguration>> {
    if (configurationIds.length === 0) {
      return TE.right([]);
    }
    const querySpec = {
      parameters: [
        {
          name: "@configurationIds",
          value: configurationIds
        }
      ],
      query: `SELECT * FROM n WHERE ARRAY_CONTAINS(@configurationIds, n.${RC_CONFIGURATION_MODEL_PK_FIELD})`
    };
    return pipe(
      TE.tryCatch(
        () => asyncIterableToArray(this.getQueryIterator(querySpec)),
        toCosmosErrorResponse
      ),
      TE.map(RA.flatten),
      TE.map(RA.rights)
    );
  }
}
