/**
 * Represents a VisibleService entity used to cache a list of
 * services, taken from CosmosDB, that have is_visible flag set to true.
 */
import * as t from "io-ts";

import { collect, StrMap } from "fp-ts/lib/StrMap";
import {
  NotificationChannel,
  NotificationChannelEnum
} from "../../generated/definitions/NotificationChannel";
import { ServicePublic } from "../../generated/definitions/ServicePublic";
import { ServiceScopeEnum } from "../../generated/definitions/ServiceScope";
import { ServiceTuple } from "../../generated/definitions/ServiceTuple";
import * as DocumentDbUtils from "../utils/documentdb";
import { VersionedModel } from "../utils/documentdb_model_versioned";
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
const VisibleServiceR = t.intersection([
  DocumentDbUtils.NewDocument,
  VersionedModel,
  t.type({
    departmentName,
    organizationFiscalCode,
    organizationName,
    requireSecureChannels,
    serviceId,
    serviceName
  })
]);

const VisibleServiceO = t.partial({
  serviceMetadata: ServiceMetadata
});

export const VisibleService = t.intersection(
  [VisibleServiceR, VisibleServiceO],
  "VisibleService"
);

export type VisibleService = t.TypeOf<typeof VisibleService>;

export function serviceAvailableNotificationChannels(
  visibleService: VisibleService
): ReadonlyArray<NotificationChannel> {
  if (visibleService.requireSecureChannels) {
    return [NotificationChannelEnum.WEBHOOK];
  }
  return [NotificationChannelEnum.EMAIL, NotificationChannelEnum.WEBHOOK];
}

export function toServicePublic(visibleService: VisibleService): ServicePublic {
  return {
    available_notification_channels: serviceAvailableNotificationChannels(
      visibleService
    ),
    department_name: visibleService.departmentName,
    organization_fiscal_code: visibleService.organizationFiscalCode,
    organization_name: visibleService.organizationName,
    service_id: visibleService.serviceId,
    service_metadata: visibleService.serviceMetadata
      ? {
          address: visibleService.serviceMetadata.address,
          app_android: visibleService.serviceMetadata.appAndroid,
          app_ios: visibleService.serviceMetadata.appIos,
          description: visibleService.serviceMetadata.description,
          email: visibleService.serviceMetadata.email,
          pec: visibleService.serviceMetadata.pec,
          phone: visibleService.serviceMetadata.phone,
          privacy_url: visibleService.serviceMetadata.privacyUrl,
          scope: visibleService.serviceMetadata.scope,
          tos_url: visibleService.serviceMetadata.tosUrl,
          web_url: visibleService.serviceMetadata.webUrl
        }
      : undefined,
    service_name: visibleService.serviceName,
    version: visibleService.version
  };
}

export function toServicesPublic(
  visibleServices: StrMap<VisibleService>
): ReadonlyArray<ServicePublic> {
  return collect(visibleServices, (_, v) => toServicePublic(v));
}

export function toServicesTuple(
  visibleServices: StrMap<VisibleService>
): ReadonlyArray<ServiceTuple> {
  return collect(visibleServices, (_, v) => ({
    scope:
      v.serviceMetadata && v.serviceMetadata.scope === ServiceScopeEnum.LOCAL
        ? ServiceScopeEnum.LOCAL
        : ServiceScopeEnum.NATIONAL,
    service_id: v.serviceId,
    version: v.version
  }));
}
