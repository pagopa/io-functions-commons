import * as t from "io-ts";

import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { Container, RequestOptions } from "@azure/cosmos";
import { TaskEither } from "fp-ts/lib/TaskEither";
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
 * Base interface for ServicePreference objects
 */
export const ServicePreference = t.interface({
  email: t.boolean,
  fiscalCode: FiscalCode,
  inbox: t.boolean,
  serviceId: ServiceId,
  version: NonNegativeInteger,
  webhook: t.boolean
});
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

export const getServicesPreferencesDocumentId = (
  fiscalCode: FiscalCode,
  serviceId: ServiceId,
  version: NonNegativeInteger
): NonEmptyString => {
  const paddingLength = 16; // length of Number.MAX_SAFE_INTEGER == 9007199254740991
  const paddedVersion = ("0".repeat(paddingLength) + String(version)).slice(
    -paddingLength
  );
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

  public create(
    newDocument: NewServicePreference,
    options?: RequestOptions
  ): TaskEither<CosmosErrors, RetrievedServicePreference> {
    return super.create(
      {
        ...newDocument,
        id: getServicesPreferencesDocumentId(
          newDocument.fiscalCode,
          newDocument.serviceId,
          newDocument.version
        )
      },
      options
    );
  }

  public upsert(
    newDocument: NewServicePreference,
    options?: RequestOptions
  ): TaskEither<CosmosErrors, RetrievedServicePreference> {
    return super.upsert(
      {
        ...newDocument,
        id: getServicesPreferencesDocumentId(
          newDocument.fiscalCode,
          newDocument.serviceId,
          newDocument.version
        )
      },
      options
    );
  }
}
