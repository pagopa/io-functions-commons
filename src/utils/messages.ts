import * as t from "io-ts";

import winston = require("winston");

import { toError } from "fp-ts/lib/Either";
import { none, Option, some } from "fp-ts/lib/Option";
import * as O from "fp-ts/lib/Option";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import * as A from "fp-ts/lib/Array";

import { taskEither, TaskEither } from "fp-ts/lib/TaskEither";
import * as TE from "fp-ts/lib/TaskEither";

import { pipe } from "fp-ts/lib/function";
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
export const getChannelStatus = async (
  notificationStatusModel: NotificationStatusModel,
  notificationId: NonEmptyString,
  channel: NotificationChannelEnum
): Promise<NotificationChannelStatusValueEnum | undefined> => {
  const errorOrMaybeStatus = await notificationStatusModel.findOneNotificationStatusByNotificationChannel(
    notificationId,
    channel
  )();

  return pipe(
    O.fromEither(errorOrMaybeStatus),
    O.chain(t.identity),
    O.map(o => o.status),
    O.toUndefined
  );
};

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
export const getMessageNotificationStatuses = (
  notificationModel: NotificationModel,
  notificationStatusModel: NotificationStatusModel,
  messageId: NonEmptyString
): TaskEither<Error, Option<NotificationStatusHolder>> =>
  pipe(
    notificationModel.findNotificationForMessage(messageId),
    TE.mapLeft(error => {
      // temporary log COSMOS_ERROR_RESPONSE kind due to body unavailability
      winston.error(`getMessageNotificationStatuses|Query error|${error.kind}`);
      return new Error(`Error querying for NotificationStatus`);
    }),
    TE.chain(maybeNotification =>
      // It may happen that the notification object is not yet created in the database
      // due to some latency, so it's better to not fail here but return an empty object
      pipe(
        maybeNotification,
        O.fold(
          () => {
            winston.debug(
              `getMessageNotificationStatuses|Notification not found|messageId=${messageId}`
            );
            return TE.of<Error, Option<NotificationStatusHolder>>(none);
          },
          notification =>
            pipe(
              A.sequence(taskEither)(
                // collect the statuses of all channels
                Object.keys(NotificationChannelEnum)
                  .map(
                    k => NotificationChannelEnum[k as NotificationChannelEnum]
                  )
                  .map(channel =>
                    pipe(
                      TE.tryCatch(
                        () =>
                          getChannelStatus(
                            notificationStatusModel,
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                            notification.id as NonEmptyString,
                            channel
                          ),
                        toError
                      ),
                      TE.map(status => ({ channel, status }))
                    )
                  )
              ),
              TE.map(channelStatuses =>
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
              ),
              TE.map(response => some(response))
            )
        )
      )
    )
  );

/**
 * Converts a retrieved message to a message that can be shared via API
 */
export const retrievedMessageToPublic = (
  retrievedMessage: RetrievedMessage
): CreatedMessageWithoutContent => ({
  created_at: retrievedMessage.createdAt,
  fiscal_code: retrievedMessage.fiscalCode,
  id: retrievedMessage.id,
  sender_service_id: retrievedMessage.senderServiceId,
  time_to_live: retrievedMessage.timeToLiveSeconds
});
