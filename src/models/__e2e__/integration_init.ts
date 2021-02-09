/**
 * Insert fake data into CosmosDB database emulator.
 */
import { Container, Database } from "@azure/cosmos";

import { CosmosClient } from "@azure/cosmos";
import { PromiseType } from "@pagopa/ts-commons/lib/types";
import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import {
  CosmosErrors,
  toCosmosErrorResponse
} from "../../utils/cosmosdb_model";
import { getRequiredStringEnv } from "../../utils/env";

const endpoint = getRequiredStringEnv("COSMOSDB_URI");
const key = getRequiredStringEnv("COSMOSDB_KEY");
const client = new CosmosClient({ endpoint, key });
export const cosmosDatabaseName = getRequiredStringEnv(
  "COSMOSDB_DATABASE_NAME"
);

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
  containerName: string,
  partitionKey: string
): TaskEither<CosmosErrors, Container> =>
  tryCatch<
    CosmosErrors,
    PromiseType<ReturnType<typeof db.containers.createIfNotExists>>
  >(
    () =>
      db.containers.createIfNotExists({
        id: containerName,
        partitionKey: `/${partitionKey}`
      }),
    toCosmosErrorResponse
  ).map(containerResponse => containerResponse.container);
