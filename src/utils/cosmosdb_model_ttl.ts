import { Container, ItemDefinition } from "@azure/cosmos";

import * as t from "io-ts";

import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import {
  AzureCosmosResource,
  BaseModel,
  CosmosdbModel
} from "./cosmosdb_model";

/**
  The purpose of this class is to isolate the `updateTTL` logic, 
  it should be used only for those models which does not generate a lot 
  of versions because the logic to update the ttl is quite expensive.
 
  NB: 
  if You have more than 100 versions the update operation could not be transactional, 
  see https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/transactional-batch?tabs=dotnet
 */

export const Ttl = t.union([NonNegativeInteger, t.literal(-1)]);
export type Ttl = t.TypeOf<typeof Ttl>;

// For basic models, the identity field is always the id of cosmos
export type BaseModelTTL = t.TypeOf<typeof BaseModelTTL>;
export const BaseModelTTL = t.intersection([
  BaseModel,
  t.partial({ ttl: Ttl })
]);

// An io-ts definition of Cosmos Resource runtime type
// IDs are enforced to be non-empty string, as we're sure they are always valued when coming from db.
export type CosmosResourceTTL = t.TypeOf<typeof CosmosResourceTTL>;
export const CosmosResourceTTL = t.intersection([
  BaseModelTTL,
  AzureCosmosResource
]);

export class CosmosdbModelTTL<
  T,
  TN extends Readonly<T & BaseModelTTL>,
  TR extends Readonly<T & CosmosResourceTTL>,
  ModelIdKey extends keyof T,
  PartitionKey extends keyof T = ModelIdKey
> extends CosmosdbModel<T, TN, TR, PartitionKey> {
  constructor(
    container: Container,
    protected readonly newItemT: t.Type<TN, ItemDefinition, unknown>,
    protected readonly retrievedItemT: t.Type<TR, unknown, unknown>,
    protected readonly partitionKey?: PartitionKey
  ) {
    super(container, newItemT, retrievedItemT);
  }
}
