import * as t from "io-ts";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Container } from "@azure/cosmos";
import { enumType } from "@pagopa/ts-commons/lib/types";
import { FiscalCode } from "../../generated/definitions/FiscalCode";
import { ServiceId } from "../../generated/definitions/ServiceId";
import { CosmosResource, CosmosdbModel } from "../utils/cosmosdb_model";
import { Has_preconditionEnum } from "../../generated/definitions/ThirdPartyData";

export const REMOTE_CONTENT_CONFIGURATION_COLLECTION_NAME =
  "remote-content-configuration";
const REMOTE_CONTENT_CONFIGURATION_MODEL_PK_FIELD = "serviceId";

export const RemoteContentClientCert = t.interface({
  client_cert: NonEmptyString,
  client_key: NonEmptyString,
  server_ca: NonEmptyString
});

const RemoteContentAuthenticationDetails = t.interface({
  header_key_name: NonEmptyString,
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
  disableLollipopFor: t.readonlyArray(FiscalCode),
  has_precondition: enumType<Has_preconditionEnum>(
    Has_preconditionEnum,
    "has_precondition"
  ),
  id: NonEmptyString,
  isLollipopEnabled: t.boolean,
  serviceId: ServiceId
});

const RemoteContentConfigurationO = t.partial({
  jsonSchema: NonEmptyString,
  schemaKind: NonEmptyString
});

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
  CosmosResource
]);
export type RetrievedRemoteContentConfiguration = t.TypeOf<
  typeof RetrievedRemoteContentConfiguration
>;

export class RemoteContentConfigurationModel extends CosmosdbModel<
  RemoteContentConfiguration,
  RemoteContentConfiguration,
  RetrievedRemoteContentConfiguration,
  typeof REMOTE_CONTENT_CONFIGURATION_MODEL_PK_FIELD
> {
  /**
   * Creates a new RemoteContentConfiguration model
   *
   * @param container the Cosmos container client
   */
  constructor(container: Container) {
    super(
      container,
      RemoteContentConfiguration,
      RetrievedRemoteContentConfiguration
    );
  }
}
