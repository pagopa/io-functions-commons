/**
 * Insert fake data into CosmosDB database emulator.
 */
import {
  Container,
  Database,
  CosmosClient,
  IndexingPolicy
} from "@azure/cosmos";
import { BlobService } from "azure-storage";

import { PromiseType } from "@pagopa/ts-commons/lib/types";
import { pipe } from "fp-ts/lib/function";
import {
  chain,
  getOrElseW,
  map,
  TaskEither,
  tryCatch
} from "fp-ts/lib/TaskEither";
import {
  CosmosErrors,
  toCosmosErrorResponse
} from "../../src/utils/cosmosdb_model";
import { getRequiredStringEnv } from "../../src/utils/env";

const endpoint = getRequiredStringEnv("COSMOSDB_URI");
const key = getRequiredStringEnv("COSMOSDB_KEY");
const storageConnectionString = getRequiredStringEnv("STORAGE_CONN_STRING");

const client = new CosmosClient({ endpoint, key });
export const cosmosDatabaseName = getRequiredStringEnv(
  "COSMOSDB_DATABASE_NAME"
);

const createDatabase = (dbName: string): TaskEither<CosmosErrors, Database> =>
  pipe(
    tryCatch<
      CosmosErrors,
      PromiseType<ReturnType<typeof client.databases.createIfNotExists>>
    >(
      () => client.databases.createIfNotExists({ id: dbName }),
      toCosmosErrorResponse
    ),
    map(databaseResponse => databaseResponse.database)
  );

const createContainer = (
  db: Database,
  containerName: string,
  partitionKey: string,
  indexingPolicy?: IndexingPolicy
): TaskEither<CosmosErrors, Container> =>
  pipe(
    tryCatch<
      CosmosErrors,
      PromiseType<ReturnType<typeof db.containers.createIfNotExists>>
    >(
      () =>
        db.containers.createIfNotExists({
          id: containerName,
          indexingPolicy,
          partitionKey: `/${partitionKey}`
        }),
      toCosmosErrorResponse
    ),
    map(containerResponse => containerResponse.container)
  );

const deleteContainer = (
  db: Database,
  containerName: string
): TaskEither<CosmosErrors, Container> =>
  pipe(
    tryCatch<
      CosmosErrors,
      PromiseType<ReturnType<typeof db.containers.createIfNotExists>>
    >(() => db.container(containerName).delete(), toCosmosErrorResponse),
    map(containerResponse => containerResponse.container)
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

export const createContext = (partitionKey: string, hasStorage = false) => {
  const containerName = makeRandomContainerName();
  let db: Database;
  let storage: BlobService;
  let container: Container;
  return {
    async init(indexingPolicy?: IndexingPolicy) {
      const r = await pipe(
        createDatabase(cosmosDatabaseName),
        chain(db =>
          pipe(
            createContainer(db, containerName, partitionKey,indexingPolicy),
            map(container => ({
              db,
              container
            }))
          )
        ),
        getOrElseW<CosmosErrors, { db: Database; container: Container }>(_ =>
          fail(
            `Cannot init, container: ${containerName}, error: ${JSON.stringify(
              _
            )}`
          )
        )
      )();
      if (hasStorage) {
        storage = new BlobService(storageConnectionString);
        await new Promise((resolve, reject) => {
          storage.createContainerIfNotExists(containerName, (err, res) =>
            err ? reject(err) : resolve(res)
          );
        });
      }
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
    },
    get containerName() {
      return containerName;
    },
    get storage() {
      return storage;
    }
  };
};
