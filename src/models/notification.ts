/**
 * A Notification is a communication that gets sent to a user that received
 * a Message. A notification can be sent on multiple channels, based on the
 * User's preference.
 */
import { enumType } from "italia-ts-commons/lib/types";

import * as t from "io-ts";

import {
  BaseModel,
  CosmosdbModel,
  CosmosErrors
} from "../utils/cosmosdb_model";

import { EmailAddress } from "../../generated/definitions/EmailAddress";
import { FiscalCode } from "../../generated/definitions/FiscalCode";

import { Container } from "@azure/cosmos";
import { Option } from "fp-ts/lib/Option";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { HttpsUrl } from "../../generated/definitions/HttpsUrl";
import { NotificationChannelEnum } from "../../generated/definitions/NotificationChannel";
import { ObjectIdGenerator } from "../utils/strings";
import { wrapWithKind } from "../utils/types";

export const NOTIFICATION_COLLECTION_NAME = "notifications";
export const NOTIFICATION_MODEL_PK_FIELD = "messageId";

/**
 * All possible sources that can provide the address of the recipient.
 */
export enum NotificationAddressSourceEnum {
  // the notification address comes from the user profile
  PROFILE_ADDRESS = "PROFILE_ADDRESS",
  // the notification address was provided as default address by the sender
  DEFAULT_ADDRESS = "DEFAULT_ADDRESS",
  // the notification address was provided by the sending user email
  SERVICE_USER_ADDRESS = "SERVICE_USER_ADDRESS"
}

export const NotificationAddressSource = enumType<
  NotificationAddressSourceEnum
>(NotificationAddressSourceEnum, "NotificationAddressSource");

export type NotificationAddressSource = NotificationAddressSourceEnum;

/**
 * Base interface for Notification objects
 */
export const NotificationBase = t.interface({
  fiscalCode: FiscalCode,
  messageId: NonEmptyString
});

// Email Notification

export const NotificationChannelEmail = t.intersection([
  t.interface({
    addressSource: NotificationAddressSource,
    toAddress: EmailAddress
  }),
  t.partial({
    fromAddress: EmailAddress
  })
]);
export type NotificationChannelEmail = t.TypeOf<
  typeof NotificationChannelEmail
>;

export const EmailNotification = t.interface({
  ...NotificationBase.props,
  channels: t.interface({
    [NotificationChannelEnum.EMAIL]: NotificationChannelEmail
  })
});
export type EmailNotification = t.TypeOf<typeof EmailNotification>;

// Webhook Notification

export const NotificationChannelWebhook = t.interface({
  url: HttpsUrl
});
export type NotificationChannelWebhook = t.TypeOf<
  typeof NotificationChannelWebhook
>;

export const WebhookNotification = t.interface({
  ...NotificationBase.props,
  channels: t.interface({
    [NotificationChannelEnum.WEBHOOK]: NotificationChannelWebhook
  })
});
export type WebhookNotification = t.TypeOf<typeof WebhookNotification>;

// Generic Notification object

export const Notification = t.intersection([
  NotificationBase,
  t.interface({
    channels: t.exact(
      t.partial({
        [NotificationChannelEnum.EMAIL]: NotificationChannelEmail,
        [NotificationChannelEnum.WEBHOOK]: NotificationChannelWebhook
      })
    )
  })
]);
export type Notification = t.TypeOf<typeof Notification>;

export const NewNotification = wrapWithKind(
  t.intersection([Notification, BaseModel]),
  "INewNotification" as const
);

export type NewNotification = t.TypeOf<typeof NewNotification>;

/**
 * Factory method to make NewNotification objects
 */
export function createNewNotification(
  ulidGenerator: ObjectIdGenerator,
  fiscalCode: FiscalCode,
  messageId: NonEmptyString
): NewNotification {
  return {
    channels: {},
    fiscalCode,
    id: ulidGenerator(),
    kind: "INewNotification",
    messageId
  };
}

export const RetrievedNotification = wrapWithKind(
  t.intersection([Notification, BaseModel]),
  "IRetrievedNotification" as const
);

export type RetrievedNotification = t.TypeOf<typeof RetrievedNotification>;

/* istanbul ignore next */

/**
 * A model for handling Notifications
 */
export class NotificationModel extends CosmosdbModel<
  Notification,
  NewNotification,
  RetrievedNotification
> {
  /**
   * Creates a new Notification model
   *
   * @param container the Cosmos container client
   */
  constructor(container: Container) {
    super(container, NewNotification, RetrievedNotification);
  }

  /**
   * Returns the Notification object associated to the provided message.
   *
   * @param messageId The Id of the message
   */
  /* istanbul ignore next */
  public findNotificationForMessage(
    messageId: string
  ): TaskEither<CosmosErrors, Option<RetrievedNotification>> {
    return this.findOneByQuery({
      parameters: [
        {
          name: "@messageId",
          value: messageId
        }
      ],
      query: `SELECT * FROM n WHERE (n.${NOTIFICATION_MODEL_PK_FIELD} = @messageId)`
    });
  }
}
