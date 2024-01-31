import * as t from "io-ts";

import { Container } from "@azure/cosmos";
import {
  CosmosdbModelVersioned,
  RetrievedVersionedModel
} from "../utils/cosmosdb_model_versioned";
import { RCConfigurationBase } from "../../generated/definitions/RCConfigurationBase";
import { RCConfigurationEnvironment } from "../../generated/definitions/RCConfigurationEnvironment";

export const RC_CONFIGURATION_COLLECTION_NAME = "remote-content-configuration";

const RC_CONFIGURATION_MODEL_PK_FIELD = "configurationId";

export type RCConfiguration = t.TypeOf<typeof RCConfiguration>;
export const RCConfiguration = t.intersection([
  RCConfigurationBase,
  RCConfigurationEnvironment
]);

export const RetrievedRCConfiguration = t.intersection([
  RCConfiguration,
  RetrievedVersionedModel
]);
export type RetrievedRCConfiguration = t.TypeOf<
  typeof RetrievedRCConfiguration
>;

export class RCConfigurationModel extends CosmosdbModelVersioned<
  RCConfiguration,
  RCConfiguration,
  RetrievedRCConfiguration,
  typeof RC_CONFIGURATION_MODEL_PK_FIELD
> {
  constructor(container: Container) {
    super(
      container,
      RCConfiguration,
      RetrievedRCConfiguration,
      RC_CONFIGURATION_MODEL_PK_FIELD
    );
  }
}
