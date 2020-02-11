/**
 * Represents a VisibleService entity used to cache a list of
 * services, taken from CosmosDB, that have is_visible flag set to true.
 */
import * as t from "io-ts";

import { collect, StrMap } from "fp-ts/lib/StrMap";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { enumType } from "italia-ts-commons/lib/types";
import { OrganizationFiscalCode } from "../../generated/definitions/OrganizationFiscalCode";
import { ServiceId } from "../../generated/definitions/ServiceId";
import { ServicePublic } from "../../generated/definitions/ServicePublic";
import { ServiceTuple } from "../../generated/definitions/ServiceTuple";

// this is not a CosmosDB model, but entities are stored into blob storage
export const VISIBLE_SERVICE_CONTAINER = "cached";
export const VISIBLE_SERVICE_BLOB_ID = "visible-services.json";

export enum ScopeEnum {
  "NATIONAL" = "NATIONAL",

  "LOCAL" = "LOCAL"
}

// required attributes
const ServiceMetadataR = t.interface({
  scope: enumType<ScopeEnum>(ScopeEnum, "scope")
});

// optional attributes
const ServiceMetadataO = t.partial({
  description: NonEmptyString,

  webUrl: NonEmptyString,

  appIos: NonEmptyString,

  appAndroid: NonEmptyString,

  tosUrl: NonEmptyString,

  privacyUrl: NonEmptyString,

  address: NonEmptyString,

  phone: NonEmptyString,

  email: NonEmptyString,

  pec: NonEmptyString
});

export const ServiceMetadata = t.intersection(
  [ServiceMetadataR, ServiceMetadataO],
  "ServiceMetadata"
);

const VisibleServiceR = t.type({
  departmentName: NonEmptyString,
  id: NonEmptyString,
  organizationFiscalCode: OrganizationFiscalCode,
  organizationName: NonEmptyString,
  serviceId: ServiceId,
  serviceName: NonEmptyString,
  version: t.Integer
});

const VisibleServiceO = t.partial({
  serviceMetadata: ServiceMetadata
});

export const VisibleService = t.intersection(
  [VisibleServiceR, VisibleServiceO],
  "VisibleService"
);

export type VisibleService = t.TypeOf<typeof VisibleService>;

export function toServicePublic(visibleService: VisibleService): ServicePublic {
  return {
    department_name: visibleService.departmentName,
    organization_fiscal_code: visibleService.organizationFiscalCode,
    organization_name: visibleService.organizationName,
    service_id: visibleService.serviceId,
    service_metadata: visibleService.serviceMetadata,
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
    service_id: v.serviceId,
    version: v.version
  }));
}
