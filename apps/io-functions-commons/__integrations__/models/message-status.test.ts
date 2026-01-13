import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";

import { NotRejectedMessageStatusValueEnum } from "../../generated/definitions/NotRejectedMessageStatusValue";
import { RejectedMessageStatusValueEnum } from "../../generated/definitions/RejectedMessageStatusValue";
import { RejectionReasonEnum } from "../../generated/definitions/RejectionReason";
import {
  getMessageStatusUpdater,
  MESSAGE_STATUS_MODEL_PK_FIELD,
  MessageStatusModel,
} from "../../src/models/message_status";
import {
  CosmosErrors,
  toCosmosErrorResponse,
} from "../../src/utils/cosmosdb_model";
import { Ttl } from "../../src/utils/cosmosdb_model_ttl";
import { createContext } from "./cosmos_utils";

const aMessageId = "A_MESSAGE_ID" as NonEmptyString;
const aFiscalCode = "RLDBSV36A78Y792X" as FiscalCode;
const aMessageStatus = {
  fiscalCode: aFiscalCode,
  status: NotRejectedMessageStatusValueEnum.ACCEPTED,
  updatedAt: new Date(),
  version: 0 as NonNegativeInteger,
};

const messageStatusListLength = 1;
export const oldMessageStatusList = Array.from(
  { length: messageStatusListLength },
  (_, i) => ({
    ...aMessageStatus,
    id: `${aMessageId}_${i}-${"0".repeat(16)}` as NonEmptyString,
    messageId: `${aMessageId}_${i}` as NonEmptyString,
  }),
);

describe("Models |> Message-Status", () => {
  it("should retrieve message-status with default isRead and isArchived when not present", async () => {
    const context = await createContext(MESSAGE_STATUS_MODEL_PK_FIELD);
    await context.init();
    const model = new MessageStatusModel(context.container);

    await pipe(
      oldMessageStatusList,
      RA.map((ms) =>
        TE.tryCatch<CosmosErrors, any>(
          () =>
            context.container.items.create(ms, {
              disableAutomaticIdGeneration: true,
            }),
          toCosmosErrorResponse,
        ),
      ),
      RA.sequence(TE.ApplicativePar),
      TE.mapLeft((err) => fail(`Cannot insert items ${err}`)),
    )();

    const retrievedValue = await pipe(
      model.findLastVersionByModelId([oldMessageStatusList[0].messageId]),
      TE.map(O.getOrElseW(() => fail("MessageStatus not found"))),
      TE.getOrElse(() => fail("Cosmos error")),
    )();

    expect(retrievedValue).toMatchObject({
      ...oldMessageStatusList[0],
      isArchived: false,
      isRead: false,
    });

    context.dispose();
  });

  it("should read a message-status with isRead and isArchived, when present", async () => {
    const context = await createContext(MESSAGE_STATUS_MODEL_PK_FIELD);
    await context.init();
    const model = new MessageStatusModel(context.container);

    await pipe(
      oldMessageStatusList,
      RA.map((ms) =>
        TE.tryCatch<CosmosErrors, any>(
          () =>
            context.container.items.create(
              { ...ms, isArchived: true, isRead: true },
              {
                disableAutomaticIdGeneration: true,
              },
            ),
          toCosmosErrorResponse,
        ),
      ),
      RA.sequence(TE.ApplicativePar),
      TE.mapLeft((err) => fail(`Cannot insert items ${err}`)),
    )();

    const retrievedValue = await pipe(
      model.findLastVersionByModelId([oldMessageStatusList[0].messageId]),
      TE.map(O.getOrElseW(() => fail("MessageStatus not found"))),
      TE.getOrElse(() => fail("Cosmos error")),
    )();

    expect(retrievedValue).toMatchObject({
      ...oldMessageStatusList[0],
      isArchived: true,
      isRead: true,
    });

    context.dispose();
  });

  it("should read a REJECTED message-status with UNKNOWN rejection_reason, when not defined", async () => {
    const context = await createContext(MESSAGE_STATUS_MODEL_PK_FIELD);
    await context.init();
    const model = new MessageStatusModel(context.container);

    await pipe(
      oldMessageStatusList,
      RA.map((ms) =>
        TE.tryCatch<CosmosErrors, any>(
          () =>
            context.container.items.create(
              { ...ms, status: RejectedMessageStatusValueEnum.REJECTED },
              {
                disableAutomaticIdGeneration: true,
              },
            ),
          toCosmosErrorResponse,
        ),
      ),
      RA.sequence(TE.ApplicativePar),
      TE.mapLeft((err) => fail(`Cannot insert items ${err}`)),
    )();

    const retrievedValue = await pipe(
      model.findLastVersionByModelId([oldMessageStatusList[0].messageId]),
      TE.map(O.getOrElseW(() => fail("MessageStatus not found"))),
      TE.getOrElse(() => fail("Cosmos error")),
    )();

    expect(retrievedValue).toMatchObject({
      ...oldMessageStatusList[0],
      rejection_reason: RejectionReasonEnum.UNKNOWN,
      status: RejectedMessageStatusValueEnum.REJECTED,
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
      aFiscalCode,
    );
    const result = await updater({
      status: NotRejectedMessageStatusValueEnum.ACCEPTED,
    })();

    expect(E.isRight(result)).toBe(true);

    if (E.isRight(result)) {
      expect(result.right).toMatchObject({
        id: `${anotherMessageId}-${"0".repeat(16)}` as NonEmptyString,
        isArchived: false,
        isRead: false,
        messageId: anotherMessageId,
        version: 0,
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
      aFiscalCode,
    );
    const result = await updater({
      rejection_reason: RejectionReasonEnum.USER_NOT_FOUND,
      status: RejectedMessageStatusValueEnum.REJECTED,
    })();

    expect(E.isRight(result)).toBe(true);

    if (E.isRight(result)) {
      expect(result.right).toMatchObject({
        id: `${anotherMessageId}-${"0".repeat(16)}` as NonEmptyString,
        isArchived: false,
        isRead: false,
        messageId: anotherMessageId,
        rejection_reason: RejectionReasonEnum.USER_NOT_FOUND,
        status: RejectedMessageStatusValueEnum.REJECTED,
        version: 0,
      });
    }

    context.dispose();
  });

  it("should create a REJECTED message-status using getMessageStatusUpdater with ttl", async () => {
    const context = createContext(MESSAGE_STATUS_MODEL_PK_FIELD);
    await context.init();
    const model = new MessageStatusModel(context.container);

    const anotherMessageId = "ANOTHER_MESSAGE_ID" as NonEmptyString;

    const updater = getMessageStatusUpdater(
      model,
      anotherMessageId,
      aFiscalCode,
    );
    const result = await updater({
      rejection_reason: RejectionReasonEnum.USER_NOT_FOUND,
      status: RejectedMessageStatusValueEnum.REJECTED,
      ttl: 200 as Ttl,
    })();

    expect(E.isRight(result)).toBe(true);

    if (E.isRight(result)) {
      expect(result.right).toMatchObject({
        id: `${anotherMessageId}-${"0".repeat(16)}` as NonEmptyString,
        isArchived: false,
        isRead: false,
        messageId: anotherMessageId,
        rejection_reason: RejectionReasonEnum.USER_NOT_FOUND,
        status: RejectedMessageStatusValueEnum.REJECTED,
        ttl: 200,
        version: 0,
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
      aFiscalCode,
    );

    //First, create the "Accepted" status
    await updater({ status: NotRejectedMessageStatusValueEnum.ACCEPTED })();
    // Then upsert with "Processed" status
    const result = await updater({
      status: NotRejectedMessageStatusValueEnum.PROCESSED,
    })();

    expect(E.isRight(result)).toBe(true);

    if (E.isRight(result)) {
      expect(result.right).toMatchObject({
        id: `${anotherMessageId}-${"0".repeat(15)}1` as NonEmptyString,
        isArchived: false,
        isRead: false,
        messageId: anotherMessageId,
        version: 1,
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
      aFiscalCode,
    );

    //First, create the "Accepted" status
    const accepted = await updater({
      status: NotRejectedMessageStatusValueEnum.ACCEPTED,
    })();

    expect(E.isRight(accepted)).toBe(true);
    if (E.isRight(accepted)) {
      await model.upsert({
        ...accepted.right,
        isArchived: true,
        isRead: true,
        kind: "INewMessageStatus",
      })();

      const retrievedValue = await pipe(
        model.findLastVersionByModelId([anotherMessageId]),
        TE.map(O.getOrElseW(() => fail("MessageStatus not found"))),
        TE.getOrElse(() => fail("Cosmos error")),
      )();

      expect(retrievedValue).toMatchObject({
        id: `${anotherMessageId}-${"0".repeat(15)}1`,
        isArchived: true,
        isRead: true,
        messageId: anotherMessageId,
        version: 1,
      });
    }

    context.dispose();
  });
});
