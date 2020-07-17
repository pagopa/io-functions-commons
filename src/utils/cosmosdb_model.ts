// tslint:disable: member-ordering

import { right } from "fp-ts/lib/Either";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";
import { fromEither, TaskEither, tryCatch } from "fp-ts/lib/TaskEither";

import * as t from "io-ts";

import { PromiseType } from "italia-ts-commons/lib/types";

import {
  Container,
  ErrorResponse,
  FeedOptions,
  ItemDefinition,
  ItemResponse,
  RequestOptions,
  Resource,
  SqlQuerySpec
} from "@azure/cosmos";

import { mapAsyncIterable } from "./async";
import { isDefined } from "./types";

export const BaseModel = t.interface({
  id: t.string // FIXME: should this be a NonEmptyString?
});

export type BaseModel = t.TypeOf<typeof BaseModel>;

// An io-ts definition of Cosmos Resource runtime type
// tslint:disable-next-line: no-useless-cast
export const ResourceT = t.intersection([
  t.interface({
    _etag: t.string,
    _rid: t.string,
    _self: t.string,
    _ts: t.number
  }),
  BaseModel
]) as t.Type<Resource>;

// An empty response from a Cosmos operation
export const CosmosEmptyResponse = {
  kind: "COSMOS_EMPTY_RESPONSE"
} as const;

// Error while decoding object from an Cosmos operation
export const CosmosDecodingError = (error: t.Errors) =>
  ({
    error,
    kind: "COSMOS_DECODING_ERROR"
  } as const);

// An ErrorResponse from a Cosmos operation
export const CosmosErrorResponse = (error: ErrorResponse) =>
  ({
    error,
    kind: "COSMOS_ERROR_RESPONSE"
  } as const);

// Union of all possible errors from a Cosmos operation
export type CosmosErrors =
  | typeof CosmosEmptyResponse
  | ReturnType<typeof CosmosDecodingError>
  | ReturnType<typeof CosmosErrorResponse>;

const wrapCreate = <TN, TR>(
  newItemT: t.Type<TN, ItemDefinition, unknown>,
  retrievedItemT: t.Type<TR, unknown, unknown>,
  createItem: (
    document: ItemDefinition,
    options?: RequestOptions
  ) => Promise<ItemResponse<ItemDefinition>>
) => (
  newDocument: TN,
  options?: RequestOptions
): TaskEither<CosmosErrors, TR> => {
  const item = newItemT.encode(newDocument);
  return (
    tryCatch<CosmosErrors, PromiseType<ReturnType<typeof createItem>>>(
      () =>
        createItem(item, {
          // we never want the SDK to generate an ID for us, the item ID must
          // always be provided by the type T
          disableAutomaticIdGeneration: true,
          ...options
        }),
      _ => CosmosErrorResponse(_ as ErrorResponse)
    )
      .map(_ => _.resource)
      // FIXME: not sure whether an undefined resource should be an error
      .filterOrElse(isDefined, CosmosEmptyResponse)
      .chain(_ =>
        fromEither(retrievedItemT.decode(_).mapLeft(CosmosDecodingError))
      )
  );
};

/**
 * A persisted data model backed by a CosmosDB client: this base class
 * abstracts the semantics of the CosmosDB API, by providing the shared code
 * for persisting, retrieving and updating a document model.
 * To create a new CosmosDB backed model, define a concrete class by extending
 * this abstract class.
 *
 * @param T   The base document type (i.e. an interface that defined the
 *            document attributes).
 */
export abstract class CosmosdbModel<
  T,
  TN extends Readonly<T & BaseModel>,
  TR extends Readonly<T & BaseModel> // could extend ResourceT
> {
  /**
   * Creates a new instance of the document model on the provided CosmosDB
   * container.
   *
   * Note: the partition key is retrieved from the Container metadata.
   */
  constructor(
    protected readonly container: Container,
    protected readonly newItemT: t.Type<TN, ItemDefinition, unknown>,
    protected readonly retrievedItemT: t.Type<TR, unknown, unknown>
  ) {}

  /**
   * Creates a new document.
   *
   * For an explanation on how the data store gets partitioned, see
   * https://docs.microsoft.com/en-us/azure/cosmos-db/partition-data
   */
  public create(
    newDocument: TN,
    options?: RequestOptions
  ): TaskEither<CosmosErrors, TR> {
    return wrapCreate<TN, TR>(
      this.newItemT,
      this.retrievedItemT,
      this.container.items.create
    )(newDocument, options);
  }

  /**
   * Creates a new document or update an existing one
   * with the provided id.
   *
   */
  public upsert(
    newDocument: TN,
    options?: RequestOptions
  ): TaskEither<CosmosErrors, TR> {
    return wrapCreate(
      this.newItemT,
      this.retrievedItemT,
      this.container.items.upsert
    )(newDocument, options);
  }

  /**
   * Retrieves a document from the document ID.
   *
   * @param documentId    The ID of the document to retrieve.
   * @param partitionKey  The partitionKey associated to this model.
   */
  public find(
    documentId: string,
    partitionKey: string,
    options?: RequestOptions
  ): TaskEither<CosmosErrors, Option<TR>> {
    const readItem = this.container.item(documentId, partitionKey).read;
    return tryCatch<CosmosErrors, PromiseType<ReturnType<typeof readItem>>>(
      () => readItem(options),
      _ => CosmosErrorResponse(_ as ErrorResponse)
    )
      .map(_ => fromNullable(_.resource))
      .chain(_ =>
        _.isSome()
          ? fromEither(
              this.retrievedItemT
                .decode(_.value)
                .map(some)
                .mapLeft(CosmosDecodingError)
            )
          : fromEither(right(none))
      );
  }

  /**
   * Get an iterator to process all documents of the collection.
   */
  public getCollectionIterator(
    options?: FeedOptions
  ): AsyncIterable<ReadonlyArray<t.Validation<TR>>> {
    const iterator = this.container.items.readAll(options).getAsyncIterator();
    return mapAsyncIterable(iterator, feedResponse =>
      feedResponse.resources.map(this.retrievedItemT.decode)
    );
  }

  /**
   * Get an iterator to process all documents returned by a specific query.
   */
  public getQueryIterator(
    query: string | SqlQuerySpec,
    options?: FeedOptions
  ): AsyncIterable<ReadonlyArray<t.Validation<TR>>> {
    const iterator = this.container.items
      .query(query, options)
      .getAsyncIterator();
    return mapAsyncIterable(iterator, feedResponse =>
      feedResponse.resources.map(this.retrievedItemT.decode)
    );
  }

  /**
   * Fetch all documents of the collection.
   * Note that this method loads all items in memory at once, it should be used
   * only when it's not feasible to process the items incrementally with
   * getCollectionIterator()
   */
  public getCollection(
    options?: FeedOptions
  ): TaskEither<CosmosErrors, ReadonlyArray<t.Validation<TR>>> {
    const fetchAll = this.container.items.readAll(options).fetchAll;
    return tryCatch<CosmosErrors, PromiseType<ReturnType<typeof fetchAll>>>(
      fetchAll,
      _ => CosmosErrorResponse(_ as ErrorResponse)
    ).map(_ => _.resources.map(this.retrievedItemT.decode));
  }
}
