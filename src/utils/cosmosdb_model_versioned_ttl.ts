import {
  BaseModel,
  CosmosErrorResponse,
  CosmosErrors,
  DocumentSearchKey,
  toCosmosErrorResponse
} from "./cosmosdb_model";
import {
  CosmosdbModelVersioned,
  RetrievedVersionedModel
} from "./cosmosdb_model_versioned";
import {
  Container,
  ItemDefinition,
  JSONValue,
  PatchOperationType
} from "@azure/cosmos";

import * as t from "io-ts";
import * as TE from "fp-ts/lib/TaskEither";
import * as RA from "fp-ts/lib/ReadonlyArray";

import { NonNegativeNumber } from "@pagopa/ts-commons/lib/numbers";
import { pipe } from "fp-ts/lib/function";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { asyncIterableToArray } from "./async";

/**
  The purpose of this class is to isolate the `updateTTL` logic, 
  it should be used only for those models which does not generate a lot 
  of versions because the logic to update the ttl is quite expensive.

  NB: 
  if You have more than 100 versions the update operation could not be transactional, 
  see https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/transactional-batch?tabs=dotnet
*/

export class CosmosdbModelVersionedTTL<
  T,
  TN extends Readonly<T>,
  TR extends Readonly<T & RetrievedVersionedModel>,
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
    Using transactionalBatch updates the ttl field for all the versions of the document
    identified by the searchKey.
  */

  public updateTTLForAllVersions(
    searchKey: DocumentSearchKey<TR, ModelIdKey, PartitionKey>,
    ttl: NonNegativeNumber
    // eslint-disable-next-line
  ): TE.TaskEither<CosmosErrors, TE.TaskEither<never, readonly any[]>> {
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
                /**
                    add will replace the path with the passed value if the path alreadye exists,
                    otherwise it will add the path
                 */
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
        RA.map(x =>
          pipe(x, RA.toArray, operations =>
            super.batch(
              operations,
              `${
                searchKey.length === 1 ? searchKey[0] : searchKey[1]
              }` as NonEmptyString
            )
          )
        )
      ),
      TE.chainW(TE.sequenceSeqArray),
      TE.chainW(responses =>
        pipe(
          responses,
          RA.filter(response => response.code !== 200),
          TE.fromPredicate(
            errors => errors.length === 0,
            _ =>
              CosmosErrorResponse({
                message: `Error updating ttl for ${searchKey}`,
                name: `Error updating ttl`
              })
          ),
          TE.map(() => TE.right(responses))
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
      TE.map(RA.flatten)
    );
  }
}
