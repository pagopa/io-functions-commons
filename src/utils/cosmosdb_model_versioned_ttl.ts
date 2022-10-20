import {
  Container,
  ItemDefinition,
  JSONValue,
  PatchOperationInput,
  PatchOperationType,
  Response
} from "@azure/cosmos";

import * as t from "io-ts";

import { pipe } from "fp-ts/lib/function";
import { contramap } from "fp-ts/lib/Ord";
import * as N from "fp-ts/lib/number";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as RA from "fp-ts/lib/ReadonlyArray";

import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import {
  CosmosdbModelVersioned,
  VersionedModel
} from "./cosmosdb_model_versioned";
import {
  CosmosErrorResponse,
  CosmosErrors,
  DocumentSearchKey,
  toCosmosErrorResponse
} from "./cosmosdb_model";
import { asyncIterableToArray } from "./async";
import { CosmosResourceTTL } from "./cosmosdb_model_ttl";

type BatchResult = t.TypeOf<typeof BatchResult>;
const BatchResult = t.readonlyArray(t.type({ statusCode: NonNegativeInteger }));

/**
  The purpose of this class is to isolate the `updateTTL` logic, 
  it should be used only for those models which does not generate a lot 
  of versions because the logic to update the ttl is quite expensive.
 
  NB: 
  if You have more than 100 versions the update operation could not be transactional, 
  see https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/transactional-batch?tabs=dotnet
 */

export const RetrievedVersionedModelTTL = t.intersection([
  CosmosResourceTTL,
  VersionedModel
]);

export type RetrievedVersionedModelTTL = t.TypeOf<
  typeof RetrievedVersionedModelTTL
>;

export class CosmosdbModelVersionedTTL<
  T,
  TN extends Readonly<T>,
  TR extends Readonly<T & RetrievedVersionedModelTTL>,
  ModelIdKey extends keyof T,
  PartitionKey extends keyof T = ModelIdKey
> extends CosmosdbModelVersioned<T, TN, TR, ModelIdKey, PartitionKey> {
  constructor(
    container: Container,
    protected readonly newVersionedItemT: t.Type<TN, ItemDefinition, unknown>,
    protected readonly retrievedItemT: t.Type<TR, unknown, unknown>,
    protected readonly modelIdKey: ModelIdKey,
    protected readonly partitionKey?: PartitionKey
  ) {
    super(
      container,
      newVersionedItemT,
      retrievedItemT,
      modelIdKey,
      partitionKey
    );
  }

  /**
   * Using transactionalBatch updates the ttl field for all the versions
   * of the document identified by the searchKey.
   *
   * @param searchKey
   * @param ttl
   * @returns Either a Cosmos Error or the number of updated elements
   */
  public updateTTLForAllVersions(
    searchKey: DocumentSearchKey<TR, ModelIdKey, PartitionKey>,
    ttl: RetrievedVersionedModelTTL["ttl"]
  ): TE.TaskEither<CosmosErrors, number> {
    const partitionKey = ((searchKey.length === 1
      ? searchKey[0]
      : searchKey[1]) as unknown) as TN[PartitionKey];

    return pipe(
      this.findAllVersionsBySearchKey(searchKey),
      TE.map(RA.rights),
      TE.map(
        RA.map(doc => ({
          id: doc.id,
          operationType: "Patch" as const,
          resourceBody: {
            operations: [
              {
                // `add` will create or update the path with the passed value
                op: PatchOperationType.add,
                path: `/ttl`,
                value: ttl
              }
            ]
          }
        }))
      ),
      TE.map(RA.chunksOf(100)),
      TE.map(
        RA.map(chunk =>
          pipe(
            chunk,
            RA.toArray,
            operations => this.batch(operations, partitionKey),
            TE.chainW(
              TE.fromPredicate(
                response => response.code === 200,
                _ => {
                  const firstChunkId = chunk[0].id;
                  const lastChunkId = chunk[chunk.length - 1].id;

                  return CosmosErrorResponse({
                    message: `Error updating ttl for ${searchKey} - chunk from ${firstChunkId} to ${lastChunkId}`,
                    name: `Error updating ttl`
                  });
                }
              )
            )
          )
        )
      ),
      TE.chainW(TE.sequenceSeqArray),
      TE.chainW(responses =>
        pipe(
          responses,
          RA.reduce(0, (v, r) => v + (r.result?.length ?? 0)),
          TE.right
        )
      )
    );
  }

  /**
   * Given a searchKey returns all the version of a document
   */

  public findAllVersionsBySearchKey(
    searchKey: DocumentSearchKey<TR, ModelIdKey, PartitionKey>
  ): TE.TaskEither<CosmosErrors, ReadonlyArray<t.Validation<TR>>> {
    const partitionKey = searchKey.length === 1 ? searchKey[0] : searchKey[1];
    const byVersion = pipe(
      N.Ord,
      contramap((p: t.Validation<TR>) => (E.isLeft(p) ? -1 : p.right.version))
    );

    return pipe(
      TE.tryCatch(
        () =>
          asyncIterableToArray(
            this.getQueryIterator({
              parameters: [
                {
                  name: "@partitionKey",
                  value: partitionKey as JSONValue
                }
              ],
              query: `SELECT * FROM m WHERE m.${
                this.partitionKey ? this.partitionKey : this.modelIdKey
              } = @partitionKey`
            })
          ),
        toCosmosErrorResponse
      ),
      TE.map(RA.flatten),
      TE.map(RA.sortBy([byVersion]))
    );
  }

  /**
   * Batch operation. It only works with PatchOperationInput
   *
   * @param operations
   * @param partitionKey
   * @returns
   */
  private batch(
    operations: ReadonlyArray<PatchOperationInput>,
    partitionKey: TN[PartitionKey]
  ): TE.TaskEither<CosmosErrors, Response<BatchResult>> {
    return pipe(
      TE.tryCatch(
        () =>
          this.container.items.batch(RA.toArray(operations), `${partitionKey}`),
        toCosmosErrorResponse
      ),
      TE.chain(response =>
        pipe(
          response.result,
          BatchResult.decode,
          TE.fromEither,
          TE.mapLeft(error =>
            CosmosErrorResponse({
              message: errorsToReadableMessages(error).join(", "),
              name: `Error decoding batch result`
            })
          ),
          TE.map(batchResult => ({ ...response, result: batchResult }))
        )
      )
    );
  }
}
