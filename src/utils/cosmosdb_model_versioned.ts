import {
  BaseModel,
  CosmosdbModel,
  CosmosErrors,
  CosmosResource,
  DocumentSearchKey
} from "./cosmosdb_model";

import * as t from "io-ts";

import { right } from "fp-ts/lib/Either";
import { Option } from "fp-ts/lib/Option";
import { fromEither, TaskEither } from "fp-ts/lib/TaskEither";

import { NonNegativeInteger } from "italia-ts-commons/lib/numbers";

import {
  Container,
  ItemDefinition,
  RequestOptions,
  SqlQuerySpec
} from "@azure/cosmos";

/**
 * A NewVersionedModel may provide an optional version for new items
 */
export const NewVersionedModel = t.partial({
  version: NonNegativeInteger
});

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
): string {
  const paddingLength = 16; // length of Number.MAX_SAFE_INTEGER == 9007199254740991
  const paddedVersion = ("0".repeat(paddingLength) + String(version)).slice(
    -paddingLength
  );
  return `${String(modelId)}-${paddedVersion}`;
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

  public create = (
    o: TN,
    options?: RequestOptions
  ): TaskEither<CosmosErrors, TR> => {
    // if we get an explicit version number from the new document we use that,
    // or else we set version to 0
    const currentVersion: NonNegativeInteger | undefined = o.version;
    const version =
      currentVersion === undefined ? (0 as NonNegativeInteger) : currentVersion;

    // the ID of each document version is composed of the document ID and its version
    // this makes it possible to detect conflicting updates (concurrent creation of
    // profiles with the same profile ID and version)
    const modelId = this.getModelId(o);
    const versionedModelId = generateVersionedModelId<T, ModelIdKey>(
      modelId,
      version
    );

    const newDocument = {
      ...o,
      id: versionedModelId,
      version
    } as TN & RetrievedVersionedModel;

    return super.create(newDocument, options);
  };

  /**
   * Creates a new version from a full item definition. By a caller perspective, it should behave just like a normal upsert.
   * If the item has a version defined, version is increased by one. Otherwise, the version is calculated from the latest item on db.
   * When creating the new item, it performs an optimistic clock on the pair (modelId, version).
   * If there is already an item with such pair (which is the case that the item has been update concurrently by another workflow), it returns a conflict error (code: 409)
   *
   * @param o the item to be updated
   * @param requestOptions
   */

  public upsert = (
    o: TN,
    requestOptions?: RequestOptions
  ): TaskEither<CosmosErrors, TR> => {
    // if we get an explicit version number from the new document we use that,
    // or else we get the last version by querying the database
    const currentVersion: NonNegativeInteger | undefined = o.version;
    const modelId = this.getModelId(o);
    return (currentVersion === undefined
      ? this.getNextVersion(this.getSearchKey(o))
      : fromEither<CosmosErrors, NonNegativeInteger>(
          right(incVersion(currentVersion))
        )
    ).chain(nextVersion =>
      super.create(
        {
          ...o,
          id: generateVersionedModelId(modelId, nextVersion),
          version: nextVersion
        } as TN & RetrievedVersionedModel,
        requestOptions
      )
    );
  };

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
}
