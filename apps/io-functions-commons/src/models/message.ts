import {
  Container,
  FeedOptions,
  FeedResponse,
  SqlQuerySpec,
} from "@azure/cosmos";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { BlobService } from "azure-storage";
import * as J from "fp-ts/Json";
import * as E from "fp-ts/lib/Either";
import { flow, pipe } from "fp-ts/lib/function";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import * as t from "io-ts";

import { FeatureLevelType } from "../../generated/definitions/FeatureLevelType";
import { FiscalCode } from "../../generated/definitions/FiscalCode";
import { MessageContent } from "../../generated/definitions/MessageContent";
import { NewMessageContent } from "../../generated/definitions/NewMessageContent";
import { ServiceId } from "../../generated/definitions/ServiceId";
import { Timestamp } from "../../generated/definitions/Timestamp";
import { TimeToLiveSeconds } from "../../generated/definitions/TimeToLiveSeconds";
import {
  GenericCode,
  getBlobAsTextWithError,
  upsertBlobFromObject,
} from "../utils/azure_storage";
import { BlobNotFoundCode } from "../utils/azure_storage";
import {
  BaseModel,
  CosmosDecodingError,
  CosmosErrors,
  CosmosResource,
  toCosmosErrorResponse,
} from "../utils/cosmosdb_model";
import { CosmosdbModelTTL } from "../utils/cosmosdb_model_ttl";
import { wrapWithKind } from "../utils/types";

export const MESSAGE_COLLECTION_NAME = "messages";
export const MESSAGE_MODEL_PK_FIELD = "fiscalCode" as const;

const MESSAGE_BLOB_STORAGE_SUFFIX = ".json";

const MessageBaseR = t.interface({
  // when the message was accepted by the system
  createdAt: Timestamp,

  // the featureType level
  featureLevelType: FeatureLevelType,

  // the fiscal code of the recipient
  fiscalCode: FiscalCode,

  // needed to order by id or to make range queries (ie. WHERE id > "string")
  // see https://stackoverflow.com/questions/48710600/azure-cosmosdb-how-to-order-by-id
  indexedId: NonEmptyString,

  // the identifier of the service of the sender
  senderServiceId: ServiceId,

  // the userId of the sender (this is opaque and depends on the API gateway)
  senderUserId: NonEmptyString,

  // time to live in seconds
  timeToLiveSeconds: TimeToLiveSeconds,
});

const MessageBaseO = t.partial({
  // When true, the message is still being processed and should be
  // hidden from the result of getMessages requests. This is needed to avoid
  // cases where getMessages returns messages without content - i.e. messages
  // that didn't pass the checks done by created_message_queue_handler before
  // storing the message content.
  isPending: t.boolean,
});

const MessageBase = t.intersection([MessageBaseR, MessageBaseO], "MessageBase");

/**
 * A Message without content.
 *
 * A Message gets stored without content if the recipient didn't opt-in
 * to have the content of the messages permanently stored in his inbox.
 */
export type MessageWithoutContent = MessageBase;

/**
 * The attributes common to all types of Message
 */
type MessageBase = t.TypeOf<typeof MessageBase>;
export const MessageWithoutContent = MessageBase;

/**
 * A Message with content
 *
 * A Message gets stored with content if the recipient opted-in
 * to have the content of the messages permanently stored in his inbox.
 */
export const MessageWithContent = t.intersection([
  t.interface({
    content: MessageContent,
  }),
  MessageBase,
]);

export type MessageWithContent = t.TypeOf<typeof MessageWithContent>;

/**
 * A Message can be with our without content
 */
export const Message = t.union([MessageWithoutContent, MessageWithContent]);

export type Message = t.TypeOf<typeof Message>;

export const NewMessageWithContent = wrapWithKind(
  t.exact(
    t.intersection([
      t.interface({
        content: NewMessageContent,
      }),
      MessageBase,
      BaseModel,
    ]),
  ),
  "INewMessageWithContent" as const,
);

export type NewMessageWithContent = t.TypeOf<typeof NewMessageWithContent>;

export const NewMessageWithoutContent = wrapWithKind(
  t.intersection([MessageWithoutContent, BaseModel]),
  "INewMessageWithoutContent" as const,
);

export type NewMessageWithoutContent = t.TypeOf<
  typeof NewMessageWithoutContent
>;

/**
 * A (yet to be saved) Message
 */
export const NewMessage = t.union([
  NewMessageWithContent,
  NewMessageWithoutContent,
]);

export type NewMessage = t.TypeOf<typeof NewMessage>;

export const RetrievedMessageWithContent = wrapWithKind(
  t.intersection([MessageWithContent, CosmosResource]),
  "IRetrievedMessageWithContent" as const,
);

export type RetrievedMessageWithContent = t.TypeOf<
  typeof RetrievedMessageWithContent
>;

export const RetrievedMessageWithoutContent = wrapWithKind(
  t.intersection([MessageWithoutContent, CosmosResource]),
  "IRetrievedMessageWithoutContent" as const,
);

export type RetrievedMessageWithoutContent = t.TypeOf<
  typeof RetrievedMessageWithoutContent
>;

export const ActiveMessage = t.refinement(
  MessageBase,
  (message) =>
    Date.now() - message.createdAt.getTime() <=
    message.timeToLiveSeconds * 1000,
  "NotExpiredMessage",
);

export type NotExpiredMessage = t.TypeOf<typeof ActiveMessage>;

/**
 * A (previously saved) retrieved Message
 */
export const RetrievedMessage = t.union([
  RetrievedMessageWithContent,
  RetrievedMessageWithoutContent,
]);

export type RetrievedMessage = t.TypeOf<typeof RetrievedMessage>;

const blobIdFromMessageId = (messageId: string): string =>
  `${messageId}${MESSAGE_BLOB_STORAGE_SUFFIX}`;

/**
 * This is the default page size for cosmos queries
 */
export const defaultPageSize = 100 as NonNegativeInteger;

/**
 * A model for handling Messages
 */
export class MessageModel extends CosmosdbModelTTL<
  Message,
  NewMessage,
  RetrievedMessage,
  typeof MESSAGE_MODEL_PK_FIELD
> {
  /**
   * Creates a new Message model
   *
   * @param container the Cosmos container client
   */
  constructor(
    container: Container,
    protected readonly containerName: NonEmptyString,
  ) {
    super(container, NewMessage, RetrievedMessage);
  }

  /**
   * @deprecated use getQueryIterator + asyncIterableToArray
   */
  public findAllByQuery(
    query: SqlQuerySpec | string,
    options?: FeedOptions,
  ): TE.TaskEither<
    CosmosErrors,
    Option<readonly RetrievedMessageWithoutContent[]>
  > {
    return pipe(
      TE.tryCatch<
        CosmosErrors,
        FeedResponse<readonly RetrievedMessageWithoutContent[]>
      >(
        () =>
          this.container.items

            .query<readonly RetrievedMessageWithoutContent[]>(query, options)
            .fetchAll(),
        toCosmosErrorResponse,
      ),
      TE.map((_) => fromNullable(_.resources)),
      TE.chain((_) =>
        O.isSome(_)
          ? pipe(
              TE.fromEither(
                E.sequenceArray(
                  _.value.map(RetrievedMessageWithoutContent.decode),
                ),
              ),
              TE.map(some),
              TE.mapLeft(CosmosDecodingError),
            )
          : TE.fromEither(E.right(none)),
      ),
    );
  }

  /**
   * Returns the message for the provided fiscal code and message ID
   *
   * @param fiscalCode The fiscal code of the recipient
   * @param messageId The ID of the message
   */
  public findMessageForRecipient(
    fiscalCode: FiscalCode,
    messageId: NonEmptyString,
  ): TE.TaskEither<CosmosErrors, Option<RetrievedMessage>> {
    return pipe(
      this.find([messageId, fiscalCode]),
      TE.map((maybeMessage) =>
        pipe(
          maybeMessage,
          O.filter((m) => m.fiscalCode === fiscalCode),
        ),
      ),
    );
  }

  /**
   * Returns the messages for the provided fiscal code, with id based pagination capabilities
   *
   * @param fiscalCode The fiscal code of the recipient
   * @param pageSize The requested pageSize
   * @param maximumMessageId The message ID that can be used to filter next messages (older)
   * @param minimumMessageId The message ID that can be used to filter previous messages (newest)
   */
  public findMessages(
    fiscalCode: FiscalCode,
    pageSize = defaultPageSize,
    maximumMessageId?: NonEmptyString,
    minimumMessageId?: NonEmptyString,
  ): TE.TaskEither<
    CosmosErrors,
    AsyncIterator<
      readonly t.Validation<RetrievedMessage>[],
      readonly t.Validation<RetrievedMessage>[]
    >
  > {
    const commonQuerySpec = {
      parameters: [
        {
          name: "@fiscalCode",
          value: fiscalCode,
        },
      ],
      query: `SELECT * FROM m WHERE m.${MESSAGE_MODEL_PK_FIELD} = @fiscalCode`,
    };
    const emptyMessageParameter = {
      condition: "",
      param: [],
    };
    return pipe(
      TE.of({
        nextMessagesParams: pipe(
          fromNullable(maximumMessageId),
          O.foldW(
            () => emptyMessageParameter,
            (maximumId) => ({
              condition: ` AND m.id < @maxId`,
              param: [{ name: "@maxId", value: maximumId }],
            }),
          ),
        ),
        prevMessagesParams: pipe(
          fromNullable(minimumMessageId),
          O.foldW(
            () => emptyMessageParameter,
            (minimumId) => ({
              condition: ` AND m.id > @minId`,
              param: [{ name: "@minId", value: minimumId }],
            }),
          ),
        ),
      }),
      TE.mapLeft(toCosmosErrorResponse),
      TE.map(({ nextMessagesParams, prevMessagesParams }) => ({
        parameters: [
          ...commonQuerySpec.parameters,
          ...nextMessagesParams.param,
          ...prevMessagesParams.param,
        ],
        query: `${commonQuerySpec.query}${nextMessagesParams.condition}${prevMessagesParams.condition} ORDER BY m.${MESSAGE_MODEL_PK_FIELD}, m.id DESC`,
      })),
      TE.chain((querySpec) =>
        TE.fromEither(
          E.tryCatch(
            () =>
              this.getQueryIterator(querySpec, {
                maxItemCount: pageSize,
              })[Symbol.asyncIterator](),
            toCosmosErrorResponse,
          ),
        ),
      ),
    );
  }

  /**
   * Retrieve the message content from a blob
   *
   * @param blobService The azure.BlobService used to store the media
   * @param messageId The id of the message used to set the blob name
   */
  public getContentFromBlob(
    blobService: BlobService,
    messageId: string,
  ): TE.TaskEither<Error, Option<MessageContent>> {
    // Retrieve blob content and deserialize
    return pipe(
      blobIdFromMessageId(messageId),
      getBlobAsTextWithError(blobService, this.containerName),
      TE.mapLeft((storageError) => ({
        code: storageError.code ?? GenericCode,
        message: storageError.message,
      })),
      TE.chain((maybeContentAsText) =>
        TE.fromEither(
          E.fromOption(
            // Blob exists but the content is empty
            () => ({
              code: GenericCode,
              message: "Cannot get stored message content from empty blob",
            }),
          )(maybeContentAsText),
        ),
      ),
      // Try to decode the MessageContent
      TE.chain(
        flow(
          J.parse,
          E.mapLeft(E.toError),
          TE.fromEither,
          TE.mapLeft((parseError) => ({
            code: GenericCode,
            message: `Cannot parse content text into object: ${parseError.message}`,
          })),
        ),
      ),
      TE.chain(
        flow(
          MessageContent.decode,
          TE.fromEither,
          TE.mapLeft((decodeErrors) => ({
            code: GenericCode,
            message: `Cannot deserialize stored message content: ${readableReport(
              decodeErrors,
            )}`,
          })),
          TE.map(some),
        ),
      ),
      TE.orElse((error) =>
        error.code === BlobNotFoundCode ? TE.right(none) : TE.left(error),
      ),
      TE.mapLeft((error) => new Error(error.message)),
    );
  }

  /**
   * Store the message content in a blob
   *
   * @param blobService The azure.BlobService used to store the media
   * @param messageId The id of the message used to set the blob name
   * @param messageContent The content to store in the blob
   */
  public storeContentAsBlob(
    blobService: BlobService,
    messageId: string,
    messageContent: NewMessageContent,
  ): TE.TaskEither<Error, Option<BlobService.BlobResult>> {
    // Set the blob name
    const blobName = blobIdFromMessageId(messageId);

    // Store message content in blob storage
    return pipe(
      TE.tryCatch(
        () =>
          upsertBlobFromObject<NewMessageContent>(
            blobService,
            this.containerName,
            blobName,
            messageContent,
          ),
        E.toError,
      ),
      TE.chain(TE.fromEither),
    );
  }
}
