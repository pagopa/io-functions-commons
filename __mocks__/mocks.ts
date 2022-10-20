import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { MaxAllowedPaymentAmount } from "../generated/definitions/MaxAllowedPaymentAmount";
import { OrganizationFiscalCode } from "../generated/definitions/OrganizationFiscalCode";
import {
  NewService,
  RetrievedService,
  Service,
  toAuthorizedCIDRs,
  toAuthorizedRecipients
} from "../src/models/service";
import { VisibleService } from "../src/models/visible_service";
import { CosmosResource } from "../src/utils/cosmosdb_model";
import { BaseModel } from "../src/utils/cosmosdb_model";

import {
  generateVersionedModelId,
  RetrievedVersionedModel
} from "../src/utils/cosmosdb_model_versioned";

import * as t from "io-ts";

const aCosmosResourceMetadata: Omit<CosmosResource, "id"> = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};

export const anOrganizationFiscalCode = "01234567890" as OrganizationFiscalCode;

export const aService: Service = {
  authorizedCIDRs: toAuthorizedCIDRs([]),
  authorizedRecipients: toAuthorizedRecipients([]),
  departmentName: "MyDeptName" as NonEmptyString,
  isVisible: true,
  maxAllowedPaymentAmount: 0 as MaxAllowedPaymentAmount,
  organizationFiscalCode: anOrganizationFiscalCode,
  organizationName: "MyOrgName" as NonEmptyString,
  requireSecureChannels: false,
  serviceId: "MySubscriptionId" as NonEmptyString,
  serviceName: "MyServiceName" as NonEmptyString
};

export const aNewService: NewService = {
  ...aService,
  kind: "INewService"
};

export const aRetrievedService: RetrievedService = {
  ...aNewService,
  ...aCosmosResourceMetadata,
  id: "123" as NonEmptyString,
  kind: "IRetrievedService",
  version: 1 as NonNegativeInteger
};

export const aVisibleService: VisibleService = {
  ...aCosmosResourceMetadata,
  departmentName: aRetrievedService.departmentName,
  id: aRetrievedService.id,
  organizationFiscalCode: aRetrievedService.organizationFiscalCode,
  organizationName: aRetrievedService.organizationName,
  requireSecureChannels: false,
  serviceId: aRetrievedService.serviceId,
  serviceName: aRetrievedService.serviceName,
  version: aRetrievedService.version
};

export const aModelIdField = "aModelIdField" as const;
export const aModelPartitionField = "aModelPartitionField" as const;
export const aModelIdValue = "aModelIdValue";
export const aModelPartitionValue = 123;

export const MyDocument = t.interface({
  [aModelIdField]: t.string,
  [aModelPartitionField]: t.number,
  test: t.string
});
export type MyDocument = t.TypeOf<typeof MyDocument>;

export const RetrievedMyDocument = t.intersection([
  MyDocument,
  RetrievedVersionedModel,
  BaseModel
]);
export type RetrievedMyDocument = t.TypeOf<typeof RetrievedMyDocument>;

export const aMyDocument = {
  [aModelIdField]: aModelIdValue,
  [aModelPartitionField]: aModelPartitionValue,
  test: "aNewMyDocument"
};

export const someMetadata = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};

// test stub that compose a document id from the pair (modelId, version)
export const documentId = (modelId: string, version: number): NonEmptyString =>
  generateVersionedModelId<MyDocument, typeof aModelIdField>(
    modelId,
    version as NonNegativeInteger
  );

export const aRetrievedExistingDocument: RetrievedMyDocument = {
  ...someMetadata,
  ...aMyDocument,
  id: documentId(aModelIdValue, 0),
  version: 0 as NonNegativeInteger
};
