// tslint:disable: no-console no-identical-functions
import {
  NonEmptyString,
  OrganizationFiscalCode
} from "italia-ts-commons/lib/strings";

import { isLeft, right } from "fp-ts/lib/Either";
import { fromEither, fromLeft, taskEither } from "fp-ts/lib/TaskEither";
import { NonNegativeInteger } from "italia-ts-commons/lib/numbers";
import { MaxAllowedPaymentAmount } from "../../../generated/definitions/MaxAllowedPaymentAmount";
import {
  RetrievedService,
  Service,
  SERVICE_COLLECTION_NAME,
  SERVICE_MODEL_PK_FIELD,
  ServiceModel,
  toAuthorizedCIDRs,
  toAuthorizedRecipients
} from "../service";
import {
  cosmosDatabaseName,
  createContainer,
  createDatabase
} from "./integration_init";

const aService: Service = Service.decode({
  authorizedCIDRs: [],
  authorizedRecipients: [],
  departmentName: "Deparment Name",
  isVisible: true,
  maxAllowedPaymentAmount: 100000,
  organizationFiscalCode: "01234567890",
  organizationName: "Organization name",
  requireSecureChannels: false,
  serviceId: "aServiceId" as NonEmptyString,
  serviceName: "MyServiceName"
}).getOrElseL(() => {
  throw new Error("Cannot decode service payload.");
});

const aServiceId = "xyz" as NonEmptyString;
const anOrganizationFiscalCode = "01234567890" as OrganizationFiscalCode;

const aRetrievedService: RetrievedService = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  authorizedCIDRs: toAuthorizedCIDRs([]),
  authorizedRecipients: toAuthorizedRecipients([]),
  departmentName: "MyDept" as NonEmptyString,
  id: "xyz" as NonEmptyString,
  isVisible: true,
  kind: "IRetrievedService",
  maxAllowedPaymentAmount: 0 as MaxAllowedPaymentAmount,
  organizationFiscalCode: anOrganizationFiscalCode,
  organizationName: "MyOrg" as NonEmptyString,
  requireSecureChannels: false,
  serviceId: aServiceId,
  serviceName: "MyService" as NonEmptyString,
  version: 0 as NonNegativeInteger
};

const createTest = createDatabase(cosmosDatabaseName)
  .chain(db =>
    createContainer(db, SERVICE_COLLECTION_NAME, SERVICE_MODEL_PK_FIELD)
  )
  .chain(container =>
    new ServiceModel(container).create({
      kind: "INewService",
      ...aService
    })
  );

const retrieveTest = (modelId: string) =>
  createDatabase(cosmosDatabaseName)
    .chain(db =>
      createContainer(db, SERVICE_COLLECTION_NAME, SERVICE_MODEL_PK_FIELD)
    )
    .chain(container =>
      new ServiceModel(container).findLastVersionByModelId(modelId)
    );

const upsertTest = createDatabase(cosmosDatabaseName)
  .chain(db =>
    createContainer(db, SERVICE_COLLECTION_NAME, SERVICE_MODEL_PK_FIELD)
  )
  .chain(container =>
    new ServiceModel(container).upsert({
      kind: "INewService",
      ...aService,
      serviceName: "anUpdatedServiceName" as NonEmptyString,
      version: undefined
    })
  );

export const test = () =>
  createTest
    .foldTaskEither(
      err => {
        if (err.kind === "COSMOS_ERROR_RESPONSE" && err.error.code === 409) {
          console.log(
            "Service-CreateTest| A document with the same id already exists"
          );
          return taskEither.of(aRetrievedService);
        } else {
          return fromLeft(err);
        }
      },
      _ => fromEither(right(_))
    )
    .chain(_ => upsertTest)
    .chain(_ => retrieveTest(_.serviceId))
    .run()
    .then(_ => {
      if (isLeft(_)) {
        console.log(`Service-Test| Error = ${_.value}`);
      } else {
        console.log("Service-Test| success!");
        console.log(_.value);
      }
    })
    .catch(console.error);
