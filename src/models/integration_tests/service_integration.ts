// tslint:disable: no-console no-identical-functions
import { NonEmptyString } from "italia-ts-commons/lib/strings";

import { isLeft, isRight } from "fp-ts/lib/Either";
import {
  Service,
  SERVICE_COLLECTION_NAME,
  SERVICE_MODEL_PK_FIELD,
  ServiceModel
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

export const createTest = createDatabase(cosmosDatabaseName)
  .chain(db =>
    createContainer(db, SERVICE_COLLECTION_NAME, SERVICE_MODEL_PK_FIELD)
  )
  .chain(container =>
    new ServiceModel(container).create({
      id: "1",
      kind: "INewService",
      ...aService
    })
  );

export const retrieveTest = createDatabase(cosmosDatabaseName)
  .chain(db =>
    createContainer(db, SERVICE_COLLECTION_NAME, SERVICE_MODEL_PK_FIELD)
  )
  .chain(container =>
    new ServiceModel(container).find("1", SERVICE_MODEL_PK_FIELD)
  );

export const upsertTest = createDatabase(cosmosDatabaseName)
  .chain(db =>
    createContainer(db, SERVICE_COLLECTION_NAME, SERVICE_MODEL_PK_FIELD)
  )
  .chain(container =>
    new ServiceModel(container).upsert({
      id: "1",
      kind: "INewService",
      ...aService,
      serviceName: "anUpdatedServiceName" as NonEmptyString
    })
  );

createTest
  .run()
  .then(_ => {
    console.log("Service-CreateTest| running...");
    if (
      isLeft(_) &&
      _.value.kind === "COSMOS_ERROR_RESPONSE" &&
      _.value.error.code === 409
    ) {
      console.log(
        "Service-CreateTest| A document with the same id already exists"
      );
    } else {
      console.log("Service-CreateTest| success!");
      console.log(_.value);
    }
  })
  .catch(console.error);

upsertTest
  .run()
  .then(_ => {
    console.log("Service-UpsertTest| running...");
    if (isRight(_)) {
      console.log("Service-UpsertTest| success!");
    } else {
      console.log(_.value);
    }
  })
  .catch(console.error);

retrieveTest
  .run()
  .then(_ => {
    console.log("Service-RetrieveTest| running...");
    if (isRight(_)) {
      console.log("Service-RetrieveTest| success!");
    } else {
      console.log(_.value);
    }
  })
  .catch(console.error);
