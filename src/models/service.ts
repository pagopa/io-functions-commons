import * as t from "io-ts";

import { fromNullable, none, Option, some } from "fp-ts/lib/Option";

import { Set } from "json-set-map";

import {
  FiscalCode,
  NonEmptyString,
  OrganizationFiscalCode
} from "@pagopa/ts-commons/lib/strings";

import { Container, FeedResponse } from "@azure/cosmos";
import {
  readonlyNonEmptySetType,
  readonlySetType,
  withDefault
} from "@pagopa/ts-commons/lib/types";
import { fromEither, TaskEither } from "fp-ts/lib/TaskEither";
import { right } from "fp-ts/lib/Either";
import { tryCatch } from "fp-ts/lib/TaskEither";
import { CIDR } from "../../generated/definitions/CIDR";
import {
  CosmosdbModelVersioned,
  RetrievedVersionedModel
} from "../utils/cosmosdb_model_versioned";
import { MaxAllowedPaymentAmount } from "../../generated/definitions/MaxAllowedPaymentAmount";
import { ServiceScope } from "../../generated/definitions/ServiceScope";
import {
  CosmosDecodingError,
  CosmosErrors,
  toCosmosErrorResponse
} from "../utils/cosmosdb_model";
import { wrapWithKind } from "../utils/types";

export const SERVICE_COLLECTION_NAME = "services";
export const SERVICE_MODEL_ID_FIELD = "serviceId" as const;
export const SERVICE_MODEL_PK_FIELD = SERVICE_MODEL_ID_FIELD;

// required attributes
const ServiceMetadataR = t.interface({
  scope: ServiceScope
});

// optional attributes
const ServiceMetadataO = t.partial({
  address: NonEmptyString,

  appAndroid: NonEmptyString,

  appIos: NonEmptyString,

  cta: NonEmptyString,

  description: NonEmptyString,

  email: NonEmptyString,

  pec: NonEmptyString,

  phone: NonEmptyString,

  privacyUrl: NonEmptyString,

  supportUrl: NonEmptyString,

  tokenName: NonEmptyString,

  tosUrl: NonEmptyString,

  webUrl: NonEmptyString
});

export const ServiceMetadata = t.intersection(
  [ServiceMetadataR, ServiceMetadataO],
  "ServiceMetadata"
);

export type ServiceMetadata = t.TypeOf<typeof ServiceMetadata>;

/**
 * Base interface for Service objects
 */
const ServiceR = t.interface({
  // authorized source CIDRs
  authorizedCIDRs: readonlySetType(CIDR, "CIDRs"),
  // list of authorized fiscal codes
  authorizedRecipients: readonlySetType(FiscalCode, "fiscal codes"),
  // the name of the department within the service
  departmentName: NonEmptyString,
  // wether the service appears in the service list
  isVisible: withDefault(t.boolean, false),
  // maximum amount in euro cents that the service
  // can charge to a specific user (0 if the service cannot send payment requests)
  maxAllowedPaymentAmount: MaxAllowedPaymentAmount,
  // fiscal code of the organization, used to receive payments
  organizationFiscalCode: OrganizationFiscalCode,
  // the name of the organization
  organizationName: NonEmptyString,
  // if the service require secure channels
  requireSecureChannels: withDefault(t.boolean, false),
  // this equals user's subscriptionId
  serviceId: NonEmptyString,
  // the name of the service
  serviceName: NonEmptyString
});

const ServiceO = t.partial({
  // the metadata of the service
  serviceMetadata: ServiceMetadata
});

export type Service = t.TypeOf<typeof Service>;
export const Service = t.intersection([ServiceR, ServiceO], "Service");

export type NewService = t.TypeOf<typeof NewService>;
export const NewService = wrapWithKind(Service, "INewService" as const);

export const RetrievedService = wrapWithKind(
  t.intersection([Service, RetrievedVersionedModel]),
  "IRetrievedService" as const
);

export type RetrievedService = t.TypeOf<typeof RetrievedService>;

export const RequiredMetadata = t.intersection([
  ServiceMetadata,
  t.interface({
    description: NonEmptyString,
    privacyUrl: NonEmptyString
  }),
  t.union([
    t.intersection([
      t.interface({
        email: NonEmptyString
      }),
      t.partial({
        pec: NonEmptyString,

        phone: NonEmptyString,

        supportUrl: NonEmptyString
      })
    ]),
    t.intersection([
      t.interface({
        pec: NonEmptyString
      }),
      t.partial({
        email: NonEmptyString,

        phone: NonEmptyString,

        supportUrl: NonEmptyString
      })
    ]),
    t.intersection([
      t.interface({
        phone: NonEmptyString
      }),
      t.partial({
        email: NonEmptyString,

        pec: NonEmptyString,

        supportUrl: NonEmptyString
      })
    ]),
    t.intersection([
      t.interface({
        supportUrl: NonEmptyString
      }),
      t.partial({
        email: NonEmptyString,

        pec: NonEmptyString,

        phone: NonEmptyString
      })
    ])
  ])
]);

/**
 * Interface for a Service that has all the required information
 * for running in production.
 */
export const ValidService = t.intersection([
  Service,
  t.interface({
    // At least one authorizedCIDR must be present
    authorizedCIDRs: readonlyNonEmptySetType(CIDR, "CIDRs"),
    // Required metadata for production
    serviceMetadata: RequiredMetadata
  })
]);
export type ValidService = t.TypeOf<typeof ValidService>;

/**
 * Converts an Array or a Set of strings to a ReadonlySet of fiscalCodes.
 *
 * We need to handle Arrays as this method is called by database finders
 * who retrieve a plain json object.
 *
 * We need to handle Sets as this method is called on Service objects
 * passed to create(Service) and update(Service) model methods.
 *
 * @param authorizedRecipients  Array or Set of authorized fiscal codes
 *                              for this service.
 *
 * @deprecated Use the Service validation to do the conversion.
 */
export const toAuthorizedRecipients = (
  authorizedRecipients: ReadonlyArray<string> | ReadonlySet<string> | undefined
): ReadonlySet<FiscalCode> =>
  new Set(Array.from(authorizedRecipients || []).filter(FiscalCode.is));

/**
 * @see toAuthorizedRecipients
 * @param authorizedCIDRs   Array or Set of authorized CIDRs for this service.
 *
 * @deprecated Use the Service validation to do the conversion.
 */
export const toAuthorizedCIDRs = (
  authorizedCIDRs: ReadonlyArray<string> | ReadonlySet<string> | undefined
): ReadonlySet<CIDR> =>
  new Set(Array.from(authorizedCIDRs || []).filter(CIDR.is));

/**
 * A model for handling Services
 */
export class ServiceModel extends CosmosdbModelVersioned<
  Service,
  NewService,
  RetrievedService,
  typeof SERVICE_MODEL_ID_FIELD
> {
  /**
   * Creates a new Service model
   *
   * @param container the Cosmos container client
   */
  constructor(container: Container) {
    super(container, NewService, RetrievedService, SERVICE_MODEL_ID_FIELD);
  }

  /**
   * @deprecated use findLastVersionByModelId(serviceId, serviceId)
   */
  public findOneByServiceId(
    serviceId: NonEmptyString
  ): TaskEither<CosmosErrors, Option<RetrievedService>> {
    return super.findLastVersionByModelId([serviceId]);
  }

  public listLastVersionServices(): TaskEither<
    CosmosErrors,
    Option<ReadonlyArray<RetrievedService>>
  > {
    return tryCatch<CosmosErrors, FeedResponse<RetrievedService>>(
      () => this.container.items.query(`SELECT * FROM c`).fetchAll(),
      toCosmosErrorResponse
    )
      .map(_ => fromNullable(_.resources))
      .chain(_ =>
        _.isSome()
          ? _.value.length > 0
            ? fromEither(
                t
                  .readonlyArray(this.retrievedItemT)
                  .decode(_.value)
                  .map(services =>
                    some(
                      Object.values(
                        services.reduce((prev, curr) => {
                          const isNewer =
                            !prev[curr.serviceId] ||
                            curr.version > prev[curr.serviceId].version;
                          return {
                            ...prev,
                            ...(isNewer ? { [curr.serviceId]: curr } : {})
                          };
                        }, {} as Record<string, RetrievedService>)
                      )
                    )
                  )
                  .mapLeft(CosmosDecodingError)
              )
            : fromEither(right(none))
          : fromEither(right(none))
      );
  }
}
