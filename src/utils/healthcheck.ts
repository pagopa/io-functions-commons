import { CosmosClient } from "@azure/cosmos";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import {
  common as azurestorageCommon,
  createBlobService,
  createFileService,
  createQueueService,
  createTableService
} from "azure-storage";

import * as A from "fp-ts/lib/Array";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/lib/ReadonlyArray";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";

import fetch from "node-fetch";

import * as t from "io-ts";

type Literal<S> = string extends S ? never : string;

// ProblemSources are just string literals
export type ProblemSource<S> = Literal<S>;

export type HealthProblem<S extends ProblemSource<S>> = string & {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  readonly __source: S;
};
export type HealthCheck<
  S extends ProblemSource<S>,
  True = true
> = TE.TaskEither<ReadonlyArray<HealthProblem<S>>, True>;

// format and cast a problem message with its source
const formatProblem = <S extends ProblemSource<S>>(
  source: S,
  message: string
): HealthProblem<S> => `${source}|${message}` as HealthProblem<S>;

// utility to format an unknown error to an arry of HealthProblem
export const toHealthProblems = <S extends ProblemSource<S>>(source: S) => (
  e: unknown
): ReadonlyArray<HealthProblem<S>> => [
  formatProblem(source, E.toError(e).message)
];

/**
 * Check application's configuration is correct
 *
 * @returns either true or an array of error messages
 */
export const checkConfigHealth = <IConfig extends t.Mixed>(
  ConfigCodec: IConfig
) => (value: unknown): HealthCheck<"Config", t.TypeOf<IConfig>> =>
  pipe(
    value,
    ConfigCodec.decode,
    TE.fromEither,
    TE.mapLeft(errors =>
      errors.map(e =>
        // give each problem its own line
        formatProblem("Config", readableReport([e]))
      )
    )
  );

/**
 * Return a CosmosClient
 */
export const buildCosmosClient = (
  dbUri: string,
  dbKey?: string
): CosmosClient =>
  new CosmosClient({
    endpoint: dbUri,
    key: dbKey
  });

/**
 * Check the application can connect to an Azure CosmosDb instances
 *
 * @param dbUri uri of the database
 * @param dbUri connection string for the storage
 *
 * @returns either true or an array of error messages
 */
export const checkAzureCosmosDbHealth = (
  dbUri: string,
  dbKey?: string
): HealthCheck<"AzureCosmosDB", true> =>
  pipe(
    TE.tryCatch(async () => {
      const client = buildCosmosClient(dbUri, dbKey);
      return client.getDatabaseAccount();
    }, toHealthProblems("AzureCosmosDB")),
    TE.map(_ => true)
  );

/**
 * Check the application can connect to an Azure Storage
 *
 * @param connStr connection string for the storage
 *
 * @returns either true or an array of error messages
 */
export const checkAzureStorageHealth = (
  connStr: string
): HealthCheck<"AzureStorage"> => {
  const applicativeValidation = TE.getApplicativeTaskValidation(
    T.ApplicativePar,
    RA.getSemigroup<HealthProblem<"AzureStorage">>()
  );

  // try to instantiate a client for each product of azure storage
  return pipe(
    [
      createBlobService,
      createFileService,
      createQueueService,
      createTableService
    ]
      // for each, create a task that wraps getServiceProperties
      .map(createService =>
        TE.tryCatch(
          () =>
            new Promise<
              azurestorageCommon.models.ServicePropertiesResult.ServiceProperties
            >((resolve, reject) =>
              createService(connStr).getServiceProperties((err, result) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                err
                  ? reject(err.message.replace(/\n/gim, " ")) // avoid newlines
                  : resolve(result);
              })
            ),
          toHealthProblems("AzureStorage")
        )
      ),
    // run each taskEither and gather validation errors from each one of them, if any
    A.sequence(applicativeValidation),
    TE.map(_ => true)
  );
};

/**
 * Check a url is reachable
 *
 * @param url url to connect with
 *
 * @returns either true or an array of error messages
 */
export const checkUrlHealth = (url: string): HealthCheck<"Url", true> =>
  pipe(
    TE.tryCatch(() => fetch(url, { method: "HEAD" }), toHealthProblems("Url")),
    TE.map(_ => true)
  );

/**
 * Execute all the health checks for the application
 *
 * @returns either true or an array of error messages
 */
export const checkApplicationHealth = <
  IConfig extends t.Mixed,
  S extends ProblemSource<S>
>(
  ConfigCodec: IConfig,
  checks: ReadonlyArray<(c: t.TypeOf<IConfig>) => HealthCheck<S, true>>
) => (
  config: unknown
): TE.TaskEither<
  ReadonlyArray<HealthProblem<S>> | ReadonlyArray<HealthProblem<"Config">>,
  true
> => {
  const applicativeValidation = TE.getApplicativeTaskValidation(
    T.ApplicativePar,
    RA.getSemigroup<HealthProblem<S>>()
  );

  return pipe(
    config,
    TE.of,
    TE.chain(checkConfigHealth(ConfigCodec)),
    TE.chainW(decodedConfig =>
      pipe(
        checks.map(check => check(decodedConfig)),
        // run each taskEither and collect validation errors from each one of them, if any
        A.sequence(applicativeValidation)
      )
    ),
    TE.map(_ => true as const)
  );
};
