/**
 * Utility functions to interact with an Azure Blob Storage.
 */
import * as azureStorage from "azure-storage";
import * as t from "io-ts";

import { Either, fromOption, left, right, tryCatch } from "fp-ts/lib/Either";
import { fromNullable, Option } from "fp-ts/lib/Option";
import { readableReport } from "italia-ts-commons/lib/reporters";

type Resolve<T> = (value?: T | PromiseLike<T>) => void;

/**
 * Utility function to avoid code duplication detection by tslint
 */
const resolveErrorOrLeaseResult = (
  resolve: Resolve<Either<Error, azureStorage.BlobService.LeaseResult>>
) => (
  err: Error,
  result: azureStorage.BlobService.LeaseResult,
  _: azureStorage.ServiceResponse
) => {
  if (err) {
    return resolve(left(err));
  } else {
    return resolve(right(result));
  }
};

/**
 * Acquire lease for a blob.
 *
 * @param blobService     the Azure blob service
 * @param containerName   the name of the Azure blob storage container
 * @param blobName        blob file name
 */
export function acquireLease(
  blobService: azureStorage.BlobService,
  containerName: string,
  blobName: string
): Promise<Either<Error, azureStorage.BlobService.LeaseResult>> {
  return new Promise(resolve => {
    blobService.acquireLease(
      containerName,
      blobName,
      resolveErrorOrLeaseResult(resolve)
    );
  });
}

/**
 * Release lease for a blob.
 *
 * @param blobService     the Azure blob service
 * @param containerName   the name of the Azure blob storage container
 * @param blobName        blob file name
 * @param leaseId         the id of the lease returned by acquireLease method
 */
export function releaseLease(
  blobService: azureStorage.BlobService,
  containerName: string,
  blobName: string,
  leaseId: string
): Promise<Either<Error, azureStorage.BlobService.LeaseResult>> {
  return new Promise(resolve => {
    blobService.releaseLease(
      containerName,
      blobName,
      leaseId,
      resolveErrorOrLeaseResult(resolve)
    );
  });
}

/**
 * Create a new blob (media) from plain text.
 * Assumes that the container <containerName> already exists.
 *
 * @param blobService     the Azure blob service
 * @param containerName   the name of the Azure blob storage container
 * @param blobName        blob storage container name
 * @param text            text to be saved
 */
export function upsertBlobFromText(
  blobService: azureStorage.BlobService,
  containerName: string,
  blobName: string,
  text: string | Buffer
): Promise<Either<Error, Option<azureStorage.BlobService.BlobResult>>> {
  return new Promise(resolve =>
    blobService.createBlockBlobFromText(
      containerName,
      blobName,
      text,
      (err, result, __) => {
        if (err) {
          return resolve(
            left<Error, Option<azureStorage.BlobService.BlobResult>>(err)
          );
        } else {
          return resolve(
            right<Error, Option<azureStorage.BlobService.BlobResult>>(
              fromNullable(result)
            )
          );
        }
      }
    )
  );
}

/**
 * Create a new blob (media) from a typed object.
 * Assumes that the container <containerName> already exists.
 *
 * @param blobService     the Azure blob service
 * @param containerName   the name of the Azure blob storage container
 * @param blobName        blob storage container name
 * @param content         object to be serialized and saved
 */
export function upsertBlobFromObject<T>(
  blobService: azureStorage.BlobService,
  containerName: string,
  blobName: string,
  content: T
): Promise<Either<Error, Option<azureStorage.BlobService.BlobResult>>> {
  return upsertBlobFromText(
    blobService,
    containerName,
    blobName,
    JSON.stringify(content)
  );
}

/**
 * Get a blob content as text (string).
 *
 * @param blobService     the Azure blob service
 * @param containerName   the name of the Azure blob storage container
 * @param blobName        blob file name
 */
export function getBlobAsText(
  blobService: azureStorage.BlobService,
  containerName: string,
  blobName: string
): Promise<Either<Error, Option<string>>> {
  return new Promise(resolve => {
    blobService.getBlobToText(containerName, blobName, (err, result, __) => {
      if (err) {
        return resolve(left<Error, Option<string>>(err));
      } else {
        return resolve(right<Error, Option<string>>(fromNullable(result)));
      }
    });
  });
}

/**
 * Get a blob content as a typed (io-ts) object.
 *
 * @param blobService     the Azure blob service
 * @param containerName   the name of the Azure blob storage container
 * @param blobName        blob file name
 */
export async function getBlobAsObject<A, O, I>(
  type: t.Type<A, O, I>,
  blobService: azureStorage.BlobService,
  containerName: string,
  blobName: string
): Promise<Either<Error, A>> {
  const errorOrMaybeJsonText = await getBlobAsText(
    blobService,
    containerName,
    blobName
  );
  return errorOrMaybeJsonText.chain(maybeJsonText =>
    fromOption(new Error("getBlobAsObject: cannot get json from blob"))(
      maybeJsonText
    )
      .chain(jsonText => tryCatch(() => JSON.parse(jsonText)))
      .chain(parsedJson =>
        type.decode(parsedJson).mapLeft(errs => new Error(readableReport(errs)))
      )
  );
}
