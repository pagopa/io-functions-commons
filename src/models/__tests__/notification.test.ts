// eslint-disable @typescript-eslint/no-explicit-any

import { isLeft, isRight } from "fp-ts/lib/Either";

import { FiscalCode } from "../../../generated/definitions/FiscalCode";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { Container } from "@azure/cosmos";
import { EmailAddress } from "../../../generated/definitions/EmailAddress";
import { NotificationChannelEnum } from "../../../generated/definitions/NotificationChannel";
import {
  NewNotification,
  NotificationAddressSourceEnum,
  NotificationModel,
  RetrievedNotification
} from "../notification";

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const aMessageId = "A_MESSAGE_ID" as NonEmptyString;

const aNewEmailNotification: NewNotification = {
  channels: {
    [NotificationChannelEnum.EMAIL]: {
      addressSource: NotificationAddressSourceEnum.DEFAULT_ADDRESS,
      toAddress: "to@example.com" as EmailAddress
    }
  },
  fiscalCode: aFiscalCode,
  id: "A_NOTIFICATION_ID" as NonEmptyString,
  kind: "INewNotification",
  messageId: aMessageId
};

const aRetrievedNotification: RetrievedNotification = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  ...aNewEmailNotification,
  kind: "IRetrievedNotification"
};

describe("findNotificationByMessage", () => {
  it("should return an existing notification by messageId", async () => {
    const containerMock = ({
      items: {
        create: jest.fn(),
        query: jest.fn(_ => ({
          fetchAll: jest.fn(() =>
            Promise.resolve({
              resources: [aRetrievedNotification]
            })
          )
        }))
      }
    } as unknown) as Container;

    const model = new NotificationModel(containerMock);

    const result = await model
      .findNotificationForMessage(aRetrievedNotification.messageId)
      .run();

    expect(containerMock.items.query).toHaveBeenCalledTimes(1);
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(aRetrievedNotification);
    }
  });

  it("should resolve to empty if no notification is found", async () => {
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

    const model = new NotificationModel(containerMock);

    const result = await model
      .findNotificationForMessage(aRetrievedNotification.messageId)
      .run();

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isNone()).toBeTruthy();
    }
  });

  it("should return the error", async () => {
    const containerMock = ({
      items: {
        create: jest.fn(),
        query: jest.fn(_ => ({
          fetchAll: jest.fn().mockRejectedValueOnce({ code: 500 })
        }))
      }
    } as unknown) as Container;

    const model = new NotificationModel(containerMock);

    const result = await model
      .findNotificationForMessage(aRetrievedNotification.messageId)
      .run();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toEqual("COSMOS_ERROR_RESPONSE");
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

    const model = new NotificationModel(containerMock);

    const result = await model
      .findNotificationForMessage(aRetrievedNotification.messageId)
      .run();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toBe("COSMOS_DECODING_ERROR");
    }
  });
});
