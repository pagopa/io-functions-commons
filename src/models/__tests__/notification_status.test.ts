// tslint:disable:no-any

import { isLeft, isRight } from "fp-ts/lib/Either";

import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

import { Container } from "@azure/cosmos";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { NotificationChannelEnum } from "../../../generated/definitions/NotificationChannel";
import { NotificationChannelStatusValueEnum } from "../../../generated/definitions/NotificationChannelStatusValue";
import {
  NotificationStatus,
  NotificationStatusId,
  NotificationStatusModel,
  RetrievedNotificationStatus
} from "../notification_status";

afterEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
});

const aNotificationStatusId = "A_NOTIFICATION_ID:EMAIL" as NotificationStatusId;

const aSerializedNotificationStatus = {
  channel: NotificationChannelEnum.EMAIL,
  messageId: "A_MESSAGE_ID" as NonEmptyString,
  notificationId: "A_NOTIFICATION_ID" as NonEmptyString,
  status: NotificationChannelStatusValueEnum.SENT,
  statusId: aNotificationStatusId,
  updatedAt: new Date().toISOString()
};

const aSerializedRetrievedNotificationStatus = {
  _self: "_self",
  _ts: 1,
  ...aSerializedNotificationStatus,
  id: `${aNotificationStatusId}-${"0".repeat(16)}` as NonEmptyString,
  kind: "IRetrievedNotificationStatus",
  version: 0 as NonNegativeNumber
};

const aRetrievedNotificationStatus = RetrievedNotificationStatus.decode(
  aSerializedRetrievedNotificationStatus
).getOrElseL(errs => {
  const error = readableReport(errs);
  throw new Error("Fix NotificationStatus mock: " + error);
});

describe("findOneNotificationStatusByNotificationChannel", () => {
  it("should return a NotificationStatus by notification channel", async () => {
    const containerMock = ({
      items: {
        create: jest.fn(),
        query: jest.fn(() => ({
          fetchAll: jest.fn(() =>
            Promise.resolve({
              resources: [aRetrievedNotificationStatus]
            })
          )
        }))
      }
    } as unknown) as Container;

    const model = new NotificationStatusModel(containerMock);

    const result = await model
      .findOneNotificationStatusByNotificationChannel(
        "A_NOTIFICATION_ID" as NonEmptyString,
        NotificationChannelEnum.EMAIL
      )
      .run();

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(aRetrievedNotificationStatus);
    }
  });

  it("should resolve to an empty value if no NotificationStatus is found", async () => {
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

    const model = new NotificationStatusModel(containerMock);

    const result = await model
      .findOneNotificationStatusByNotificationChannel(
        "A_NOTIFICATION_ID" as NonEmptyString,
        NotificationChannelEnum.EMAIL
      )
      .run();

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

    const model = new NotificationStatusModel(containerMock);

    const result = await model
      .findOneNotificationStatusByNotificationChannel(
        "A_NOTIFICATION_ID" as NonEmptyString,
        NotificationChannelEnum.EMAIL
      )
      .run();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toBe("COSMOS_DECODING_ERROR");
    }
  });
});
