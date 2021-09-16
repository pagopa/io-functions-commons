import * as t from "io-ts";

import { tag } from "@pagopa/ts-commons/lib/types";

import { Container } from "@azure/cosmos";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Option } from "fp-ts/lib/Option";
import { TaskEither } from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import {
  CosmosdbModelVersioned,
  RetrievedVersionedModel
} from "../utils/cosmosdb_model_versioned";
import {
  NotificationChannel,
  NotificationChannelEnum
} from "../../generated/definitions/NotificationChannel";
import {
  NotificationChannelStatusValue,
  NotificationChannelStatusValueEnum
} from "../../generated/definitions/NotificationChannelStatusValue";
import { Timestamp } from "../../generated/definitions/Timestamp";
import { CosmosErrors } from "../utils/cosmosdb_model";
import { wrapWithKind } from "../utils/types";

export const NOTIFICATION_STATUS_COLLECTION_NAME = "notification-status";
export const NOTIFICATION_STATUS_MODEL_ID_FIELD = "statusId" as const;
export const NOTIFICATION_STATUS_MODEL_PK_FIELD = "notificationId" as const;

interface INotificationStatusIdTag {
  readonly kind: "INotificationStatusIdTag";
}

export const NotificationStatusId = tag<INotificationStatusIdTag>()(t.string);
export type NotificationStatusId = t.TypeOf<typeof NotificationStatusId>;

// We cannot intersect with NotificationChannelStatus
// as it is a *strict* interface
export const NotificationStatus = t.interface({
  channel: NotificationChannel,
  messageId: NonEmptyString,
  notificationId: NonEmptyString,
  status: NotificationChannelStatusValue,
  // As we have one NotificationStatus for each channel
  // of a Notification => statusId = notificationId + channelName
  statusId: NotificationStatusId,
  updatedAt: Timestamp
});

export type NotificationStatus = t.TypeOf<typeof NotificationStatus>;

export const NewNotificationStatus = wrapWithKind(
  NotificationStatus,
  "INewNotificationStatus" as const
);

export type NewNotificationStatus = t.TypeOf<typeof NewNotificationStatus>;

export const RetrievedNotificationStatus = wrapWithKind(
  t.intersection([NotificationStatus, RetrievedVersionedModel]),
  "IRetrievedNotificationStatus" as const
);

export type RetrievedNotificationStatus = t.TypeOf<
  typeof RetrievedNotificationStatus
>;

export const makeStatusId = (
  notificationId: NonEmptyString,
  channel: NotificationChannel
): NotificationStatusId =>
  pipe(
    NotificationStatusId.decode(`${notificationId}:${channel}`),
    E.getOrElseW(() => {
      throw new Error("Invalid Notification Status id");
    })
  );

export type NotificationStatusUpdater = (
  status: NotificationChannelStatusValueEnum
) => TaskEither<CosmosErrors, RetrievedNotificationStatus>;

/**
 * Convenience method that returns a function to update the notification status
 * for the message / notification / channel passed as inputs.
 */
export const getNotificationStatusUpdater = (
  notificationStatusModel: NotificationStatusModel,
  channel: NotificationChannelEnum,
  messageId: NonEmptyString,
  notificationId: NonEmptyString
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
): NotificationStatusUpdater => status => {
  const statusId = makeStatusId(notificationId, channel);
  return notificationStatusModel.upsert({
    channel,
    kind: "INewNotificationStatus",
    messageId,
    notificationId,
    status,
    statusId,
    updatedAt: new Date()
  });
};

/**
 * A model for handling NotificationStatus
 */
export class NotificationStatusModel extends CosmosdbModelVersioned<
  NotificationStatus,
  NewNotificationStatus,
  RetrievedNotificationStatus,
  typeof NOTIFICATION_STATUS_MODEL_ID_FIELD,
  typeof NOTIFICATION_STATUS_MODEL_PK_FIELD
> {
  /**
   * Creates a new NotificationStatus model
   *
   * @param container the Cosmos container client
   */
  constructor(container: Container) {
    super(
      container,
      NewNotificationStatus,
      RetrievedNotificationStatus,
      NOTIFICATION_STATUS_MODEL_ID_FIELD,
      NOTIFICATION_STATUS_MODEL_PK_FIELD
    );
  }

  /**
   * Find the latest status for this notification channel.
   *
   * There is one notification for each channel and
   * one versioned status model for each notification.
   *
   * @param notificationId id of the notification
   * @param channel the notification channel (ie. email)
   */
  public findOneNotificationStatusByNotificationChannel(
    notificationId: NonEmptyString,
    channel: NotificationChannel
  ): TaskEither<CosmosErrors, Option<RetrievedNotificationStatus>> {
    const statusId = makeStatusId(notificationId, channel);
    return this.findLastVersionByModelId([statusId, notificationId]);
  }
}
