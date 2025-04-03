// eslint-disable @typescript-eslint/no-explicit-any

import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";

import { NonNegativeNumber } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { Container } from "@azure/cosmos";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { NotificationChannelEnum } from "../../../generated/definitions/v2/NotificationChannel";
import { NotificationChannelStatusValueEnum } from "../../../generated/definitions/v2/NotificationChannelStatusValue";
import {
  NotificationStatus,
  NotificationStatusId,
  NotificationStatusModel,
  RetrievedNotificationStatus
} from "../notification_status";
import { pipe } from "fp-ts/lib/function";

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
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  ...aSerializedNotificationStatus,
  id: `${aNotificationStatusId}-${"0".repeat(16)}` as NonEmptyString,
  kind: "IRetrievedNotificationStatus",
  version: 0 as NonNegativeNumber
};

const aRetrievedNotificationStatus = pipe(
  RetrievedNotificationStatus.decode(aSerializedRetrievedNotificationStatus),
  E.getOrElseW(errs => {
    const error = readableReport(errs);
    throw new Error("Fix NotificationStatus mock: " + error);
  })
);

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

    const result = await model.findOneNotificationStatusByNotificationChannel(
      "A_NOTIFICATION_ID" as NonEmptyString,
      NotificationChannelEnum.EMAIL
    )();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBeTruthy();
      expect(O.toUndefined(result.right)).toEqual(aRetrievedNotificationStatus);
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

    const result = await model.findOneNotificationStatusByNotificationChannel(
      "A_NOTIFICATION_ID" as NonEmptyString,
      NotificationChannelEnum.EMAIL
    )();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isNone(result.right)).toBeTruthy();
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

    const result = await model.findOneNotificationStatusByNotificationChannel(
      "A_NOTIFICATION_ID" as NonEmptyString,
      NotificationChannelEnum.EMAIL
    )();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toBe("COSMOS_DECODING_ERROR");
    }
  });
});
