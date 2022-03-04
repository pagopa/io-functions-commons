/* eslint-disable no-console */
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import * as TE from "fp-ts/TaskEither";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";

import {
  MessageStatusModel,
  MESSAGE_STATUS_MODEL_PK_FIELD
} from "../../src/models/message_status";
import { createContext } from "./cosmos_utils";
import {
  CosmosErrors,
  toCosmosErrorResponse
} from "../../src/utils/cosmosdb_model";
import { MessageStatusValueEnum } from "../../generated/definitions/MessageStatusValue";
import { pipe } from "fp-ts/lib/function";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";

const aMessageId = "A_MESSAGE_ID" as NonEmptyString;
const aMessageStatus = {
  status: MessageStatusValueEnum.ACCEPTED,
  version: 0 as NonNegativeInteger,
  updatedAt: new Date()
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
  it("should retrieve message-status with isRead and isArchived", async () => {
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
});
