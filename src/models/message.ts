import { BlobService } from "azure-storage";
import * as E from "fp-ts/lib/Either";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import {
  Container,
  FeedOptions,
  FeedResponse,
  SqlQuerySpec
} from "@azure/cosmos";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { pipe } from "fp-ts/lib/function";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  BaseModel,
  CosmosdbModel,
  CosmosDecodingError,
  CosmosErrors,
  CosmosResource,
  toCosmosErrorResponse
} from "../utils/cosmosdb_model";

import { MessageContent } from "../../generated/definitions/MessageContent";

import { FiscalCode } from "../../generated/definitions/FiscalCode";

import { ServiceId } from "../../generated/definitions/ServiceId";
import { Timestamp } from "../../generated/definitions/Timestamp";
import { TimeToLiveSeconds } from "../../generated/definitions/TimeToLiveSeconds";
import { getBlobAsText, upsertBlobFromObject } from "../utils/azure_storage";
import { wrapWithKind } from "../utils/types";
import { MessageContentBase } from "../../generated/definitions/MessageContentBase";
import { PaymentDataWithOptionalPayee } from "../../generated/definitions/PaymentDataWithOptionalPayee";
import { MessageContentWithPaymentDataWithPayee } from "../../generated/definitions/MessageContentWithPaymentDataWithPayee";

export const MESSAGE_COLLECTION_NAME = "messages";
export const MESSAGE_MODEL_PK_FIELD = "fiscalCode" as const;

const MESSAGE_BLOB_STORAGE_SUFFIX = ".json";

const MessageBaseR = t.interface({
  // when the message was accepted by the system
  createdAt: Timestamp,

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
  timeToLiveSeconds: TimeToLiveSeconds
});

const MessageBaseO = t.partial({
  // When true, the message is still being processed and should be
  // hidden from the result of getMessages requests. This is needed to avoid
  // cases where getMessages returns messages without content - i.e. messages
  // that didn't pass the checks done by created_message_queue_handler before
  // storing the message content.
  isPending: t.boolean
});

const MessageBase = t.intersection([MessageBaseR, MessageBaseO], "MessageBase");

/**
 * The attributes common to all types of Message
 */
type MessageBase = t.TypeOf<typeof MessageBase>;

/**
 * A Message without content.
 *
 * A Message gets stored without content if the recipient didn't opt-in
 * to have the content of the messages permanently stored in his inbox.
 */
export type MessageWithoutContent = MessageBase;
export const MessageWithoutContent = MessageBase;

/**
 * A Message with content
 *
 * A Message gets stored with content if the recipient opted-in
 * to have the content of the messages permanently stored in his inbox.
 */
export const MessageWithContent = t.intersection([
  t.interface({
    content: MessageContentBase
  }),
  MessageBase
]);

export type MessageWithContent = t.TypeOf<typeof MessageWithContent>;

/**
 * A Message with content with payment data with payee
 *
 * A Message gets stored with content if the recipient opted-in
 * to have the content of the messages permanently stored in his inbox.
 */
export const MessageWithContentWithPaymentDataWithPayee = t.intersection([
  t.interface({
    content: MessageContentWithPaymentDataWithPayee
  }),
  MessageBase
]);

export type MessageWithContentWithPaymentDataWithPayee = t.TypeOf<
  typeof MessageWithContentWithPaymentDataWithPayee
>;

/**
 * A Message with content with payment data with optional payee
 *
 * A Message gets stored with content if the recipient opted-in
 * to have the content of the messages permanently stored in his inbox.
 */
export const MessageWithContentWithPaymentDataWithOptionalPayee = t.intersection(
  [
    t.interface({
      content: t.intersection([
        MessageContentBase,
        t.interface({ payment_data: PaymentDataWithOptionalPayee })
      ])
    }),
    MessageBase
  ]
);

export type MessageWithContentWithPaymentDataWithOptionalPayee = t.TypeOf<
  typeof MessageWithContentWithPaymentDataWithOptionalPayee
>;

/**
 * A Message can be with our without content
 */
export const Message = t.union([
  MessageWithContentWithPaymentDataWithPayee,
  MessageWithContentWithPaymentDataWithOptionalPayee,
  MessageWithContent,
  MessageWithoutContent
]);

export type Message = t.TypeOf<typeof Message>;

export const NewMessageWithContent = wrapWithKind(
  t.intersection([MessageWithContent, BaseModel]),
  "INewMessageWithContent" as const
);

export type NewMessageWithContent = t.TypeOf<typeof NewMessageWithContent>;

export const NewMessageWithContentWithPaymentDataWithPayee = wrapWithKind(
  t.intersection([MessageWithContentWithPaymentDataWithPayee, BaseModel]),
  "INewMessageWithContentWithPaymentData" as const
);

export type NewMessageWithContentWithPaymentDataWithPayee = t.TypeOf<
  typeof NewMessageWithContentWithPaymentDataWithPayee
>;

export const NewMessageWithoutContent = wrapWithKind(
  t.intersection([MessageWithoutContent, BaseModel]),
  "INewMessageWithoutContent" as const
);

export type NewMessageWithoutContent = t.TypeOf<
  typeof NewMessageWithoutContent
>;

/**
 * A (yet to be saved) Message
 */
export const NewMessage = t.union([
  NewMessageWithContentWithPaymentDataWithPayee,
  NewMessageWithContent,
  NewMessageWithoutContent
]);

export type NewMessage = t.TypeOf<typeof NewMessage>;

export const RetrievedMessageWithContent = wrapWithKind(
  t.intersection([MessageWithContent, CosmosResource]),
  "IRetrievedMessageWithContent" as const
);

export type RetrievedMessageWithContent = t.TypeOf<
  typeof RetrievedMessageWithContent
>;

export const RetrievedMessageWithContentWithPaymentData = wrapWithKind(
  t.intersection([
    MessageWithContentWithPaymentDataWithOptionalPayee,
    CosmosResource
  ]),
  "IRetrievedMessageWithContentWithPaymentData" as const
);

export type RetrievedMessageWithContentWithPaymentData = t.TypeOf<
  typeof RetrievedMessageWithContentWithPaymentData
>;

export const RetrievedMessageWithoutContent = wrapWithKind(
  t.intersection([MessageWithoutContent, CosmosResource]),
  "IRetrievedMessageWithoutContent" as const
);

export type RetrievedMessageWithoutContent = t.TypeOf<
  typeof RetrievedMessageWithoutContent
>;

export const ActiveMessage = t.refinement(
  MessageBase,
  message =>
    Date.now() - message.createdAt.getTime() <=
    message.timeToLiveSeconds * 1000,
  "NotExpiredMessage"
);

export type NotExpiredMessage = t.TypeOf<typeof ActiveMessage>;

/**
 * A (previously saved) retrieved Message
 */
export const RetrievedMessage = t.union([
  RetrievedMessageWithContentWithPaymentData,
  RetrievedMessageWithContent,
  RetrievedMessageWithoutContent
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
export class MessageModel extends CosmosdbModel<
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
    protected readonly containerName: NonEmptyString
  ) {
    super(container, NewMessage, RetrievedMessage);
  }

  /**
   * Returns the message for the provided fiscal code and message ID
   *
   * @param fiscalCode The fiscal code of the recipient
   * @param messageId The ID of the message
   */
  public findMessageForRecipient(
    fiscalCode: FiscalCode,
    messageId: NonEmptyString
  ): TE.TaskEither<CosmosErrors, Option<RetrievedMessage>> {
    return pipe(
      this.find([messageId, fiscalCode]),
      TE.map(maybeMessage =>
        pipe(
          maybeMessage,
          O.filter(m => m.fiscalCode === fiscalCode)
        )
      )
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
    minimumMessageId?: NonEmptyString
  ): TE.TaskEither<
    CosmosErrors,
    AsyncIterator<
      ReadonlyArray<t.Validation<RetrievedMessage>>,
      ReadonlyArray<t.Validation<RetrievedMessage>>
    >
  > {
    const commonQuerySpec = {
      parameters: [
        {
          name: "@fiscalCode",
          value: fiscalCode
        }
      ],
      query: `SELECT * FROM m WHERE m.${MESSAGE_MODEL_PK_FIELD} = @fiscalCode`
    };
    const emptyMessageParameter = {
      condition: "",
      param: []
    };
    return pipe(
      TE.of({
        nextMessagesParams: pipe(
          fromNullable(maximumMessageId),
          O.foldW(
            () => emptyMessageParameter,
            maximumId => ({
              condition: ` AND m.id < @maxId`,
              param: [{ name: "@maxId", value: maximumId }]
            })
          )
        ),
        prevMessagesParams: pipe(
          fromNullable(minimumMessageId),
          O.foldW(
            () => emptyMessageParameter,
            minimumId => ({
              condition: ` AND m.id > @minId`,
              param: [{ name: "@minId", value: minimumId }]
            })
          )
        )
      }),
      TE.mapLeft(toCosmosErrorResponse),
      TE.map(({ nextMessagesParams, prevMessagesParams }) => ({
        parameters: [
          ...commonQuerySpec.parameters,
          ...nextMessagesParams.param,
          ...prevMessagesParams.param
        ],
        query: `${commonQuerySpec.query}${nextMessagesParams.condition}${prevMessagesParams.condition} ORDER BY m.id DESC`
      })),
      TE.chain(querySpec =>
        TE.fromEither(
          E.tryCatch(
            () =>
              this.getQueryIterator(querySpec, { maxItemCount: pageSize })[
                Symbol.asyncIterator
              ](),
            toCosmosErrorResponse
          )
        )
      )
    );
  }

  /**
   * @deprecated use getQueryIterator + asyncIterableToArray
   */
  public findAllByQuery(
    query: string | SqlQuerySpec,
    options?: FeedOptions
  ): TE.TaskEither<
    CosmosErrors,
    Option<ReadonlyArray<RetrievedMessageWithoutContent>>
  > {
    return pipe(
      TE.tryCatch<
        CosmosErrors,
        // eslint-disable-next-line @typescript-eslint/array-type
        FeedResponse<readonly RetrievedMessageWithoutContent[]>
      >(
        () =>
          this.container.items
            // eslint-disable-next-line @typescript-eslint/array-type
            .query<readonly RetrievedMessageWithoutContent[]>(query, options)
            .fetchAll(),
        toCosmosErrorResponse
      ),
      TE.map(_ => fromNullable(_.resources)),
      TE.chain(_ =>
        O.isSome(_)
          ? pipe(
              TE.fromEither(
                E.sequenceArray(
                  _.value.map(RetrievedMessageWithoutContent.decode)
                )
              ),
              TE.map(some),
              TE.mapLeft(CosmosDecodingError)
            )
          : TE.fromEither(E.right(none))
      )
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
    messageContent: MessageContent
  ): TE.TaskEither<Error, Option<BlobService.BlobResult>> {
    // Set the blob name
    const blobName = blobIdFromMessageId(messageId);

    // Store message content in blob storage
    return pipe(
      TE.tryCatch(
        () =>
          upsertBlobFromObject<MessageContent>(
            blobService,
            this.containerName,
            blobName,
            messageContent
          ),
        E.toError
      ),
      TE.chain(TE.fromEither)
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
    messageId: string
  ): TE.TaskEither<Error, Option<MessageContent>> {
    const blobId = blobIdFromMessageId(messageId);

    // Retrieve blob content and deserialize
    return pipe(
      TE.tryCatch(
        () => getBlobAsText(blobService, this.containerName, blobId),
        E.toError
      ),
      TE.chain(TE.fromEither),
      TE.chain(maybeContentAsText =>
        TE.fromEither(
          E.fromOption(
            // Blob exists but the content is empty
            () => new Error("Cannot get stored message content from blob")
          )(maybeContentAsText)
        )
      ),
      // Try to decode the MessageContent
      TE.chain(contentAsText =>
        pipe(
          E.parseJSON(contentAsText, E.toError),
          E.fold(
            _ => TE.left(new Error(`Cannot parse content text into object`)),
            _ => TE.of(_)
          )
        )
      ),
      TE.chain(undecodedContent =>
        pipe(
          MessageContent.decode(undecodedContent),
          E.fold(
            errors =>
              TE.left(
                new Error(
                  `Cannot deserialize stored message content: ${readableReport(
                    errors
                  )}`
                )
              ),
            (content: MessageContent) => TE.of(some(content))
          )
        )
      )
    );
  }
}
