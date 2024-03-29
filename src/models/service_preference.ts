import * as t from "io-ts";

import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { Container, RequestOptions } from "@azure/cosmos";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { withDefault } from "@pagopa/ts-commons/lib/types";
import { enumType } from "@pagopa/ts-commons/lib/types";
import { ServiceId } from "../../generated/definitions/ServiceId";
import {
  BaseModel,
  CosmosdbModel,
  CosmosErrors,
  CosmosResource
} from "../utils/cosmosdb_model";
import { wrapWithKind } from "../utils/types";

export const SERVICE_PREFERENCES_COLLECTION_NAME = "services-preferences" as NonEmptyString;
export const SERVICE_PREFERENCES_MODEL_PK_FIELD = "fiscalCode" as const;

/**
 * Enumeration of possible SendReadMessageStatus choices
 */
export enum AccessReadMessageStatusEnum {
  "UNKNOWN" = "UNKNOWN",
  "ALLOW" = "ALLOW",
  "DENY" = "DENY"
}
export const AccessReadMessageStatus = enumType<AccessReadMessageStatusEnum>(
  AccessReadMessageStatusEnum,
  "AccessReadMessageStatusEnum"
);
export type AccessReadMessageStatus = t.TypeOf<typeof AccessReadMessageStatus>;

/**
 * Base interface for ServicePreference objects
 */
export const BasicServicePreferences = t.interface({
  // the fiscal code of the citized associated to this service preference
  fiscalCode: FiscalCode,

  // whether to store the content of messages sent to this citizen from a specific service
  isInboxEnabled: t.boolean,

  // the identifier of the service to which this preference refers
  // this equals user's subscriptionId
  serviceId: ServiceId,

  // the service preference version
  // this value refers to servicePreferencesSettings.version in user Profile
  settingsVersion: NonNegativeInteger
});
export type BasicServicePreferences = t.TypeOf<typeof BasicServicePreferences>;

export const EnabledInboxServicePreferences = t.intersection([
  BasicServicePreferences,
  t.interface({
    // whether to allow to send read messages status to the sender
    accessReadMessageStatus: withDefault(
      AccessReadMessageStatus,
      AccessReadMessageStatusEnum.UNKNOWN
    ),

    // whether to send email notifications for a specific service
    // This property is NOT used.
    isEmailEnabled: t.boolean,

    // whether to store the content of messages sent to this citizen from a specific service
    isInboxEnabled: t.literal(true),

    // whether to push notifications to the default webhook for a specific service
    isWebhookEnabled: t.boolean
  })
]);
export type EnabledInboxServicePreferences = t.TypeOf<
  typeof EnabledInboxServicePreferences
>;

export const DisabledInboxServicePreferences = t.intersection([
  BasicServicePreferences,
  t.interface({
    // do not allow to send read messages status to the sender
    accessReadMessageStatus: withDefault(
      t.keyof({
        [AccessReadMessageStatusEnum.UNKNOWN]: null,
        [AccessReadMessageStatusEnum.DENY]: null
      }),
      AccessReadMessageStatusEnum.UNKNOWN
    ),
    // do not to send email notifications for a specific service
    // This property is NOT used.
    // This property should be always false but this is not compatible with existing records
    // so we should expect any boolean till we will fix existing records
    isEmailEnabled: t.boolean,

    // whether to store the content of messages sent to this citizen from a specific service
    isInboxEnabled: t.literal(false),

    // do not to push notifications to the default webhook for a specific service
    // This property should be always false but this is not compatible with existing records
    // so we should expect any boolean till we will fix existing records
    isWebhookEnabled: t.boolean
  })
]);
export type DisabledInboxServicePreferences = t.TypeOf<
  typeof DisabledInboxServicePreferences
>;

export const ServicePreference = t.union([
  EnabledInboxServicePreferences,
  DisabledInboxServicePreferences
]);
export type ServicePreference = t.TypeOf<typeof ServicePreference>;

export const NewServicePreference = wrapWithKind(
  t.intersection([ServicePreference, BaseModel]),
  "INewServicePreference" as const
);
export type NewServicePreference = t.TypeOf<typeof NewServicePreference>;

export const RetrievedServicePreference = wrapWithKind(
  t.intersection([ServicePreference, CosmosResource]),
  "IRetrievedServicePreference" as const
);

export type RetrievedServicePreference = t.TypeOf<
  typeof RetrievedServicePreference
>;

export const makeServicesPreferencesDocumentId = (
  fiscalCode: FiscalCode,
  serviceId: ServiceId,
  settingsVersion: NonNegativeInteger
): NonEmptyString => {
  const paddingLength = 16; // length of Number.MAX_SAFE_INTEGER == 9007199254740991
  const paddedVersion = (
    "0".repeat(paddingLength) + String(settingsVersion)
  ).slice(-paddingLength);
  return `${fiscalCode}-${serviceId}-${paddedVersion}` as NonEmptyString;
};

export class ServicesPreferencesModel extends CosmosdbModel<
  ServicePreference,
  NewServicePreference,
  RetrievedServicePreference,
  typeof SERVICE_PREFERENCES_MODEL_PK_FIELD
> {
  /**
   * Creates a new ServicePreference model
   *
   * @param container the Cosmos container client
   */
  constructor(
    container: Container,
    protected readonly containerName: NonEmptyString
  ) {
    super(container, NewServicePreference, RetrievedServicePreference);
  }

  /**
   * Create a new document for a service preference
   *
   * The ID of this document is generated from the properties
   * - fiscalCode
   * - serviceId
   * - version
   *
   * @param newDocument the document to be saved
   * @param options query options for the db operation
   */
  public create(
    newDocument: NewServicePreference,
    options?: RequestOptions
  ): TaskEither<CosmosErrors, RetrievedServicePreference> {
    return super.create(
      {
        ...newDocument,
        id: makeServicesPreferencesDocumentId(
          newDocument.fiscalCode,
          newDocument.serviceId,
          newDocument.settingsVersion
        )
      },
      options
    );
  }

  /**
   * Create a new document or update an existing one for a service preference
   *
   * The ID of this document is generated from the properties
   * - fiscalCode
   * - serviceId
   * - version
   *
   * @param document the document to be saved
   * @param options query options for the db operation
   */
  public upsert(
    document: NewServicePreference,
    options?: RequestOptions
  ): TaskEither<CosmosErrors, RetrievedServicePreference> {
    return super.upsert(
      {
        ...document,
        id: makeServicesPreferencesDocumentId(
          document.fiscalCode,
          document.serviceId,
          document.settingsVersion
        )
      },
      options
    );
  }
}
