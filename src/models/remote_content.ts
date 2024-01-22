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
import { Has_preconditionEnum } from "../../generated/definitions/ThirdPartyData";
import { ServiceId } from "../../generated/definitions/ServiceId";

export const REMOTE_CONTENT_CONFIGURATION_COLLECTION_NAME =
  "remote-content-configuration";

const REMOTE_CONTENT_CONFIGURATION_MODEL_ID_FIELD = "configurationId";

export const RemoteContentClientCert = t.interface({
  clientCert: NonEmptyString,
  clientKey: NonEmptyString,
  serverCa: NonEmptyString
});

const RemoteContentAuthenticationDetails = t.interface({
  headerKeyName: NonEmptyString,
  key: NonEmptyString,
  type: NonEmptyString
});

export type RemoteContentAuthenticationConfig = t.TypeOf<
  typeof RemoteContentAuthenticationConfig
>;
export const RemoteContentAuthenticationConfig = t.intersection([
  RemoteContentAuthenticationDetails,
  t.partial({ cert: RemoteContentClientCert })
]);

export type RemoteContentEnvironmentConfig = t.TypeOf<
  typeof RemoteContentEnvironmentConfig
>;
export const RemoteContentEnvironmentConfig = t.interface({
  baseUrl: NonEmptyString,
  detailsAuthentication: RemoteContentAuthenticationConfig
});

export type RemoteContentTestEnvironmentConfig = t.TypeOf<
  typeof RemoteContentTestEnvironmentConfig
>;
export const RemoteContentTestEnvironmentConfig = t.intersection([
  t.interface({
    testUsers: t.readonlyArray(FiscalCode)
  }),
  RemoteContentEnvironmentConfig
]);

const RemoteContentConfigurationR = t.interface({
  configurationId: Ulid,
  description: NonEmptyString,
  disableLollipopFor: t.readonlyArray(FiscalCode),
  hasPrecondition: enumType<Has_preconditionEnum>(
    Has_preconditionEnum,
    "hasPrecondition"
  ),
  id: NonEmptyString,
  isLollipopEnabled: t.boolean,
  name: NonEmptyString,
  serviceId: ServiceId
});

const RemoteContentConfigurationO = t.partial({});

export const RemoteContentConfigurationBase = t.intersection([
  RemoteContentConfigurationR,
  RemoteContentConfigurationO
]);
export type RemoteContentConfigurationBase = t.TypeOf<
  typeof RemoteContentConfigurationBase
>;

export type RemoteContentConfiguration = t.TypeOf<
  typeof RemoteContentConfiguration
>;
export const RemoteContentConfiguration = t.intersection([
  RemoteContentConfigurationBase,
  t.union([
    t.intersection([
      t.interface({ prodEnvironment: RemoteContentEnvironmentConfig }),
      t.partial({ testEnvironment: RemoteContentTestEnvironmentConfig })
    ]),
    t.intersection([
      t.partial({ prodEnvironment: RemoteContentEnvironmentConfig }),
      t.interface({ testEnvironment: RemoteContentTestEnvironmentConfig })
    ])
  ])
]);

export const RetrievedRemoteContentConfiguration = t.intersection([
  RemoteContentConfiguration,
  RetrievedVersionedModel
]);
export type RetrievedRemoteContentConfiguration = t.TypeOf<
  typeof RetrievedRemoteContentConfiguration
>;

export class RemoteContentConfigurationModel extends CosmosdbModelVersioned<
  RemoteContentConfiguration,
  RemoteContentConfiguration,
  RetrievedRemoteContentConfiguration,
  typeof REMOTE_CONTENT_CONFIGURATION_MODEL_ID_FIELD
> {
  constructor(container: Container) {
    super(
      container,
      RemoteContentConfiguration,
      RetrievedRemoteContentConfiguration,
      REMOTE_CONTENT_CONFIGURATION_MODEL_ID_FIELD
    );
  }
}
