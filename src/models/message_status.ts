import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";

import { Container } from "@azure/cosmos";
import * as TE from "fp-ts/lib/TaskEither";
import * as O from "fp-ts/lib/Option";
import { withDefault } from "@pagopa/ts-commons/lib/types";
import { pipe } from "fp-ts/lib/function";
import {
  RejectedMessageStatusValue,
  RejectedMessageStatusValueEnum
} from "../../generated/definitions/RejectedMessageStatusValue";
import {
  NotRejectedMessageStatusValue,
  NotRejectedMessageStatusValueEnum
} from "../../generated/definitions/NotRejectedMessageStatusValue";
import {
  RejectionReason,
  RejectionReasonEnum
} from "../../generated/definitions/RejectionReason";
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

export const CommonMessageStatus = t.intersection([
  t.interface({
    messageId: NonEmptyString,
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

const RejectedMessageStatus = t.intersection([
  CommonMessageStatus,
  t.interface({
    status: RejectedMessageStatusValue
  }),
  t.partial({
    rejection_reason: withDefault(RejectionReason, RejectionReasonEnum.UNKNOWN)
  })
]);

const NotRejectedMessageStatus = t.intersection([
  CommonMessageStatus,
  t.interface({
    status: NotRejectedMessageStatusValue
  })
]);

// We cannot intersect with MessageStatus
// as it is a *strict* interface
export const MessageStatus = t.union([
  RejectedMessageStatus,
  NotRejectedMessageStatus
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

// --------------------------------------
// MessageStatusUpdater
// --------------------------------------

export type MessageStatusUpdater = (
  statusUpdate:
    | {
        readonly status: NotRejectedMessageStatusValueEnum;
      }
    | {
        readonly rejection_reason: t.TypeOf<
          typeof RejectedMessageStatus
        >["rejection_reason"];
        readonly status: RejectedMessageStatusValueEnum;
      }
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
): MessageStatusUpdater => statusUpdate =>
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
        ...statusUpdate,
        kind: "INewMessageStatus",
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
