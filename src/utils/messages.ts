import * as t from "io-ts";

import winston = require("winston");

import { toError } from "fp-ts/lib/Either";
import { fromEither, none, Option, some } from "fp-ts/lib/Option";

import { NonEmptyString } from "italia-ts-commons/lib/strings";

import { RetrievedMessage } from "../models/message";
import { NotificationModel } from "../models/notification";
import { NotificationStatusModel } from "../models/notification_status";

import { array } from "fp-ts/lib/Array";
import { taskEither, TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
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
  const errorOrMaybeStatus = await notificationStatusModel
    .findOneNotificationStatusByNotificationChannel(notificationId, channel)
    .run();
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
export function getMessageNotificationStatuses(
  notificationModel: NotificationModel,
  notificationStatusModel: NotificationStatusModel,
  messageId: NonEmptyString
): TaskEither<Error, Option<NotificationStatusHolder>> {
  return notificationModel
    .findNotificationForMessage(messageId)
    .mapLeft(error => {
      // temporary log COSMOS_ERROR_RESPONSE kind due to body unavailability
      winston.error(`getMessageNotificationStatuses|Query error|${error.kind}`);
      return new Error(`Error querying for NotificationStatus`);
    })
    .chain(maybeNotification => {
      // It may happen that the notification object is not yet created in the database
      // due to some latency, so it's better to not fail here but return an empty object
      return maybeNotification.foldL(
        () => {
          winston.debug(
            `getMessageNotificationStatuses|Notification not found|messageId=${messageId}`
          );
          return taskEither.of<Error, Option<NotificationStatusHolder>>(none);
        },
        notification => {
          return array
            .sequence(taskEither)(
              // collect the statuses of all channels
              Object.keys(NotificationChannelEnum)
                .map(k => NotificationChannelEnum[k as NotificationChannelEnum])
                .map(channel =>
                  tryCatch(
                    () =>
                      getChannelStatus(
                        notificationStatusModel,
                        // tslint:disable-next-line: no-useless-cast
                        notification.id as NonEmptyString,
                        channel
                      ),
                    toError
                  ).map(status => ({ channel, status }))
                )
            )
            .map(channelStatuses =>
              // reduce the statuses in one response
              channelStatuses.reduce<NotificationStatusHolder>(
                (a, s) =>
                  s.status
                    ? {
                        ...a,
                        [s.channel.toLowerCase()]: s.status
                      }
                    : a,
                {}
              )
            )
            .map(response => some(response));
        }
      );
    });
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
