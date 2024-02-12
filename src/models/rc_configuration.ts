import * as t from "io-ts";

import {
  FiscalCode,
  NonEmptyString,
  Ulid
} from "@pagopa/ts-commons/lib/strings";
import { enumType } from "@pagopa/ts-commons/lib/types";
import { Container } from "@azure/cosmos";
import {
  CosmosdbModelVersioned,
  RetrievedVersionedModel
} from "../utils/cosmosdb_model_versioned";
import { HasPreconditionEnum } from "../../generated/definitions/HasPrecondition";

export const RC_CONFIGURATION_COLLECTION_NAME = "remote-content-configuration";

const RC_CONFIGURATION_MODEL_PK_FIELD = "configurationId";

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
  t.union([
    t.intersection([
      t.interface({ prodEnvironment: RCEnvironmentConfig }),
      t.partial({ testEnvironment: RCTestEnvironmentConfig })
    ]),
    t.intersection([
      t.partial({ prodEnvironment: RCEnvironmentConfig }),
      t.interface({ testEnvironment: RCTestEnvironmentConfig })
    ])
  ])
]);

export const RetrievedRCConfiguration = t.intersection([
  RCConfiguration,
  RetrievedVersionedModel
]);
export type RetrievedRCConfiguration = t.TypeOf<
  typeof RetrievedRCConfiguration
>;

export class RCConfigurationModel extends CosmosdbModelVersioned<
  RCConfiguration,
  RCConfiguration,
  RetrievedRCConfiguration,
  typeof RC_CONFIGURATION_MODEL_PK_FIELD
> {
  constructor(container: Container) {
    super(
      container,
      RCConfiguration,
      RetrievedRCConfiguration,
      RC_CONFIGURATION_MODEL_PK_FIELD
    );
  }
}
