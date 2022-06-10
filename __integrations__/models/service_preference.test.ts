/* eslint-disable no-console */
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import {
  ServicePreference,
  SERVICE_PREFERENCES_MODEL_PK_FIELD,
  SERVICE_PREFERENCES_COLLECTION_NAME,
  ServicesPreferencesModel,
  NewServicePreference,
  AccessReadMessageStatusEnum
} from "../../src/models/service_preference";
import { createContext } from "./cosmos_utils";
import { pipe } from "fp-ts/lib/function";
import { DocumentSearchKey } from "../../src/utils/cosmosdb_model";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { withoutUndefinedValues } from "@pagopa/ts-commons/lib/types";

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const aServiceId = "aServiceId" as NonEmptyString;

const aServicePreference: ServicePreference = pipe(
  ServicePreference.decode({
    fiscalCode: aFiscalCode,
    serviceId: aServiceId,
    accessReadMessageStatus: AccessReadMessageStatusEnum.ALLOW,
    isEmailEnabled: true,
    isInboxEnabled: true,
    settingsVersion: 0 as NonNegativeInteger,
    isWebhookEnabled: true
  }),
  E.getOrElseW(() => {
    throw new Error("Cannot decode service payload.");
  })
);

describe("Models |> ServicePreference", () => {
  it("should save and retrieve valid documents", async () => {
    const context = createContext(SERVICE_PREFERENCES_MODEL_PK_FIELD);
    await context.init();
    const model = new ServicesPreferencesModel(
      context.container,
      SERVICE_PREFERENCES_COLLECTION_NAME
    );

    const newDoc = {
      kind: "INewServicePreference" as const,
      ...aServicePreference
    } as NewServicePreference;

    // create a new document
    const created = await pipe(
      model.create(newDoc),
      TE.bimap(
        _ => fail(`Failed to create doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aServicePreference
            })
          );
          return result;
        }
      ),
      TE.toUnion
    )();

    // upsert document changing accessReadMessageStatus
    await pipe(
      model.upsert({
        ...created,
        kind: "INewServicePreference",
        accessReadMessageStatus: AccessReadMessageStatusEnum.DENY,
      }),
      TE.bimap(
        _ => fail(`Failed to update doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aServicePreference,
              accessReadMessageStatus: AccessReadMessageStatusEnum.DENY
            })
          );
        }
      )
    )();

    // get document by id
    const documentSearchKey = [
      created.id,
      created[SERVICE_PREFERENCES_MODEL_PK_FIELD]
    ] as DocumentSearchKey<ServicePreference, "id", "fiscalCode">;
    await pipe(
      model.find(documentSearchKey),
      TE.chainW(maybeServicePreference =>
        TE.fromOption(() => "It's none")(maybeServicePreference)
      ),
      TE.bimap(
        _ => fail(`Failed to read doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aServicePreference,
              accessReadMessageStatus: AccessReadMessageStatusEnum.DENY
            })
          );
        }
      )
    )();

    context.dispose();
  });

  it("should read documents with a default accessReadMessageStatus when not present", async () => {
    const context = createContext(SERVICE_PREFERENCES_MODEL_PK_FIELD);
    await context.init();
    const model = new ServicesPreferencesModel(
      context.container,
      SERVICE_PREFERENCES_COLLECTION_NAME
    );

    const {
      accessReadMessageStatus,
      ...aServicePreferenceWithoutAccessReadMessageStatus
    } = aServicePreference;

    const partialDocumentToSave = {
      ...aServicePreferenceWithoutAccessReadMessageStatus,
      id: "aServicePreferenceDocumentId"
    };

    // create a new document
    const createTestServicePreferenceDoc = await pipe(
      TE.tryCatch(
        () =>
          context.container.items.create(
            withoutUndefinedValues(partialDocumentToSave),
            { disableAutomaticIdGeneration: true }
          ),
        E.toError
      )
    )();

    // get document by id
    const documentSearchKey = [
      partialDocumentToSave.id,
      partialDocumentToSave[SERVICE_PREFERENCES_MODEL_PK_FIELD]
    ] as DocumentSearchKey<ServicePreference, "id", "fiscalCode">;
    await pipe(
      model.find(documentSearchKey),
      TE.chainW(maybeServicePreference =>
        TE.fromOption(() => "It's none")(maybeServicePreference)
      ),
      TE.bimap(
        _ => fail(`Failed to read doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aServicePreference,
              accessReadMessageStatus: AccessReadMessageStatusEnum.UNKNOWN
            })
          );
        }
      )
    )();

    context.dispose();
  });

  it("should fail to save not valid documents", async () => {
    const context = createContext(SERVICE_PREFERENCES_MODEL_PK_FIELD);
    await context.init();
    const model = new ServicesPreferencesModel(
      context.container,
      SERVICE_PREFERENCES_COLLECTION_NAME
    );

    // @ts-ignore to force bad behaviour
    const newDoc = {
      kind: "INewServicePreference" as const,
      ...aServicePreference,
      fiscalCode: undefined
    } as NewServicePreference;

    // create a new document
    const created = await pipe(
      model.create(newDoc),
      TE.bimap(
        error => {
          expect(error).toBeTruthy();
          expect(error.kind).toEqual("COSMOS_DECODING_ERROR");
        },
        result => fail(`Created invalid doc, error: ${JSON.stringify(result)}`)
      ),
      TE.toUnion
    )();

    context.dispose();
  });
});
