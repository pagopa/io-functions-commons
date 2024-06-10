/**
 * Utility functions to interact with an Azure Storage.
 */
import * as azureStorage from "azure-storage";
import * as t from "io-ts";

import { Either } from "fp-ts/lib/Either";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/TaskEither";

import { fromNullable, isNone, none, Option, some } from "fp-ts/lib/Option";

import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { pipe, constant } from "fp-ts/lib/function";
import {
  BlobClient,
  BlobDownloadResponseParsed,
  ContainerClient
} from "@azure/storage-blob";

type Resolve<T> = (value: T | PromiseLike<T>) => void;

export type StorageError = Error & {
  readonly code?: string;
};

// BLOB STORAGE FUNCTIONS AND TYPES

// Code used by blobService when a blob is not found
export const GenericCode = "GenericCode";
export const BlobNotFoundCode = "BlobNotFound";

/**
 * Utility function to avoid code duplication detection by tslint
 */
const resolveErrorOrLeaseResult = (
  resolve: Resolve<Either<Error, azureStorage.BlobService.LeaseResult>>
) => (
  err: Error,
  result: azureStorage.BlobService.LeaseResult,
  _: azureStorage.ServiceResponse
): void => {
  if (err) {
    return resolve(E.left(err));
  } else {
    return resolve(E.right(result));
  }
};

/**
 * Acquire lease for a blob.
 *
 * @param blobService     the Azure blob service
 * @param containerName   the name of the Azure blob storage container
 * @param blobName        blob file name
 */
export const acquireLease = (
  blobService: azureStorage.BlobService,
  containerName: string,
  blobName: string,
  options: azureStorage.BlobService.AcquireLeaseRequestOptions = {}
): Promise<Either<Error, azureStorage.BlobService.LeaseResult>> =>
  new Promise(resolve => {
    blobService.acquireLease(
      containerName,
      blobName,
      options,
      resolveErrorOrLeaseResult(resolve)
    );
  });

/**
 * Release lease for a blob.
 *
 * @param blobService     the Azure blob service
 * @param containerName   the name of the Azure blob storage container
 * @param blobName        blob file name
 * @param leaseId         the id of the lease returned by acquireLease method
 */
export const releaseLease = (
  blobService: azureStorage.BlobService,
  containerName: string,
  blobName: string,
  leaseId: string,
  options: azureStorage.BlobService.AcquireLeaseRequestOptions = {}
): Promise<Either<Error, azureStorage.BlobService.LeaseResult>> =>
  new Promise(resolve => {
    blobService.releaseLease(
      containerName,
      blobName,
      leaseId,
      options,
      resolveErrorOrLeaseResult(resolve)
    );
  });

/**
 * Create a new blob (media) from plain text.
 * Assumes that the container <containerName> already exists.
 *
 * @param blobService     the Azure blob service
 * @param containerName   the name of the Azure blob storage container
 * @param blobName        blob storage container name
 * @param text            text to be saved
 */
export const upsertBlobFromText = (
  blobService: azureStorage.BlobService,
  containerName: string,
  blobName: string,
  text: string | Buffer,
  options: azureStorage.BlobService.CreateBlobRequestOptions = {}
): Promise<Either<Error, Option<azureStorage.BlobService.BlobResult>>> =>
  new Promise(resolve =>
    blobService.createBlockBlobFromText(
      containerName,
      blobName,
      text,
      options,
      (err, result, __) => {
        if (err) {
          return resolve(
            E.left<Error, Option<azureStorage.BlobService.BlobResult>>(err)
          );
        } else {
          return resolve(
            E.right<Error, Option<azureStorage.BlobService.BlobResult>>(
              fromNullable(result)
            )
          );
        }
      }
    )
  );

/**
 * Create a new blob (media) from a typed object.
 * Assumes that the container <containerName> already exists.
 *
 * @param blobService     the Azure blob service
 * @param containerName   the name of the Azure blob storage container
 * @param blobName        blob storage container name
 * @param content         object to be serialized and saved
 */
export const upsertBlobFromObject = <T>(
  blobService: azureStorage.BlobService,
  containerName: string,
  blobName: string,
  content: T,
  options: azureStorage.BlobService.CreateBlobRequestOptions = {}
): Promise<Either<Error, Option<azureStorage.BlobService.BlobResult>>> =>
  upsertBlobFromText(
    blobService,
    containerName,
    blobName,
    JSON.stringify(content),
    options
  );

/**
 * Get a blob content as text (string).
 *
 * @param blobService     the Azure blob service
 * @param containerName   the name of the Azure blob storage container
 * @param blobName        blob file name
 */
export const getBlobAsText = (
  blobService: azureStorage.BlobService,
  containerName: string,
  blobName: string,
  options: azureStorage.BlobService.GetBlobRequestOptions = {}
): Promise<Either<Error, Option<string>>> =>
  new Promise(resolve => {
    blobService.getBlobToText(
      containerName,
      blobName,
      options,
      (err, result, __) => {
        if (err) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const errorAsStorageError = err as StorageError;
          if (
            errorAsStorageError.code !== undefined &&
            errorAsStorageError.code === BlobNotFoundCode
          ) {
            return resolve(E.right<Error, Option<string>>(none));
          }
          return resolve(E.left<Error, Option<string>>(err));
        } else {
          return resolve(E.right<Error, Option<string>>(fromNullable(result)));
        }
      }
    );
  });

/**
 * Get a blob content as text (string). In case of error, it will return error details.
 *
 * @param blobService     the Azure blob service
 * @param containerName   the name of the Azure blob storage container
 * @param blobName        blob file name
 */
export const getBlobAsTextWithError = (
  blobService: azureStorage.BlobService,
  containerName: string,
  options: azureStorage.BlobService.GetBlobRequestOptions = {}
) => (
  blobName: string
): TE.TaskEither<azureStorage.StorageError, Option<string>> =>
  pipe(
    new Promise<E.Either<azureStorage.StorageError, Option<string>>>(
      resolve => {
        blobService.getBlobToText(
          containerName,
          blobName,
          options,
          (err, result, _) =>
            err ? resolve(E.left(err)) : resolve(E.right(fromNullable(result)))
        );
      }
    ),
    constant
  );

const downloadBlobToString = (
  containerClient: ContainerClient,
  blobName: string
): Promise<BlobDownloadResponseParsed> => {
  const blobClient: BlobClient = containerClient.getBlobClient(blobName);
  return blobClient.download();
};

const streamToString = async (
  readableStream: NodeJS.ReadableStream
): Promise<string> =>
  new Promise((resolve, reject) => {
    // eslint-disable-next-line functional/prefer-readonly-type, @typescript-eslint/array-type
    const chunks: Array<string> = [];
    readableStream.on("data", data => {
      // eslint-disable-next-line functional/immutable-data
      chunks.push(data.toString());
    });
    readableStream.on("end", () => {
      resolve(chunks.join(""));
    });
    readableStream.on("error", reject);
  });

const toStorageError = (message: string, code: string): StorageError =>
  ({
    code,
    message
  } as StorageError);

/**
 * Get a blob content as text (string). In case of error, it will return error details.
 *
 * @param containerClient     the Azure blob service ContainerClient
 * @param containerName   the name of the Azure blob storage container
 * @param blobName        blob file name
 */
export const getBlobFromContainerAsTextWithError = (
  containerClient: ContainerClient
) => (blobName: string): TE.TaskEither<StorageError, Option<string>> =>
  pipe(
    TE.tryCatch(
      () => downloadBlobToString(containerClient, blobName),
      _ => toStorageError("Blob storage: Internal error.", GenericCode)
    ),
    TE.chain(
      TE.fromPredicate(
        r => !r.errorCode && !!r.readableStreamBody,
        r =>
          r.errorCode
            ? toStorageError(
                `Blob storage: Error code ${r.errorCode}.`,
                r.errorCode
              )
            : toStorageError("Blob storage: Empty response body.", GenericCode)
      )
    ),
    TE.chain(res =>
      TE.tryCatch(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        () => streamToString(res.readableStreamBody!),
        _ =>
          toStorageError(
            "Blob storage: Cannot parse stream to string.",
            GenericCode
          )
      )
    ),
    TE.map(fromNullable)
  );

/**
 * Get a blob content as a typed (io-ts) object.
 *
 * @param blobService     the Azure blob service
 * @param containerName   the name of the Azure blob storage container
 * @param blobName        blob file name
 */
export const getBlobAsObject = async <A, O, I>(
  type: t.Type<A, O, I>,
  blobService: azureStorage.BlobService,
  containerName: string,
  blobName: string,
  options: azureStorage.BlobService.GetBlobRequestOptions = {}
): Promise<Either<Error, Option<A>>> => {
  const errorOrMaybeText = await getBlobAsText(
    blobService,
    containerName,
    blobName,
    options
  );
  return pipe(
    errorOrMaybeText,
    E.chain(maybeText => {
      if (isNone(maybeText)) {
        return E.right(none);
      }

      const text = maybeText.value;
      try {
        const json = JSON.parse(text);
        return pipe(
          type.decode(json),
          E.fold(
            err => E.left(new Error(readableReport(err))),
            _ => E.right(some(_))
          )
        );
      } catch (e) {
        // e will always be an instance of SyntaxError here which is a subclass of Error
        return E.left(e as Error);
      }
    })
  );
};

// TABLE STORAGE FUNCTIONS AND TYPES

// Basic type for a table entity
/* eslint-disable @typescript-eslint/naming-convention */
export const TableEntity = t.interface({
  PartitionKey: t.string,
  RowKey: t.string
});
/* eslint-enable @typescript-eslint/naming-convention */

export type ITableEntity = t.TypeOf<typeof TableEntity>;

// Code used by tableService when an entity is not found

export const ResourceNotFoundCode = "ResourceNotFound";

// Describe a entity returned by the retrieveEntity function
interface IEntityResult {
  readonly [key: string]: {
    readonly _: unknown; // Contains the value
    readonly $?: string; // Contains the type (Ex. `Edm.String`)
  };
}

// A type used to map IEntityResult to an object containing only values
interface IEntityResultValueOnly {
  readonly [key: string]: unknown;
}

/**
 * The TableService retrieveEntity function returns an object with a format like
 *
 * `"Key": {"&": DataType, "_": Value}`
 *
 * this function converts to an object containing only the values like:
 *
 * `"Key": Value`
 *
 * @param entityResult the object returned by TableService retrieveEntity function
 */
export const getValueOnlyEntityResolver = (
  // We use Object becuase it is required by the azure-storage TableEntityRequestOptions type
  // eslint-disable-next-line @typescript-eslint/ban-types
  entityResult: Object
): IEntityResultValueOnly => {
  const typedEntityResult = entityResult as IEntityResult;
  return Object.keys(typedEntityResult).reduce<IEntityResultValueOnly>(
    (accumulator, key) => ({
      ...accumulator,
      [key]: typedEntityResult[key]._
    }),
    {}
  );
};

/**
 * Insert an entity in table storage
 *
 * @param tableService the Azure table service
 * @param tableName the name of the table
 * @param entity the entity to store
 */
export const insertTableEntity = async <T extends ITableEntity>(
  tableService: azureStorage.TableService,
  tableName: string,
  entity: T
): Promise<Either<Error, azureStorage.TableService.EntityMetadata>> =>
  new Promise(resolve => {
    // eslint-disable-next-line sonarjs/no-identical-functions
    tableService.insertEntity<T>(tableName, entity, (err, result, _) =>
      resolve(err ? E.left(err) : E.right(result))
    );
  });

/**
 * Retrieve an entity from table storage
 *
 * @param tableService the Azure table service
 * @param tableName the name of the table
 * @param partitionKey
 * @param rowKey
 */
export const retrieveTableEntity = async (
  tableService: azureStorage.TableService,
  tableName: string,
  partitionKey: string,
  rowKey: string,
  options: azureStorage.TableService.TableEntityRequestOptions = {
    entityResolver: getValueOnlyEntityResolver
  }
): Promise<Either<StorageError, Option<unknown>>> =>
  new Promise(resolve => {
    tableService.retrieveEntity(
      tableName,
      partitionKey,
      rowKey,
      options,
      (err, result, _) => {
        if (err) {
          const errorAsStorageError = err as StorageError;
          if (errorAsStorageError.code === ResourceNotFoundCode) {
            return resolve(E.right(none));
          }
          return resolve(E.left(errorAsStorageError));
        }

        return resolve(E.right(some(result)));
      }
    );
  });
