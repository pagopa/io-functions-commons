import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";

import { Container } from "@azure/cosmos";
import * as TE from "fp-ts/lib/TaskEither";
import * as O from "fp-ts/lib/Option";
import { withDefault } from "@pagopa/ts-commons/lib/types";
import { pipe } from "fp-ts/lib/function";
import {
  MessageStatusValue,
  MessageStatusValueEnum
} from "../../generated/definitions/MessageStatusValue";
import { Timestamp } from "../../generated/definitions/Timestamp";

import { CosmosErrors } from "../utils/cosmosdb_model";
import {
  CosmosdbModelVersioned,
  RetrievedVersionedModel
} from "../utils/cosmosdb_model_versioned";
import { wrapWithKind } from "../utils/types";

export const MESSAGE_STATUS_COLLECTION_NAME = "message-status";
export const MESSAGE_STATUS_MODEL_ID_FIELD = "messageId" as const;
export const MESSAGE_STATUS_MODEL_PK_FIELD = "messageId" as const;

// We cannot intersect with MessageStatus
// as it is a *strict* interface
export const MessageStatus = t.intersection([
  t.interface({
    messageId: NonEmptyString,
    status: MessageStatusValue,
    updatedAt: Timestamp,
    // eslint-disable-next-line sort-keys
    isRead: withDefault(t.boolean, false),
    // eslint-disable-next-line sort-keys
    isArchived: withDefault(t.boolean, false)
  }),
  t.partial({
    // fiscalCode is optional due to retro-compatibility
    fiscalCode: FiscalCode
  })
]);

export type MessageStatus = t.TypeOf<typeof MessageStatus>;

export const NewMessageStatus = wrapWithKind(
  MessageStatus,
  "INewMessageStatus" as const
);

export type NewMessageStatus = t.TypeOf<typeof NewMessageStatus>;

export const RetrievedMessageStatus = wrapWithKind(
  t.intersection([MessageStatus, RetrievedVersionedModel]),
  "IRetrievedMessageStatus" as const
);

export type RetrievedMessageStatus = t.TypeOf<typeof RetrievedMessageStatus>;

export type MessageStatusUpdater = (
  status: MessageStatusValueEnum
) => TE.TaskEither<CosmosErrors, RetrievedMessageStatus>;

/**
 * Convenience method that returns a function
 * to update the Message status.
 */
export const getMessageStatusUpdater = (
  messageStatusModel: MessageStatusModel,
  messageId: NonEmptyString,
  fiscalCode: FiscalCode
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
): MessageStatusUpdater => status =>
  pipe(
    messageStatusModel.findLastVersionByModelId([messageId]),
    TE.map(
      O.getOrElseW(() => ({
        fiscalCode,
        isArchived: false,
        isRead: false,
        messageId
      }))
    ),
    TE.chain(item =>
      messageStatusModel.upsert({
        ...item,
        kind: "INewMessageStatus",
        status,
        updatedAt: new Date()
      })
    )
  );

/**
 * A model for handling MessageStatus
 */
export class MessageStatusModel extends CosmosdbModelVersioned<
  MessageStatus,
  NewMessageStatus,
  RetrievedMessageStatus,
  typeof MESSAGE_STATUS_MODEL_ID_FIELD
> {
  constructor(container: Container) {
    super(
      container,
      NewMessageStatus,
      RetrievedMessageStatus,
      MESSAGE_STATUS_MODEL_ID_FIELD
    );
  }
}
