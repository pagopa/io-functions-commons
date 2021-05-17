/**
 * Insert fake data into CosmosDB database emulator.
 */
import { Container, Database } from "@azure/cosmos";

import { CosmosClient } from "@azure/cosmos";
import { PromiseType } from "@pagopa/ts-commons/lib/types";
import { toString } from "fp-ts/lib/function";
import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import {
  CosmosErrors,
  toCosmosErrorResponse
} from "../../src/utils/cosmosdb_model";
import { getRequiredStringEnv } from "../../src/utils/env";

const endpoint = getRequiredStringEnv("COSMOSDB_URI");
const key = getRequiredStringEnv("COSMOSDB_KEY");

const client = new CosmosClient({ endpoint, key });
export const cosmosDatabaseName = getRequiredStringEnv(
  "COSMOSDB_DATABASE_NAME"
);

const createDatabase = (dbName: string): TaskEither<CosmosErrors, Database> =>
  tryCatch<
    CosmosErrors,
    PromiseType<ReturnType<typeof client.databases.createIfNotExists>>
  >(
    () => client.databases.createIfNotExists({ id: dbName }),
    toCosmosErrorResponse
  ).map(databaseResponse => databaseResponse.database);

const createContainer = (
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

const deleteContainer = (
  db: Database,
  containerName: string
): TaskEither<CosmosErrors, Container> =>
  tryCatch<
    CosmosErrors,
    PromiseType<ReturnType<typeof db.containers.createIfNotExists>>
  >(() => db.container(containerName).delete(), toCosmosErrorResponse).map(
    containerResponse => containerResponse.container
  );

const makeRandomContainerName = (): string => {
  const result = [];
  const characters = "abcdefghijklmnopqrstuvwxyz";
  const charactersLength = characters.length;
  // eslint-disable-next-line functional/no-let
  for (let i = 0; i < 12; i++) {
    // eslint-disable-next-line functional/immutable-data
    result.push(
      characters.charAt(Math.floor(Math.random() * charactersLength))
    );
  }
  return `test-${result.join("")}`;
};

export const createContext = (partitionKey: string) => {
  const containerName = makeRandomContainerName();
  let db: Database;
  let container: Container;
  return {
    async init() {
      const r = await createDatabase(cosmosDatabaseName)
        .chain(db =>
          createContainer(db, containerName, partitionKey).map(container => ({
            db,
            container
          }))
        )
        .getOrElseL(_ =>
          fail(
            `Cannot init, container: ${containerName}, error: ${toString(_)}`
          )
        )
        .run();
      db = r.db;
      container = r.container;
      return r;
    },
    async dispose() {
      await container.delete();
    },
    get db() {
      return db;
    },
    get container() {
      return container;
    }
  };
};
