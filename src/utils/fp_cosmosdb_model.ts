/* eslint-disable @typescript-eslint/explicit-function-return-type */
import * as t from "io-ts";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import {
  Container,
  FeedOptions,
  ItemDefinition,
  PatchOperationType,
  RequestOptions,
  SqlQuerySpec
} from "@azure/cosmos";
import { flow, pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";
import { mapAsyncIterable } from "../utils/async";
import {
  BaseModel,
  CosmosResource,
  CosmosDocumentIdKey
} from "../utils/cosmosdb_model";
import {
  CosmosErrors,
  wrapCreate,
  DocumentSearchKey,
  toCosmosErrorResponse,
  CosmosDecodingError
} from "../utils/cosmosdb_model";
import * as R from "../utils/record";
import { CosmosErrorResponse } from "./cosmosdb_model";

export interface ICosmosClient<
  T,
  TN extends Readonly<T & BaseModel>,
  TR extends Readonly<T & CosmosResource>,
  PartitionKey extends keyof (T & BaseModel)
> {
  readonly container: Container;
  readonly newItemT: t.Type<TN, ItemDefinition, unknown>;
  readonly retrievedItemT: t.Type<TR, unknown, unknown>;
  readonly partitionKeyT: PartitionKey;
}

/**
 * Creates a new document.
 *
 * For an explanation on how the data store gets partitioned, see
 * https://docs.microsoft.com/en-us/azure/cosmos-db/partition-data
 */
export const create: <
  T,
  TN extends Readonly<T & BaseModel>,
  TR extends Readonly<T & CosmosResource>,
  PartitionKey extends keyof (T & BaseModel)
>(
  client: ICosmosClient<T, TN, TR, PartitionKey>,
  options?: RequestOptions
) => (newDocument: TN) => TE.TaskEither<CosmosErrors, TR> = (
  client,
  options
) => newDocument =>
  wrapCreate(
    client.newItemT,
    client.retrievedItemT,
    client.container.items.create.bind(client.container.items)
  )(newDocument, options);

/**
 * Creates a new document or update an existing one
 * with the provided id.
 *
 */
export const upsert: <
  T,
  TN extends Readonly<T & BaseModel>,
  TR extends Readonly<T & CosmosResource>,
  PartitionKey extends keyof (T & BaseModel)
>(
  client: ICosmosClient<T, TN, TR, PartitionKey>,
  options?: RequestOptions
) => (newDocument: TN) => TE.TaskEither<CosmosErrors, TR> = (
  client,
  options
) => newDocument =>
  wrapCreate(
    client.newItemT,
    client.retrievedItemT,
    client.container.items.upsert.bind(client.container.items)
  )(newDocument, options);

export const patch: <
  T,
  TN extends Readonly<T & BaseModel>,
  TR extends Readonly<T & CosmosResource>,
  PartitionKey extends keyof (T & BaseModel)
>(
  client: ICosmosClient<T, TN, TR, PartitionKey>,
  options?: RequestOptions
) => (
  searchKey: DocumentSearchKey<TR, CosmosDocumentIdKey, PartitionKey>,
  partialDocument: Partial<T>
) => TE.TaskEither<CosmosErrors, TR> = (client, options) => (
  searchKey,
  partialDocument
) => {
  // documentId must be always valued,
  // meanwhile partitionKey might be undefined
  const documentId = searchKey[0];
  const partitionKey = searchKey[1] || documentId;
  return pipe(
    partialDocument,
    R.toArray(),
    RA.map(entry => ({
      op: PatchOperationType.add,
      path: `/${entry.key}`,
      value: entry.value
    })),
    readonlyPatchOperations => readonlyPatchOperations.slice(), // copy the readonly array to a mutable one
    patchOperations =>
      TE.tryCatch(
        () =>
          client.container
            .item(documentId, partitionKey)
            .patch(patchOperations, options),
        toCosmosErrorResponse
      ),
    TE.map(patchResponse => O.fromNullable(patchResponse.resource)),
    TE.chain(
      TE.fromOption(() =>
        CosmosErrorResponse({
          code: 404,
          message: "message item not foud for input id",
          name: "Not Found"
        })
      )
    ),
    TE.chainEitherKW(
      flow(client.retrievedItemT.decode, E.mapLeft(CosmosDecodingError))
    )
  );
};

export const find: <
  T,
  TN extends Readonly<T & BaseModel>,
  TR extends Readonly<T & CosmosResource>,
  PartitionKey extends keyof (T & BaseModel)
>(
  client: ICosmosClient<T, TN, TR, PartitionKey>,
  options?: RequestOptions
) => (
  searchKey: DocumentSearchKey<TR, CosmosDocumentIdKey, PartitionKey>
) => TE.TaskEither<CosmosErrors, O.Option<TR>> = (
  client,
  options
) => searchKey => {
  // documentId must be always valued,
  // meanwhile partitionKey might be undefined
  const documentId = searchKey[0];
  const partitionKey = searchKey[1] || documentId;
  return pipe(
    TE.tryCatch(
      () => client.container.item(documentId, partitionKey).read(options),
      toCosmosErrorResponse
    ),
    TE.map(_ => O.fromNullable(_.resource)),
    TE.chainW(maybeDocument =>
      O.isSome(maybeDocument)
        ? TE.fromEither(
            pipe(
              client.retrievedItemT.decode(maybeDocument.value),
              E.map(O.some),
              E.mapLeft(CosmosDecodingError)
            )
          )
        : TE.fromEither(E.right(O.none))
    )
  );
};

/**
 * Get an iterator to process all documents of the collection.
 */
export const getCollectionIterator: <
  T,
  TN extends Readonly<T & BaseModel>,
  TR extends Readonly<T & CosmosResource>,
  PartitionKey extends keyof (T & BaseModel)
>(
  client: ICosmosClient<T, TN, TR, PartitionKey>,
  options?: FeedOptions
) => () => AsyncIterable<ReadonlyArray<t.Validation<TR>>> = (
  client,
  options
) => () => {
  const iterator = client.container.items.readAll(options).getAsyncIterator();
  return mapAsyncIterable(iterator, feedResponse =>
    feedResponse.resources.map(client.retrievedItemT.decode)
  );
};

/**
 * Get an iterator to process all documents returned by a specific query.
 */
export const getQueryIterator: <
  T,
  TN extends Readonly<T & BaseModel>,
  TR extends Readonly<T & CosmosResource>,
  PartitionKey extends keyof (T & BaseModel)
>(
  client: ICosmosClient<T, TN, TR, PartitionKey>,
  options?: FeedOptions
) => (
  query: string | SqlQuerySpec
) => AsyncIterable<ReadonlyArray<t.Validation<TR>>> = (
  client,
  options
) => query => {
  const iterator = client.container.items
    .query(query, options)
    .getAsyncIterator();
  return mapAsyncIterable(iterator, feedResponse =>
    feedResponse.resources.map(client.retrievedItemT.decode)
  );
};
