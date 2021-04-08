/**
 * Represents a VisibleService entity used to cache a list of
 * services, taken from CosmosDB, that have is_visible flag set to true.
 */
import * as t from "io-ts";

import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { collect, StrMap } from "fp-ts/lib/StrMap";
import {
  NotificationChannel,
  NotificationChannelEnum
} from "../../generated/definitions/NotificationChannel";
import { ServicePublic } from "../../generated/definitions/ServicePublic";
import { ServiceScopeEnum } from "../../generated/definitions/ServiceScope";
import { ServiceTuple } from "../../generated/definitions/ServiceTuple";
import { BaseModel } from "../utils/cosmosdb_model";
import { toApiServiceMetadata } from "../utils/service_metadata";
import { Service, ServiceMetadata } from "./service";

// This is not a CosmosDB model, but entities are stored into blob storage
export const VISIBLE_SERVICE_CONTAINER = "cached";
export const VISIBLE_SERVICE_BLOB_ID = "visible-services.json";

const {
  departmentName,
  organizationFiscalCode,
  organizationName,
  requireSecureChannels,
  serviceId,
  serviceName
} = Service.types[0].props;

// Public view of RetrivedService type
// eslint-disable-next-line @typescript-eslint/naming-convention
const VisibleServiceR = t.intersection([
  BaseModel,
  t.interface({
    version: NonNegativeInteger
  }),
  t.partial({
    ttl: t.number
  }),
  t.type({
    departmentName,
    organizationFiscalCode,
    organizationName,
    requireSecureChannels,
    serviceId,
    serviceName
  })
]);

// eslint-disable-next-line @typescript-eslint/naming-convention
const VisibleServiceO = t.partial({
  serviceMetadata: ServiceMetadata
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export const VisibleService = t.intersection(
  [VisibleServiceR, VisibleServiceO],
  "VisibleService"
);

export type VisibleService = t.TypeOf<typeof VisibleService>;

export const serviceAvailableNotificationChannels = (
  visibleService: VisibleService
): ReadonlyArray<NotificationChannel> => {
  if (visibleService.requireSecureChannels) {
    return [NotificationChannelEnum.WEBHOOK];
  }
  return [NotificationChannelEnum.EMAIL, NotificationChannelEnum.WEBHOOK];
};

/* eslint-disable @typescript-eslint/naming-convention */
export const toServicePublic = (
  visibleService: VisibleService
): ServicePublic => ({
  available_notification_channels: serviceAvailableNotificationChannels(
    visibleService
  ),
  department_name: visibleService.departmentName,
  organization_fiscal_code: visibleService.organizationFiscalCode,
  organization_name: visibleService.organizationName,
  service_id: visibleService.serviceId,
  service_metadata: visibleService.serviceMetadata
    ? toApiServiceMetadata(visibleService.serviceMetadata)
    : undefined,
  service_name: visibleService.serviceName,
  version: visibleService.version
});
/* eslint-enable @typescript-eslint/naming-convention */

export const toServicesPublic = (
  visibleServices: StrMap<VisibleService>
): ReadonlyArray<ServicePublic> =>
  collect(visibleServices, (_, v) => toServicePublic(v));

export const toServicesTuple = (
  visibleServices: StrMap<VisibleService>
): ReadonlyArray<ServiceTuple> =>
  collect(visibleServices, (_, v) => ({
    scope:
      v.serviceMetadata && v.serviceMetadata.scope === ServiceScopeEnum.LOCAL
        ? ServiceScopeEnum.LOCAL
        : ServiceScopeEnum.NATIONAL,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    service_id: v.serviceId,
    version: v.version
  }));
