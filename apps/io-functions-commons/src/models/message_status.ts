import { Container } from "@azure/cosmos";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { withDefault } from "@pagopa/ts-commons/lib/types";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import * as t from "io-ts";

import {
  NotRejectedMessageStatusValue,
  NotRejectedMessageStatusValueEnum,
} from "../../generated/definitions/NotRejectedMessageStatusValue";
import {
  RejectedMessageStatusValue,
  RejectedMessageStatusValueEnum,
} from "../../generated/definitions/RejectedMessageStatusValue";
import {
  RejectionReason,
  RejectionReasonEnum,
} from "../../generated/definitions/RejectionReason";
import { Timestamp } from "../../generated/definitions/Timestamp";
import { CosmosErrors } from "../utils/cosmosdb_model";
import { Ttl } from "../utils/cosmosdb_model_ttl";
import {
  CosmosdbModelVersionedTTL,
  RetrievedVersionedModelTTL,
} from "../utils/cosmosdb_model_versioned_ttl";
import { wrapWithKind } from "../utils/types";

export const MESSAGE_STATUS_COLLECTION_NAME = "message-status";
export const MESSAGE_STATUS_MODEL_ID_FIELD = "messageId" as const;
export const MESSAGE_STATUS_MODEL_PK_FIELD = "messageId" as const;

type CommonMessageStatus = t.TypeOf<typeof CommonMessageStatus>;
export const CommonMessageStatus = t.intersection([
  t.interface({
    isArchived: withDefault(t.boolean, false),

    isRead: withDefault(t.boolean, false),
    messageId: NonEmptyString,
    updatedAt: Timestamp,
  }),
  t.partial({
    // fiscalCode is optional due to retro-compatibility
    fiscalCode: FiscalCode,
  }),
]);

type RejectedMessageStatus = t.TypeOf<typeof RejectedMessageStatus>;
const RejectedMessageStatus = t.intersection([
  CommonMessageStatus,
  t.interface({
    status: RejectedMessageStatusValue,
  }),
  t.partial({
    rejection_reason: withDefault(RejectionReason, RejectionReasonEnum.UNKNOWN),
  }),
]);

type NotRejectedMessageStatus = t.TypeOf<typeof NotRejectedMessageStatus>;
const NotRejectedMessageStatus = t.intersection([
  CommonMessageStatus,
  t.interface({
    status: NotRejectedMessageStatusValue,
  }),
]);

// We cannot intersect with MessageStatus
// as it is a *strict* interface
export const MessageStatus = t.union([
  RejectedMessageStatus,
  NotRejectedMessageStatus,
]);

export type MessageStatus = t.TypeOf<typeof MessageStatus>;

export const NewMessageStatus = wrapWithKind(
  MessageStatus,
  "INewMessageStatus" as const,
);

export type NewMessageStatus = t.TypeOf<typeof NewMessageStatus>;

export const RetrievedMessageStatus = wrapWithKind(
  t.intersection([MessageStatus, RetrievedVersionedModelTTL]),
  "IRetrievedMessageStatus" as const,
);

export type MessageStatusUpdate =
  | {
      readonly rejection_reason: RejectedMessageStatus["rejection_reason"];
      readonly status: RejectedMessageStatusValueEnum;
      readonly ttl?: Ttl;
    }
  | {
      readonly status: NotRejectedMessageStatusValueEnum;
    };

// --------------------------------------
// MessageStatusUpdater
// --------------------------------------

export type MessageStatusUpdater = (
  statusUpdate: MessageStatusUpdate,
) => TE.TaskEither<CosmosErrors, RetrievedMessageStatus>;

export type RetrievedMessageStatus = t.TypeOf<typeof RetrievedMessageStatus>;

/**
 * Convenience method that returns a function
 * to update the Message status.
 */
export const getMessageStatusUpdater =
  (
    messageStatusModel: MessageStatusModel,
    messageId: NonEmptyString,
    fiscalCode: FiscalCode,
  ): MessageStatusUpdater =>
  (statusUpdate) =>
    pipe(
      messageStatusModel.findLastVersionByModelId([messageId]),
      TE.map(
        O.getOrElseW(() => ({
          fiscalCode,
          isArchived: false,
          isRead: false,
          messageId,
        })),
      ),
      TE.chain((item) =>
        messageStatusModel.upsert({
          ...item,
          ...statusUpdate,
          kind: "INewMessageStatus",
          updatedAt: new Date(),
        }),
      ),
    );

/**
 * A model for handling MessageStatus
 */
export class MessageStatusModel extends CosmosdbModelVersionedTTL<
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
      MESSAGE_STATUS_MODEL_ID_FIELD,
    );
  }
}
