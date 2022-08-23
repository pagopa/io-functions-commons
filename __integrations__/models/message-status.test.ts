/* eslint-disable no-console */
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";

import {
  getMessageStatusUpdater,
  MessageStatusModel,
  MESSAGE_STATUS_MODEL_PK_FIELD
} from "../../src/models/message_status";
import { createContext } from "./cosmos_utils";
import {
  CosmosErrors,
  toCosmosErrorResponse
} from "../../src/utils/cosmosdb_model";
import { NotRejectedMessageStatusValueEnum } from "../../generated/definitions/NotRejectedMessageStatusValue";
import { pipe } from "fp-ts/lib/function";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { RejectedMessageStatusValueEnum } from "../../generated/definitions/RejectedMessageStatusValue";
import { RejectionReasonEnum } from "../../generated/definitions/RejectionReason";

const aMessageId = "A_MESSAGE_ID" as NonEmptyString;
const aFiscalCode = "RLDBSV36A78Y792X" as FiscalCode;
const aMessageStatus = {
  status: NotRejectedMessageStatusValueEnum.ACCEPTED,
  version: 0 as NonNegativeInteger,
  updatedAt: new Date(),
  fiscalCode: aFiscalCode
};

const messageStatusListLength = 1;
export const oldMessageStatusList = Array.from(
  { length: messageStatusListLength },
  (_, i) => ({
    ...aMessageStatus,
    id: `${aMessageId}_${i}-${"0".repeat(16)}` as NonEmptyString,
    messageId: `${aMessageId}_${i}` as NonEmptyString
  })
);

describe("Models |> Message-Status", () => {
  it("should retrieve message-status with default isRead and isArchived when not present", async () => {
    const context = await createContext(MESSAGE_STATUS_MODEL_PK_FIELD);
    await context.init();
    const model = new MessageStatusModel(context.container);

    await pipe(
      oldMessageStatusList,
      RA.map(ms =>
        TE.tryCatch<CosmosErrors, any>(
          () =>
            context.container.items.create(ms, {
              disableAutomaticIdGeneration: true
            }),
          toCosmosErrorResponse
        )
      ),
      RA.sequence(TE.ApplicativePar),
      TE.mapLeft(err => fail(`Cannot insert items ${err}`))
    )();

    const retrievedValue = await pipe(
      model.findLastVersionByModelId([oldMessageStatusList[0].messageId]),
      TE.map(O.getOrElseW(() => fail("MessageStatus not found"))),
      TE.getOrElse(() => fail("Cosmos error"))
    )();

    expect(retrievedValue).toMatchObject({
      ...oldMessageStatusList[0],
      isRead: false,
      isArchived: false
    });

    context.dispose();
  });

  it("should read a message-status with isRead and isArchived, when present", async () => {
    const context = await createContext(MESSAGE_STATUS_MODEL_PK_FIELD);
    await context.init();
    const model = new MessageStatusModel(context.container);

    await pipe(
      oldMessageStatusList,
      RA.map(ms =>
        TE.tryCatch<CosmosErrors, any>(
          () =>
            context.container.items.create(
              { ...ms, isRead: true, isArchived: true },
              {
                disableAutomaticIdGeneration: true
              }
            ),
          toCosmosErrorResponse
        )
      ),
      RA.sequence(TE.ApplicativePar),
      TE.mapLeft(err => fail(`Cannot insert items ${err}`))
    )();

    const retrievedValue = await pipe(
      model.findLastVersionByModelId([oldMessageStatusList[0].messageId]),
      TE.map(O.getOrElseW(() => fail("MessageStatus not found"))),
      TE.getOrElse(() => fail("Cosmos error"))
    )();

    expect(retrievedValue).toMatchObject({
      ...oldMessageStatusList[0],
      isRead: true,
      isArchived: true
    });

    context.dispose();
  });

  it("should read a REJECTED message-status with UNKNOWN rejection_reason, when not defined", async () => {
    const context = await createContext(MESSAGE_STATUS_MODEL_PK_FIELD);
    await context.init();
    const model = new MessageStatusModel(context.container);

    await pipe(
      oldMessageStatusList,
      RA.map(ms =>
        TE.tryCatch<CosmosErrors, any>(
          () =>
            context.container.items.create(
              { ...ms, status: RejectedMessageStatusValueEnum.REJECTED },
              {
                disableAutomaticIdGeneration: true
              }
            ),
          toCosmosErrorResponse
        )
      ),
      RA.sequence(TE.ApplicativePar),
      TE.mapLeft(err => fail(`Cannot insert items ${err}`))
    )();

    const retrievedValue = await pipe(
      model.findLastVersionByModelId([oldMessageStatusList[0].messageId]),
      TE.map(O.getOrElseW(() => fail("MessageStatus not found"))),
      TE.getOrElse(() => fail("Cosmos error"))
    )();

    expect(retrievedValue).toMatchObject({
      ...oldMessageStatusList[0],
      status: RejectedMessageStatusValueEnum.REJECTED,
      rejection_reason: RejectionReasonEnum.UNKNOWN
    });

    context.dispose();
  });

  it("should create a message-status using getMessageStatusUpdater", async () => {
    const context = await createContext(MESSAGE_STATUS_MODEL_PK_FIELD);
    await context.init();
    const model = new MessageStatusModel(context.container);

    const anotherMessageId = "ANOTHER_MESSAGE_ID" as NonEmptyString;

    const updater = getMessageStatusUpdater(
      model,
      anotherMessageId,
      aFiscalCode
    );
    const result = await updater({
      status: NotRejectedMessageStatusValueEnum.ACCEPTED
    })();

    expect(E.isRight(result)).toBe(true);

    if (E.isRight(result)) {
      expect(result.right).toMatchObject({
        messageId: anotherMessageId,
        id: `${anotherMessageId}-${"0".repeat(16)}` as NonEmptyString,
        version: 0,
        isRead: false,
        isArchived: false
      });
    }

    context.dispose();
  });

  it("should create a REJECTED message-status using getMessageStatusUpdater", async () => {
    const context = await createContext(MESSAGE_STATUS_MODEL_PK_FIELD);
    await context.init();
    const model = new MessageStatusModel(context.container);

    const anotherMessageId = "ANOTHER_MESSAGE_ID" as NonEmptyString;

    const updater = getMessageStatusUpdater(
      model,
      anotherMessageId,
      aFiscalCode
    );
    const result = await updater({
      status: RejectedMessageStatusValueEnum.REJECTED,
      rejection_reason: RejectionReasonEnum.USER_NOT_FOUND
    })();

    expect(E.isRight(result)).toBe(true);

    if (E.isRight(result)) {
      expect(result.right).toMatchObject({
        messageId: anotherMessageId,
        id: `${anotherMessageId}-${"0".repeat(16)}` as NonEmptyString,
        status: RejectedMessageStatusValueEnum.REJECTED,
        rejection_reason: RejectionReasonEnum.USER_NOT_FOUND,
        version: 0,
        isRead: false,
        isArchived: false
      });
    }

    context.dispose();
  });

  it("should upsert a message-status using getMessageStatusUpdater", async () => {
    const context = await createContext(MESSAGE_STATUS_MODEL_PK_FIELD);
    await context.init();
    const model = new MessageStatusModel(context.container);

    const anotherMessageId = "ANOTHER_MESSAGE_ID" as NonEmptyString;

    const updater = getMessageStatusUpdater(
      model,
      anotherMessageId,
      aFiscalCode
    );

    //First, create the "Accepted" status
    await updater({ status: NotRejectedMessageStatusValueEnum.ACCEPTED })();
    // Then upsert with "Processed" status
    const result = await updater({
      status: NotRejectedMessageStatusValueEnum.PROCESSED
    })();

    expect(E.isRight(result)).toBe(true);

    if (E.isRight(result)) {
      expect(result.right).toMatchObject({
        messageId: anotherMessageId,
        id: `${anotherMessageId}-${"0".repeat(15)}1` as NonEmptyString,
        version: 1,
        isRead: false,
        isArchived: false
      });
    }

    context.dispose();
  });

  it("should upsert a message-status with isRead and isArchived", async () => {
    const context = await createContext(MESSAGE_STATUS_MODEL_PK_FIELD);
    await context.init();
    const model = new MessageStatusModel(context.container);

    const anotherMessageId = "ANOTHER_MESSAGE_ID" as NonEmptyString;

    const updater = getMessageStatusUpdater(
      model,
      anotherMessageId,
      aFiscalCode
    );

    //First, create the "Accepted" status
    const accepted = await updater({
      status: NotRejectedMessageStatusValueEnum.ACCEPTED
    })();

    expect(E.isRight(accepted)).toBe(true);
    if (E.isRight(accepted)) {
      await model.upsert({
        ...accepted.right,
        isRead: true,
        isArchived: true,
        kind: "INewMessageStatus"
      })();

      const retrievedValue = await pipe(
        model.findLastVersionByModelId([anotherMessageId]),
        TE.map(O.getOrElseW(() => fail("MessageStatus not found"))),
        TE.getOrElse(() => fail("Cosmos error"))
      )();

      expect(retrievedValue).toMatchObject({
        messageId: anotherMessageId,
        id: `${anotherMessageId}-${"0".repeat(15)}1`,
        version: 1,
        isRead: true,
        isArchived: true
      });
    }

    context.dispose();
  });
});
