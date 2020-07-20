// tslint:disable: no-console
import { Container, CosmosClient, Database } from "@azure/cosmos";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import { PromiseType } from "italia-ts-commons/lib/types";
import { getRequiredStringEnv } from "../../../src/utils/env";
import {
  CosmosErrors,
  toCosmosErrorResponse
} from "../../utils/cosmosdb_model";
import {
  Service,
  SERVICE_COLLECTION_NAME,
  SERVICE_MODEL_PK_FIELD,
  ServiceModel
} from "../service";

const endpoint = getRequiredStringEnv("COSMOSDB_URI");
const key = getRequiredStringEnv("COSMOSDB_KEY");
const cosmosDatabaseName = getRequiredStringEnv("COSMOSDB_DATABASE_NAME");
const client = new CosmosClient({ endpoint, key });

export const createDatabase = (
  dbName: string
): TaskEither<CosmosErrors, Database> =>
  tryCatch<
    CosmosErrors,
    PromiseType<ReturnType<typeof client.databases.createIfNotExists>>
  >(
    () => client.databases.createIfNotExists({ id: dbName }),
    toCosmosErrorResponse
  ).map(databaseResponse => databaseResponse.database);

export const createContainer = (
  db: Database,
  containerName: string
): TaskEither<CosmosErrors, Container> =>
  tryCatch<
    CosmosErrors,
    PromiseType<ReturnType<typeof db.containers.createIfNotExists>>
  >(
    () => db.containers.createIfNotExists({ id: containerName }),
    toCosmosErrorResponse
  ).map(containerResponse => containerResponse.container);

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
  .chain(db => createContainer(db, SERVICE_COLLECTION_NAME))
  .chain(container =>
    new ServiceModel(container).create({
      id: "1",
      kind: "INewService",
      ...aService
    })
  );

export const retrieveTest = createDatabase(cosmosDatabaseName)
  .chain(db => createContainer(db, SERVICE_COLLECTION_NAME))
  .chain(container =>
    new ServiceModel(container).find("1", SERVICE_MODEL_PK_FIELD)
  );

export const upsertTest = createDatabase(cosmosDatabaseName)
  .chain(db => createContainer(db, SERVICE_COLLECTION_NAME))
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
  .then(_ => console.log(_.value))
  .catch(console.error);
