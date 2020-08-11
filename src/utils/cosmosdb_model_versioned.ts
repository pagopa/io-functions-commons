import {
  BaseModel,
  CosmosdbModel,
  CosmosErrors,
  CosmosResource,
  DocumentSearchKey
} from "./cosmosdb_model";

import * as t from "io-ts";

import { Option } from "fp-ts/lib/Option";
import { TaskEither } from "fp-ts/lib/TaskEither";

import { NonNegativeInteger } from "italia-ts-commons/lib/numbers";

import {
  Container,
  ItemDefinition,
  RequestOptions,
  SqlQuerySpec
} from "@azure/cosmos";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

/**
 * A NewVersionedModel may provide an optional version for new items
 */
export const NewVersionedModel = t.partial({});

export type NewVersionedModel = t.TypeOf<typeof NewVersionedModel>;

/**
 * A RetrievedVersionedModel should track the version of the model
 */
export const RetrievedVersionedModel = t.intersection([
  CosmosResource,
  t.interface({
    version: NonNegativeInteger
  })
]);

export type RetrievedVersionedModel = t.TypeOf<typeof RetrievedVersionedModel>;

/**
 * Returns a string with a composite id that has the format:
 * MODEL_ID-VERSION
 *
 * MODEL_ID is the base model ID
 * VERSION is the zero-padded version of the model
 *
 * @param modelId The base model ID
 * @param version The version of the model
 */
export function generateVersionedModelId<T, ModelIdKey extends keyof T>(
  modelId: T[ModelIdKey],
  version: NonNegativeInteger
): NonEmptyString {
  const paddingLength = 16; // length of Number.MAX_SAFE_INTEGER == 9007199254740991
  const paddedVersion = ("0".repeat(paddingLength) + String(version)).slice(
    -paddingLength
  );
  return `${String(modelId)}-${paddedVersion}` as NonEmptyString;
}

export const incVersion = (version: NonNegativeInteger) =>
  (Number(version) + 1) as NonNegativeInteger;

/**
 * Assumption: the model ID is also the partition key
 */
export abstract class CosmosdbModelVersioned<
  T,
  TN extends Readonly<T & Partial<NewVersionedModel>>,
  TR extends Readonly<T & RetrievedVersionedModel>,
  ModelIdKey extends keyof T,
  PartitionKey extends keyof T = ModelIdKey
> extends CosmosdbModel<T, TN & BaseModel, TR, PartitionKey> {
  constructor(
    container: Container,
    protected readonly newVersionedItemT: t.Type<TN, ItemDefinition, unknown>,
    protected readonly retrievedItemT: t.Type<TR, unknown, unknown>,
    protected readonly modelIdKey: ModelIdKey,
    protected readonly partitionKey?: PartitionKey
  ) {
    super(
      container,
      t.intersection([newVersionedItemT, BaseModel]),
      retrievedItemT
    );
  }

  /**
   * Create a new document with version 0.
   * This method is meant to be used if we want the document to be the first of its versioning history,
   * thus version will be set to 0 regardless of the eventual value of o.version.
   * A 409-conflict error is meant to be raised by the db engine if we already have a document with the pair (modelId, 0).
   *
   * @param o the document to be saved
   * @param options query options for the db operation
   */
  public create(o: TN, options?: RequestOptions): TaskEither<CosmosErrors, TR> {
    return this.createNewVersion(o, 0 as NonNegativeInteger, options);
  }

  /**
   * Creates a new version from a full item definition. By a caller perspective, it should behave just like a normal upsert.
   * The version of the new created document is always calculated from the latest item on db, regardless of the eventual value of o.version.
   * This method is meant to be used when we want the provided document to be the latest version of the item, regardless of any concurrent modification to it.
   *
   * @param o the document to be saved
   * @param options query options for the db operation
   */
  public upsert(
    o: TN,
    requestOptions?: RequestOptions
  ): TaskEither<CosmosErrors, TR> {
    return this.getNextVersion(this.getSearchKey(o)).chain(nextVersion =>
      this.createNewVersion(o, nextVersion, requestOptions)
    );
  }

  /**
   * Creates a new version from a full item definition. By a caller perspective, it should behave just like a normal update.
   * The version of the new created document is always calculated by incrementing the one on the provided document
   * When creating the new item, it performs an optimistic lock on the pair (modelId, version).
   * If there is already an item with such pair (which is the case that the item has been update concurrently by another workflow), it returns a conflict error (code: 409)
   * This method is meant to be used when we want to update a model which was retrieved before, and we assume that there's no other workflow updating the same model
   *
   * @param o the document to be saved
   * @param options query options for the db operation
   */
  public update(
    o: TR,
    requestOptions?: RequestOptions
  ): TaskEither<CosmosErrors, TR> {
    return this.createNewVersion(
      this.toBaseType(o),
      incVersion(o.version),
      requestOptions
    );
  }

  /**
   *  Find the last version of a document.
   *
   *  Pass the partitionKey field / values if it differs from the modelId
   *  to avoid multi-partition queries.
   */
  public findLastVersionByModelId(
    searchKey: DocumentSearchKey<T, ModelIdKey, PartitionKey>
  ): TaskEither<CosmosErrors, Option<TR>> {
    const [modelId, partitionKey] = searchKey;
    const q: SqlQuerySpec = {
      parameters: [
        {
          name: "@modelId",
          value: modelId
        }
      ],
      // Note: do not use ${collectionName} here as it may contain special characters
      query: `SELECT * FROM m WHERE m.${this.modelIdKey} = @modelId ORDER BY m.version DESC`
    };
    return super.findOneByQuery(q, {
      maxItemCount: 1,
      partitionKey: partitionKey !== undefined ? partitionKey : modelId
    });
  }

  /**
   * Given a document, extract the tuple that define the search key for it
   * @param document
   */
  protected getSearchKey(
    document: T
  ): DocumentSearchKey<T, ModelIdKey, PartitionKey> {
    const pk: PartitionKey | undefined = this.partitionKey;
    const id: ModelIdKey = this.modelIdKey;
    const searchKey =
      typeof pk === "undefined"
        ? [document[id]]
        : // this cast is needed as "Generics extending unions cannot be narrowed"
          // @see https://github.com/microsoft/TypeScript/issues/13995
          [document[id], document[(pk as unknown) as keyof T]];

    return (searchKey as unknown) as DocumentSearchKey<
      T,
      ModelIdKey,
      PartitionKey
    >;
  }

  /**
   * Returns the value of the model ID for the provided item
   */
  protected getModelId = (o: T): T[ModelIdKey] => o[this.modelIdKey];

  /**
   * Returns the next version for the model which `id` is `modelId`.
   *
   * The next version will be the last one from the database incremented by 1 or
   * 0 if no previous version exists in the database.
   */
  private getNextVersion = (
    searchKey: DocumentSearchKey<T, ModelIdKey, PartitionKey>
  ) =>
    this.findLastVersionByModelId(searchKey).map(maybeLastVersion =>
      maybeLastVersion
        .map(_ => incVersion(_.version))
        .getOrElse(0 as NonNegativeInteger)
    );

  /**
   * Insert a document with a specific version
   * @param o
   * @param version
   * @param requestOptions
   */
  private createNewVersion(
    o: T,
    version: NonNegativeInteger,
    requestOptions?: RequestOptions
  ): TaskEither<CosmosErrors, TR> {
    const modelId = this.getModelId(o);
    return super.create(
      {
        ...o,
        id: generateVersionedModelId(modelId, version),
        version
      } as TN & RetrievedVersionedModel,
      requestOptions
    );
  }

  /**
   * Strips off meta fields which are nor part of the base model definition
   * @param o
   */
  private toBaseType(o: TR): T {
    const { _etag, _rid, _self, _ts, id, version, ...n } = o;
    return (n as unknown) as T;
  }
}
