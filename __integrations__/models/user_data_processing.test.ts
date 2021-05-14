/* eslint-disable no-console */
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { fromEither, taskEither } from "fp-ts/lib/TaskEither";
import { UserDataProcessingChoiceEnum } from "../../generated/definitions/UserDataProcessingChoice";
import { UserDataProcessingStatusEnum } from "../../generated/definitions/UserDataProcessingStatus";
import {
  makeUserDataProcessingId,
  USER_DATA_PROCESSING_MODEL_ID_FIELD,
  USER_DATA_PROCESSING_MODEL_PK_FIELD,
  UserDataProcessing,
  UserDataProcessingModel
} from "../../src/models/user_data_processing";
import { createContext } from "./cosmos_utils";
import { fromOption } from "fp-ts/lib/Either";
import { toString } from "fp-ts/lib/function";
import { INonNegativeIntegerTag } from "@pagopa/ts-commons/lib/numbers";

const aUserDataProcessing: UserDataProcessing = UserDataProcessing.decode({
  choice: UserDataProcessingChoiceEnum.DOWNLOAD,
  createdAt: new Date(),
  fiscalCode: `RLDBSV36A78Y792X` as FiscalCode,
  status: UserDataProcessingStatusEnum.PENDING,
  userDataProcessingId: makeUserDataProcessingId(
    UserDataProcessingChoiceEnum.DOWNLOAD,
    `RLDBSV36A78Y792X` as FiscalCode
  )
}).getOrElseL(() => {
  throw new Error("Cannot decode userdataprocessing payload.");
});

describe("Models |> UserDataProcessing", () => {
  it("should save documents with correct versioning", async () => {
    const context = await createContext(USER_DATA_PROCESSING_MODEL_PK_FIELD);
    await context.init();
    const model = new UserDataProcessingModel(context.container);

    const newDoc = {
      kind: "INewUserDataProcessing" as const,
      ...aUserDataProcessing
    };

    // create a new document
    const created = await model
      .create(newDoc)
      .fold(
        _ => fail(`Failed to create doc, error: ${toString(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aUserDataProcessing,
              version: 0
            })
          );
          return result;
        }
      )
      .run();

    // update document
    const updates = { status: UserDataProcessingStatusEnum.WIP };
    await model
      .update({ ...created, ...updates })
      .fold(
        _ => fail(`Failed to update doc, error: ${toString(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aUserDataProcessing,
              ...updates,
              version: 1
            })
          );
        }
      )
      .run();

    // read latest version of the document
    await taskEither
      .of<any, void>(void 0)
      .chain(_ =>
        model.findLastVersionByModelId([
          newDoc[USER_DATA_PROCESSING_MODEL_ID_FIELD],
          newDoc[USER_DATA_PROCESSING_MODEL_PK_FIELD]
        ])
      )
      .chain(_ => fromEither(fromOption("It's none")(_)))
      .fold(
        _ => fail(`Failed to read doc, error: ${toString(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aUserDataProcessing,
              ...updates,
              version: 1
            })
          );
        }
      )
      .run();

    // upsert new version
    const upserts = { status: UserDataProcessingStatusEnum.CLOSED };
    const toUpsert = {
      kind: "INewUserDataProcessing" as const,
      ...aUserDataProcessing,
      ...upserts
    };
    await model
      .upsert(toUpsert)
      .fold(
        _ => fail(`Failed to upsert doc, error: ${toString(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aUserDataProcessing,
              ...upserts,
              version: 2
            })
          );
        }
      )
      .run();

    // createOrUpdateByNewOne
    await model
      .createOrUpdateByNewOne(aUserDataProcessing)
      .fold(
        _ => fail(`Failed to upsert doc, error: ${toString(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aUserDataProcessing,
              version: 3
            })
          );
        }
      )
      .run();

    context.dispose();
  });
});
