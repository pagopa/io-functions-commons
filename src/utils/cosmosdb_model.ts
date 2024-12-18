// eslint-disable @typescript-eslint/member-ordering

import * as E from "fp-ts/lib/Either";
import { Option } from "fp-ts/lib/Option";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import { TaskEither } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { PromiseType } from "@pagopa/ts-commons/lib/types";

import {
  Container,
  ErrorResponse,
  FeedOptions,
  FeedResponse,
  ItemDefinition,
  ItemResponse,
  PatchOperationType,
  RequestOptions,
  Resource,
  SqlQuerySpec
} from "@azure/cosmos";
import * as RA from "fp-ts/ReadonlyArray";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { flow, pipe } from "fp-ts/lib/function";
import * as R from "./record";
import { mapAsyncIterable } from "./async";
import { isDefined } from "./types";

export const CosmosDocumentIdKey = "id" as const;
export type CosmosDocumentIdKey = typeof CosmosDocumentIdKey;

// For basic models, the identity field is always the id of cosmos
export type BaseModel = t.TypeOf<typeof BaseModel>;
export const BaseModel = t.interface({
  id: NonEmptyString
});

// The set of keys for a model
// T might not include base model fields ("id"), but we know they are mandatory in cosmos documents
// Quick win would be to narrow T to extend BaseModel, but that way we'd lose usage flexibility
// Hence we omit "extends BaseModel", but we check keys to be part of "T & BaseModel"

/**
 * Model a tuple which defines the references to search for a document.
 * A Cosmodb document must be looked-up by its Identity alongside its PartitionKey. If PartitionKey field is the same of Identity field, it can be omitted.
 * Hence this type models both cases: (ID) or (ID,PK) respectively if PK literal type is omitted or provided.
 *
 * @param T the type of the document mapped by the model
 * @param ModelIdKey the literal type defining the name of the ID field for the document.
 * @param PartitionKey (optional) the literal type defining the name of the partition key field. Default: undefined
 */
export type DocumentSearchKey<
  T,
  // T might not include base model fields ("id"), but we know they are mandatory in cosmos documents
  // Quick win would be to narrow T to extend BaseModel, but that way we'd lose usage flexibility
  // Hence we omit "extends BaseModel", but we check keys to be part of "T & BaseModel"
  ModelIdKey extends keyof (T & BaseModel),
  PartitionKey extends keyof (T & BaseModel) = ModelIdKey
> =
  // We must be sure the provided keys refer to fields whose value is appropriate
  // the modelId must be a string
  // the partitiion key might be a string or a number
  Pick<BaseModel & T, ModelIdKey | PartitionKey> extends Record<
    ModelIdKey,
    string
  > &
    Record<PartitionKey, string | number>
    ? PartitionKey extends ModelIdKey // partition key === model id means no partition key is provided
      ? readonly [string]
      : readonly [string, string | number]
    : never;

export type AzureCosmosResource = t.TypeOf<typeof AzureCosmosResource>;
export const AzureCosmosResource = t.interface({
  _etag: t.string,
  _rid: t.string,
  _self: t.string,
  _ts: t.number
});

// An io-ts definition of Cosmos Resource runtime type
// IDs are enforced to be non-empty string, as we're sure they are always valued when coming from db.
export type CosmosResource = t.TypeOf<typeof CosmosResource>;
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
export const CosmosResource = t.intersection([
  BaseModel,
  AzureCosmosResource
  // this cast is used to keep CosmosResource aligned
  // with @azure/cosmos/Resource type definition
]) as t.Type<Resource & { readonly id: NonEmptyString }>;

// An empty response from a Cosmos operation
export const CosmosEmptyResponse = {
  kind: "COSMOS_EMPTY_RESPONSE"
} as const;

export const CosmosConflictResponse = {
  kind: "COSMOS_CONFLICT_RESPONSE"
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
  | typeof CosmosConflictResponse
  | ReturnType<typeof CosmosDecodingError>
  | ReturnType<typeof CosmosErrorResponse>;

export const toCosmosErrorResponse = (
  e: unknown
): ReturnType<typeof CosmosErrorResponse> =>
  CosmosErrorResponse(
    (e instanceof Error ? e : new Error(String(e))) as ErrorResponse
  );

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

  return pipe(
    TE.tryCatch<CosmosErrors, PromiseType<ReturnType<typeof createItem>>>(
      () =>
        createItem(item, {
          // we never want the SDK to generate an ID for us, the item ID must
          // always be provided by the type T
          disableAutomaticIdGeneration: true,
          ...options
        }),
      toCosmosErrorResponse
    ),
    TE.map(createResponse => createResponse.resource),
    // FIXME: not sure whether an undefined resource should be an error
    TE.filterOrElseW(isDefined, () => CosmosEmptyResponse),
    TE.chainW(retrievedItem =>
      TE.fromEither(
        pipe(
          retrievedItemT.decode(retrievedItem),
          E.mapLeft(CosmosDecodingError)
        )
      )
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
  TR extends Readonly<T & CosmosResource>,
  PartitionKey extends keyof (T & BaseModel) = CosmosDocumentIdKey
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
      this.container.items.create.bind(this.container.items)
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
      this.container.items.upsert.bind(this.container.items)
    )(newDocument, options);
  }

  /**
   * Partial update an existing document identified by searchKey.
   *
   * @param searchKey the document identifier
   * @param partialDocument the field to update
   * @param condition the condition for performing patch operation (not required)
   * @param options the request option (not required)
   * @returns a task either containig the updated document
   */
  public patch(
    searchKey: DocumentSearchKey<TR, CosmosDocumentIdKey, PartitionKey>,
    partialDocument: Partial<T>,
    condition?: string,
    options?: RequestOptions
  ): TE.TaskEither<CosmosErrors, TR> {
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
      RA.toArray, // copy the readonly array to a mutable one
      patchOperations =>
        TE.tryCatch(
          () =>
            this.container
              .item(documentId, partitionKey)
              .patch({ condition, operations: patchOperations }, options),
          toCosmosErrorResponse
        ),
      TE.map(patchResponse => O.fromNullable(patchResponse.resource)),
      TE.chain(
        TE.fromOption(() =>
          CosmosErrorResponse({
            code: 404,
            message: "message item not found for input id",
            name: "Not Found"
          })
        )
      ),
      TE.chainEitherKW(
        flow(this.retrievedItemT.decode, E.mapLeft(CosmosDecodingError))
      )
    );
  }

  /**
   * Retrieves a document from the document ID.
   *
   * @param searchKey    The tuple of values used to look-up a document. It can be [documentId] or [documentId, partitionKey] depending on the definition of the model instance.
   * @param partitionKey  The partitionKey associated to this model.
   */
  public find(
    searchKey: DocumentSearchKey<TR, CosmosDocumentIdKey, PartitionKey>,
    options?: RequestOptions
  ): TaskEither<CosmosErrors, Option<TR>> {
    // documentId must be always valued,
    // meanwhile partitionKey might be undefined
    const documentId = searchKey[0];
    const partitionKey = searchKey[1] || documentId;
    return pipe(
      TE.tryCatch<CosmosErrors, ItemResponse<TR>>(
        () => this.container.item(documentId, partitionKey).read(options),
        toCosmosErrorResponse
      ),
      TE.map(_ => O.fromNullable(_.resource)),
      TE.chain(maybeDocument =>
        O.isSome(maybeDocument)
          ? TE.fromEither(
              pipe(
                this.retrievedItemT.decode(maybeDocument.value),
                E.map(O.some),
                E.mapLeft(CosmosDecodingError)
              )
            )
          : TE.fromEither(E.right(O.none))
      )
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
    return pipe(
      TE.tryCatch<CosmosErrors, FeedResponse<ItemDefinition>>(
        () => this.container.items.readAll(options).fetchAll(),
        toCosmosErrorResponse
      ),
      TE.map(_ => _.resources.map(this.retrievedItemT.decode))
    );
  }

  /**
   * Fetch the first document returned by a given query
   *
   * @deprecated use getQueryIterator + asyncIterableToArray
   */
  public findOneByQuery(
    query: string | SqlQuerySpec,
    options?: FeedOptions
  ): TaskEither<CosmosErrors, Option<TR>> {
    return pipe(
      TE.tryCatch<CosmosErrors, FeedResponse<TR>>(
        () => this.container.items.query<TR>(query, options).fetchAll(),
        toCosmosErrorResponse
      ),
      TE.map(_ => O.fromNullable(_.resources)),
      TE.chain(maybeDocuments =>
        O.isSome(maybeDocuments)
          ? maybeDocuments.value.length > 0
            ? TE.fromEither(
                pipe(
                  this.retrievedItemT.decode(maybeDocuments.value[0]),
                  E.map(O.some),
                  E.mapLeft(CosmosDecodingError)
                )
              )
            : TE.fromEither(E.right(O.none))
          : TE.fromEither(E.right(O.none))
      )
    );
  }
}
