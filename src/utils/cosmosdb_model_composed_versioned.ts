import { Container, ItemDefinition, RequestOptions } from "@azure/cosmos";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import {
  BaseModel,
  CosmosdbModel,
  CosmosDecodingError,
  CosmosErrors
} from "./cosmosdb_model";
import {
  CosmosdbModelVersioned,
  RetrievedVersionedModel,
  VersionedModel
} from "./cosmosdb_model_versioned";

/**
 * Model a tuple which defines the references to search for a document.
 * A Cosmodb document must be looked-up by its Identity alongside its PartitionKey.
 * This type model require both modelIdKey and PartitionKey and handle versioning
 * for all the possible couples.
 *
 * @param T the type of the document mapped by the model
 * @param ReferenceIdKey the literal type defining the name of the ID field for the document.
 * @param PartitionKey the literal type defining the name of the partition key field.
 */
export type DocumentComposedSearchKey<
  T,
  // T might not include base model fields ("id"), but we know they are mandatory in cosmos documents
  // Quick win would be to narrow T to extend BaseModel, but that way we'd lose usage flexibility
  // Hence we omit "extends BaseModel", but we check keys to be part of "T & BaseModel"
  ReferenceIdKey extends keyof (T & BaseModel),
  // PartitionKey and ReferenceIdKey must refers two different fields.
  PartitionKey extends keyof Omit<T & BaseModel, ReferenceIdKey>
> = readonly [(T & BaseModel)[ReferenceIdKey], (T & BaseModel)[PartitionKey]];

/**
 * Returns a string with a composite id that has the format:
 * REFERENCE_ID-PARTITION_KEY-VERSION
 *
 * REFERENCE_ID is the external key
 * PARTITION_KEY is the document partition key
 * VERSION is the zero-padded version of the model version
 *
 * @param referenceId The external key
 * @param partitionKey The model partitionKey
 * @param version The version of the model
 */
export const generateComposedVersionedModelId = <
  T,
  ReferenceIdKey extends keyof T,
  PartitionKey extends keyof Omit<T, ReferenceIdKey>
>(
  modelId: T[ReferenceIdKey],
  partitionKey: T[PartitionKey],
  version: NonNegativeInteger
): NonEmptyString => {
  const paddingLength = 16; // length of Number.MAX_SAFE_INTEGER == 9007199254740991
  const paddedVersion = ("0".repeat(paddingLength) + String(version)).slice(
    -paddingLength
  );
  return `${String(modelId)}-${String(
    partitionKey
  )}-${paddedVersion}` as NonEmptyString;
};

/**
 * This kind of model is an extension of CosmosdbModelVersioned.
 * It can handle versioning on all documents identified by the couple T[ReferenceKey] and T[PartitionKey].
 * To avoid drop of performance is recommandend adopt this pattern only if the number of possible values of T[ReferenceKey] for
 * each value of T[PartitionKey] is limited.
 */
export abstract class CosmosdbModelComposedVersioned<
  T,
  TN extends Readonly<T>,
  TR extends Readonly<T & RetrievedVersionedModel>,
  ReferenceIdKey extends keyof T,
  // PartitionKey field name must be different from ReferenceIdKey field name.
  PartitionKey extends keyof Omit<T, ReferenceIdKey>
> extends CosmosdbModelVersioned<T, TN, TR, ReferenceIdKey, PartitionKey> {
  constructor(
    container: Container,
    protected readonly newVersionedItemT: t.Type<TN, ItemDefinition, unknown>,
    protected readonly retrievedItemT: t.Type<TR, unknown, unknown>,
    protected readonly referenceIdKey: ReferenceIdKey,
    protected readonly partitionKey: PartitionKey
  ) {
    super(
      container,
      newVersionedItemT,
      retrievedItemT,
      referenceIdKey,
      partitionKey
    );
  }

  /**
   * Returns the value of the partition key for the provided item
   */
  protected readonly getPartitionKey = (o: T): T[PartitionKey] =>
    // eslint-disable-next-line no-invalid-this
    o[this.partitionKey];

  /**
   * Insert a document with a specific version
   *
   * @param o
   * @param version
   * @param requestOptions
   */
  protected createNewVersion(
    o: T,
    version: NonNegativeInteger,
    requestOptions?: RequestOptions
  ): TE.TaskEither<CosmosErrors, TR> {
    const modelId = this.getModelId(o);
    const partitionKey = this.getPartitionKey(o);
    const toSave = this.beforeSave(o);

    return pipe(
      TE.fromEither(
        t.intersection([this.newVersionedItemT, VersionedModel]).decode({
          ...toSave,
          id: generateComposedVersionedModelId(modelId, partitionKey, version),
          version
        })
      ),
      TE.mapLeft(CosmosDecodingError),
      TE.chain(document =>
        // We need to call the create method from CosmosdbModel parent Class
        // because the super.create calls the create method from CosmosdbModelVersioned that call again
        // createNewVersion with a deadlock.
        CosmosdbModel.prototype.create.call(this, document, requestOptions)
      )
    );
  }
}
