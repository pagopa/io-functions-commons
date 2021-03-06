// eslint-disable @typescript-eslint/no-explicit-any

import { isLeft, isRight } from "fp-ts/lib/Either";
import { NonNegativeNumber } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { Container } from "@azure/cosmos";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { MessageStatusValueEnum } from "../../../generated/definitions/MessageStatusValue";
import { MessageStatusModel, RetrievedMessageStatus } from "../message_status";

const aMessageId = "A_MESSAGE_ID" as NonEmptyString;

const aSerializedMessageStatus = {
  messageId: aMessageId,
  status: MessageStatusValueEnum.ACCEPTED,
  updatedAt: new Date().toISOString()
};

const aSerializedRetrievedMessageStatus = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  ...aSerializedMessageStatus,
  id: `${aMessageId}-${"0".repeat(16)}` as NonEmptyString,
  kind: "IRetrievedMessageStatus",
  version: 0 as NonNegativeNumber
};

const aRetrievedMessageStatus = RetrievedMessageStatus.decode(
  aSerializedRetrievedMessageStatus
).getOrElseL(errs => {
  const error = readableReport(errs);
  throw new Error("Fix MessageStatus mock: " + error);
});

describe("findOneMessageStatusById", () => {
  it("should return an existing message status", async () => {
    const containerMock = ({
      items: {
        create: jest.fn(),
        query: jest.fn(() => ({
          fetchAll: jest.fn(() =>
            Promise.resolve({
              resources: [aRetrievedMessageStatus]
            })
          )
        }))
      }
    } as unknown) as Container;

    const model = new MessageStatusModel(containerMock);

    const result = await model.findLastVersionByModelId([aMessageId]).run();

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(aRetrievedMessageStatus);
    }
  });

  it("should resolve to an empty value if no message status is found", async () => {
    const containerMock = ({
      items: {
        create: jest.fn(),
        query: jest.fn(() => ({
          fetchAll: jest.fn(() =>
            Promise.resolve({
              resources: undefined
            })
          )
        }))
      }
    } as unknown) as Container;

    const model = new MessageStatusModel(containerMock);

    const result = await model.findLastVersionByModelId([aMessageId]).run();

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isNone()).toBeTruthy();
    }
  });

  it("should validate the retrieved object agains the model type", async () => {
    const containerMock = ({
      items: {
        create: jest.fn(),
        query: jest.fn(() => ({
          fetchAll: jest.fn(() =>
            Promise.resolve({
              resources: [{}]
            })
          )
        }))
      }
    } as unknown) as Container;

    const model = new MessageStatusModel(containerMock);

    const result = await model.findLastVersionByModelId([aMessageId]).run();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toBe("COSMOS_DECODING_ERROR");
    }
  });
});
