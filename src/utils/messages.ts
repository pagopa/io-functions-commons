import * as t from "io-ts";

import winston = require("winston");

import { Either, isRight, left, right } from "fp-ts/lib/Either";
import { fromEither, isNone, none, Option, some } from "fp-ts/lib/Option";

import { NonEmptyString } from "italia-ts-commons/lib/strings";

import { RetrievedMessage } from "../models/message";
import { NotificationModel } from "../models/notification";
import { NotificationStatusModel } from "../models/notification_status";

import { CreatedMessageWithoutContent } from "../../generated/definitions/CreatedMessageWithoutContent";
import { NotificationChannelEnum } from "../../generated/definitions/NotificationChannel";
import { NotificationChannelStatusValueEnum } from "../../generated/definitions/NotificationChannelStatusValue";

/**
 * Convenience structure to hold notification channels
 * and the status of the relative notification
 * ie. { email: "SENT" }
 */
export type NotificationStatusHolder = Partial<
  Record<NotificationChannelEnum, NotificationChannelStatusValueEnum>
>;

/**
 * Returns the status of a channel
 */
export async function getChannelStatus(
  notificationStatusModel: NotificationStatusModel,
  notificationId: NonEmptyString,
  channel: NotificationChannelEnum
): Promise<NotificationChannelStatusValueEnum | undefined> {
  const errorOrMaybeStatus = await notificationStatusModel.findOneNotificationStatusByNotificationChannel(
    notificationId,
    channel
  );
  return fromEither(errorOrMaybeStatus)
    .chain(t.identity)
    .map(o => o.status)
    .toUndefined();
}

/**
 * Retrieve all notifications statuses (all channels) for a message.
 *
 * It makes one query to get the notification object associated
 * to a message, then another query for each channel
 * to retrieve the relative notification status.
 *
 * @returns an object with channels as keys and statuses as values
 *          ie. { email: "SENT" }
 */
export async function getMessageNotificationStatuses(
  notificationModel: NotificationModel,
  notificationStatusModel: NotificationStatusModel,
  messageId: NonEmptyString
): Promise<Either<Error, Option<NotificationStatusHolder>>> {
  const errorOrMaybeNotification = await notificationModel.findNotificationForMessage(
    messageId
  );
  if (isRight(errorOrMaybeNotification)) {
    // It may happen that the notification object is not yet created in the database
    // due to some latency, so it's better to not fail here but return an empty object
    const maybeNotification = errorOrMaybeNotification.value;
    if (isNone(maybeNotification)) {
      winston.debug(
        `getMessageNotificationStatuses|Notification not found|messageId=${messageId}`
      );
      return right<Error, Option<NotificationStatusHolder>>(none);
    }
    const notification = maybeNotification.value;

    // collect the statuses of all channels
    const channelStatusesPromises = Object.keys(NotificationChannelEnum)
      .map(k => NotificationChannelEnum[k as NotificationChannelEnum])
      .map(async channel => ({
        channel,
        status: await getChannelStatus(
          notificationStatusModel,
          notification.id,
          channel
        )
      }));
    const channelStatuses = await Promise.all(channelStatusesPromises);

    // reduce the statuses in one response
    const response = channelStatuses.reduce<NotificationStatusHolder>(
      (a, s) =>
        s.status
          ? {
              ...a,
              [s.channel.toLowerCase()]: s.status
            }
          : a,
      {}
    );
    return right<Error, Option<NotificationStatusHolder>>(some(response));
  } else {
    winston.error(
      `getMessageNotificationStatuses|Query error|${errorOrMaybeNotification.value.body}`
    );
    return left<Error, Option<NotificationStatusHolder>>(
      new Error(`Error querying for NotificationStatus`)
    );
  }
}

/**
 * Converts a retrieved message to a message that can be shared via API
 */
export function retrievedMessageToPublic(
  retrievedMessage: RetrievedMessage
): CreatedMessageWithoutContent {
  return {
    created_at: retrievedMessage.createdAt,
    fiscal_code: retrievedMessage.fiscalCode,
    id: retrievedMessage.id,
    sender_service_id: retrievedMessage.senderServiceId
  };
}
