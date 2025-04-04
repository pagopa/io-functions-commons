import { pipe } from "fp-ts/lib/function";
import {
  Activation,
  ActivationModel,
  ACTIVATION_MODEL_PK_FIELD,
  ACTIVATION_REFERENCE_ID_FIELD
} from "../../src/models/activation";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { ActivationStatusEnum } from "../../generated/definitions/v2/ActivationStatus";
import { createContext } from "./cosmos_utils";
import { generateComposedVersionedModelId } from "../../src/utils/cosmosdb_model_composed_versioned";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";

const anActivation: Activation = pipe(
  Activation.decode({
    fiscalCode: "AAAAAA00A00A000A",
    serviceId: "a-service-id",
    status: ActivationStatusEnum.ACTIVE
  }),
  E.getOrElseW(() => {
    throw new Error("Cannot decode profile payload.");
  })
);

describe("Models |> Profile", () => {
  it("should save documents with correct versioning", async () => {
    const context = await createContext(ACTIVATION_MODEL_PK_FIELD);
    await context.init();
    const model = new ActivationModel(context.container);

    const newDoc = {
      kind: "INewActivation" as const,
      ...anActivation
    };

    // create a new document
    const created = await pipe(
      model.create(newDoc),
      TE.bimap(
        _ => fail(`Failed to create doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...anActivation,
              version: 0,
              id: generateComposedVersionedModelId<
                Activation,
                typeof ACTIVATION_REFERENCE_ID_FIELD,
                typeof ACTIVATION_MODEL_PK_FIELD
              >(
                anActivation.serviceId,
                anActivation.fiscalCode,
                0 as NonNegativeInteger
              )
            })
          );
          return result;
        }
      ),
      TE.toUnion
    )();

    // update document
    const updates = { status: ActivationStatusEnum.INACTIVE };
    await pipe(
      model.update({ ...created, ...updates }),
      TE.bimap(
        _ => fail(`Failed to update doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...anActivation,
              ...updates,
              version: 1,
              id: generateComposedVersionedModelId<
                Activation,
                typeof ACTIVATION_REFERENCE_ID_FIELD,
                typeof ACTIVATION_MODEL_PK_FIELD
              >(
                anActivation.serviceId,
                anActivation.fiscalCode,
                1 as NonNegativeInteger
              )
            })
          );
        }
      ),
      TE.toUnion
    )();

    // read latest version of the document
    await pipe(
      model.findLastVersionByModelId([
        newDoc[ACTIVATION_REFERENCE_ID_FIELD],
        newDoc[ACTIVATION_MODEL_PK_FIELD]
      ]),
      TE.chainW(_ => TE.fromOption(() => "It's none")(_)),
      TE.bimap(
        _ => fail(`Failed to read doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...anActivation,
              ...updates,
              version: 1,
              id: generateComposedVersionedModelId<
                Activation,
                typeof ACTIVATION_REFERENCE_ID_FIELD,
                typeof ACTIVATION_MODEL_PK_FIELD
              >(
                anActivation.serviceId,
                anActivation.fiscalCode,
                1 as NonNegativeInteger
              )
            })
          );
        }
      )
    )();

    // upsert new version
    const upserts = {
      email: ActivationStatusEnum.ACTIVE
    };
    const toUpsert = {
      kind: "INewActivation" as const,
      ...anActivation,
      ...upserts
    };
    await pipe(
      model.upsert(toUpsert),
      TE.bimap(
        _ => fail(`Failed to upsert doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...anActivation,
              ...upserts,
              version: 2,
              id: generateComposedVersionedModelId<
                Activation,
                typeof ACTIVATION_REFERENCE_ID_FIELD,
                typeof ACTIVATION_MODEL_PK_FIELD
              >(
                anActivation.serviceId,
                anActivation.fiscalCode,
                2 as NonNegativeInteger
              )
            })
          );
        }
      )
    )();

    context.dispose();
  });
});
