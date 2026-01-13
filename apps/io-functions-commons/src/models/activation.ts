import { Container } from "@azure/cosmos";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";

import { ActivationStatus } from "../../generated/definitions/ActivationStatus";
import { CosmosdbModelComposedVersioned } from "../utils/cosmosdb_model_composed_versioned";
import { RetrievedVersionedModel } from "../utils/cosmosdb_model_versioned";
import { wrapWithKind } from "../utils/types";
import { PROFILE_MODEL_PK_FIELD } from "./profile";
import { SERVICE_MODEL_ID_FIELD } from "./service";

export const ACTIVATION_COLLECTION_NAME = "activations";
export const ACTIVATION_REFERENCE_ID_FIELD = SERVICE_MODEL_ID_FIELD;
export const ACTIVATION_MODEL_PK_FIELD = PROFILE_MODEL_PK_FIELD;

const ActivationR = t.interface({
  fiscalCode: FiscalCode,
  serviceId: NonEmptyString,
  status: ActivationStatus,
});

const ActivationO = t.partial({});

export type Activation = t.TypeOf<typeof Activation>;
export const Activation = t.intersection(
  [ActivationR, ActivationO],
  "Activation",
);

export type NewActivation = t.TypeOf<typeof NewActivation>;
export const NewActivation = wrapWithKind(
  Activation,
  "INewActivation" as const,
);

export const RetrievedActivation = wrapWithKind(
  t.intersection([Activation, RetrievedVersionedModel]),
  "IRetrievedActivation" as const,
);

export type RetrievedActivation = t.TypeOf<typeof RetrievedActivation>;

export class ActivationModel extends CosmosdbModelComposedVersioned<
  Activation,
  NewActivation,
  RetrievedActivation,
  typeof ACTIVATION_REFERENCE_ID_FIELD,
  typeof ACTIVATION_MODEL_PK_FIELD
> {
  /**
   * Creates a new Activation model
   *
   * @param container the Cosmos container client
   */
  constructor(container: Container) {
    super(
      container,
      NewActivation,
      RetrievedActivation,
      ACTIVATION_REFERENCE_ID_FIELD,
      ACTIVATION_MODEL_PK_FIELD,
    );
  }
}
