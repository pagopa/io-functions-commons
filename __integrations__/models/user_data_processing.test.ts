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
import { INonNegativeIntegerTag } from "@pagopa/ts-commons/lib/numbers";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";

const aUserDataProcessing: UserDataProcessing = pipe(
  UserDataProcessing.decode({
    choice: UserDataProcessingChoiceEnum.DOWNLOAD,
    createdAt: new Date(),
    fiscalCode: `RLDBSV36A78Y792X` as FiscalCode,
    status: UserDataProcessingStatusEnum.PENDING,
    userDataProcessingId: makeUserDataProcessingId(
      UserDataProcessingChoiceEnum.DOWNLOAD,
      `RLDBSV36A78Y792X` as FiscalCode
    )
  }),
  E.getOrElseW(() => {
    throw new Error("Cannot decode userdataprocessing payload.");
  })
);

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
    const created = await pipe(
      model.create(newDoc),
      TE.bimap(
        _ => fail(`Failed to create doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aUserDataProcessing,
              version: 0
            })
          );
          return result;
        }
      ),
      TE.toUnion
    )();

    // update document
    const updates = { status: UserDataProcessingStatusEnum.WIP };
    await pipe(
      model.update({ ...created, ...updates }),
      TE.bimap(
        _ => fail(`Failed to update doc, error: ${JSON.stringify(_)}`),
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
    )();

    // read latest version of the document
    await pipe(
      taskEither.of<any, void>(void 0),
      TE.chainW(_ =>
        model.findLastVersionByModelId([
          newDoc[USER_DATA_PROCESSING_MODEL_ID_FIELD],
          newDoc[USER_DATA_PROCESSING_MODEL_PK_FIELD]
        ])
      ),
      TE.chain(_ => fromEither(fromOption(() => "It's none")(_))),
      TE.bimap(
        _ => fail(`Failed to read doc, error: ${JSON.stringify(_)}`),
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
    )();

    // upsert new version
    const upserts = { status: UserDataProcessingStatusEnum.CLOSED };
    const toUpsert = {
      kind: "INewUserDataProcessing" as const,
      ...aUserDataProcessing,
      ...upserts
    };
    await pipe(
      model.upsert(toUpsert),
      TE.bimap(
        _ => fail(`Failed to upsert doc, error: ${JSON.stringify(_)}`),
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
    )();

    // createOrUpdateByNewOne
    await pipe(
      model.createOrUpdateByNewOne(aUserDataProcessing),
      TE.bimap(
        _ => fail(`Failed to upsert doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aUserDataProcessing,
              version: 3
            })
          );
        }
      )
    )();

    context.dispose();
  });

  it("should save reason only for FAILED docs", async () => {
    const context = await createContext(USER_DATA_PROCESSING_MODEL_PK_FIELD);
    await context.init();
    const model = new UserDataProcessingModel(context.container);

    const newDoc = {
      kind: "INewUserDataProcessing" as const,
      ...aUserDataProcessing,
      status: UserDataProcessingStatusEnum.WIP,
      reason: "should not be saved" as NonEmptyString
    };

    // create a new document
    const created = await pipe(
      model.create(newDoc),
      TE.bimap(
        _ => fail(`Failed to create doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aUserDataProcessing,
              status: UserDataProcessingStatusEnum.WIP,
              version: 0
            })
          );
          expect(result.reason).not.toBeDefined();
          return result;
        }
      ),
      TE.toUnion
    )();

    // update document
    const updates = {
      status: UserDataProcessingStatusEnum.ABORTED,
      reason: "should not be saved" as NonEmptyString
    };
    await pipe(
      model.update({ ...created, ...updates }),
      TE.bimap(
        _ => fail(`Failed to update doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aUserDataProcessing,
              status: UserDataProcessingStatusEnum.ABORTED
            })
          );
          expect(result.reason).not.toBeDefined();
        }
      )
    )();

    // update document with FAILED
    const updatesToFailed = {
      status: UserDataProcessingStatusEnum.FAILED,
      reason: "should be saved" as NonEmptyString
    };
    await pipe(
      model.update({
        ...created,
        ...updatesToFailed,
        version: (created.version + 1) as number & INonNegativeIntegerTag
      }),
      TE.bimap(
        _ => fail(`Failed to update doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aUserDataProcessing,
              status: UserDataProcessingStatusEnum.FAILED,
              reason: "should be saved"
            })
          );
        }
      )
    )();

    // upsert should not have reason
    const toUpsert = {
      kind: "INewUserDataProcessing" as const,
      ...aUserDataProcessing
    };
    await pipe(
      model.upsert(toUpsert),
      TE.bimap(
        _ => fail(`Failed to upsert doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aUserDataProcessing
            })
          );
          expect(result.reason).not.toBeDefined();
        }
      )
    )();

    context.dispose();
  });
});
