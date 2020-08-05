import {
  BaseModel,
  CosmosdbModel,
  CosmosErrors,
  CosmosResource
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

export const ModelId = t.string; // FIXME: make it branded

export type ModelId = t.TypeOf<typeof ModelId>;

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
export function generateVersionedModelId(
  modelId: ModelId,
  version: NonNegativeInteger
): string {
  const paddingLength = 16; // length of Number.MAX_SAFE_INTEGER == 9007199254740991
  const paddedVersion = ("0".repeat(paddingLength) + String(version)).slice(
    -paddingLength
  );
  return `${modelId}-${paddedVersion}`;
}

export const incVersion = (version: NonNegativeInteger) =>
  (Number(version) + 1) as NonNegativeInteger;

/**
 * Assumption: the model ID is also the partition key
 */
export abstract class CosmosdbModelVersioned<
  T,
  TN extends Readonly<T & Partial<NewVersionedModel>>,
  TR extends Readonly<T & RetrievedVersionedModel>
> extends CosmosdbModel<T, TN & BaseModel, TR> {
  constructor(
    container: Container,
    protected readonly newVersionedItemT: t.Type<TN, ItemDefinition, unknown>,
    protected readonly retrievedItemT: t.Type<TR, unknown, unknown>,
    protected readonly modelIdKey: keyof T
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
    const versionedModelId = generateVersionedModelId(modelId, version);

    const newDocument = {
      ...o,
      id: versionedModelId,
      version
    } as TN & RetrievedVersionedModel;

    return super.create(newDocument, options);
  };

  /**
   * Creates a new version from a full item definition
   */
  public upsert = (
    o: TN,
    requestOptions?: RequestOptions,
    partitionKey?: string
  ): TaskEither<CosmosErrors, TR> => {
    // if we get an explicit version number from the new document we use that,
    // or else we get the last version by querying the database
    const currentVersion: NonNegativeInteger | undefined = o.version;
    const modelId = this.getModelId(o);
    return (currentVersion === undefined
      ? this.getNextVersion(modelId, partitionKey)
      : fromEither<CosmosErrors, NonNegativeInteger>(right(currentVersion))
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
    modelId: string,
    partitionKey?: string
  ): TaskEither<CosmosErrors, Option<TR>> {
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
   * Returns the value of the model ID for the provided item
   */
  protected getModelId = (o: T) =>
    // tslint:disable-next-line: no-useless-cast
    ModelId.decode(String(o[this.modelIdKey])).value as ModelId;

  /**
   * Returns the next version for the model which `id` is `modelId`.
   *
   * The next version will be the last one from the database incremented by 1 or
   * 0 if no previous version exists in the database.
   */
  private getNextVersion = (modelId: ModelId, partitionKey?: string) =>
    this.findLastVersionByModelId(modelId, partitionKey).map(maybeLastVersion =>
      maybeLastVersion
        .map(_ => incVersion(_.version))
        .getOrElse(0 as NonNegativeInteger)
    );
}
