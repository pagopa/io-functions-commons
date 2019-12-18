import { BlobService } from "azure-storage";
import * as DocumentDb from "documentdb";
import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { isNone, Option, some } from "fp-ts/lib/Option";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { pick, tag } from "italia-ts-commons/lib/types";

import * as DocumentDbUtils from "../utils/documentdb";
import { DocumentDbModel } from "../utils/documentdb_model";

import { MessageContent } from "../../generated/definitions/MessageContent";

import { FiscalCode } from "../../generated/definitions/FiscalCode";

import { ServiceId } from "../../generated/definitions/ServiceId";
import { Timestamp } from "../../generated/definitions/Timestamp";
import { TimeToLiveSeconds } from "../../generated/definitions/TimeToLiveSeconds";
import { getBlobAsText, upsertBlobFromObject } from "../utils/azure_storage";

export const MESSAGE_COLLECTION_NAME = "messages";
export const MESSAGE_MODEL_PK_FIELD = "fiscalCode";

const MESSAGE_BLOB_STORAGE_SUFFIX = ".json";

const MessageBaseR = t.interface({
  // the fiscal code of the recipient
  fiscalCode: FiscalCode,

  // the identifier of the service of the sender
  senderServiceId: ServiceId,

  // the userId of the sender (this is opaque and depends on the API gateway)
  senderUserId: NonEmptyString,

  // time to live in seconds
  timeToLiveSeconds: TimeToLiveSeconds,

  // when the message was accepted by the system
  createdAt: Timestamp,

  // needed to order by id or to make range queries (ie. WHERE id > "string")
  // see https://stackoverflow.com/questions/48710600/azure-cosmosdb-how-to-order-by-id
  indexedId: NonEmptyString
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
    content: MessageContent
  }),
  MessageBase
]);

export type MessageWithContent = t.TypeOf<typeof MessageWithContent>;

/**
 * A Message can be with our without content
 */
export const Message = t.union([MessageWithoutContent, MessageWithContent]);

export type Message = t.TypeOf<typeof Message>;

/**
 * A (yet to be saved) Message with content
 */

export interface INewMessageWithContentTag {
  readonly kind: "INewMessageWithContent";
}

export const NewMessageWithContent = tag<INewMessageWithContentTag>()(
  t.intersection([MessageWithContent, DocumentDbUtils.NewDocument])
);

export type NewMessageWithContent = t.TypeOf<typeof NewMessageWithContent>;

/**
 * A (yet to be saved) Message without content
 */
export interface INewMessageWithoutContentTag {
  readonly kind: "INewMessageWithoutContent";
}

export const NewMessageWithoutContent = tag<INewMessageWithoutContentTag>()(
  t.intersection([MessageWithoutContent, DocumentDbUtils.NewDocument])
);

export type NewMessageWithoutContent = t.TypeOf<
  typeof NewMessageWithoutContent
>;

/**
 * A (yet to be saved) Message
 */
export const NewMessage = t.union([
  NewMessageWithContent,
  NewMessageWithoutContent
]);

export type NewMessage = t.TypeOf<typeof NewMessage>;

/**
 * A (previously saved) retrieved Message with content
 */

export interface IRetrievedMessageWithContentTag {
  readonly kind: "IRetrievedMessageWithContent";
}

export const RetrievedMessageWithContent = tag<
  IRetrievedMessageWithContentTag
>()(t.intersection([MessageWithContent, DocumentDbUtils.RetrievedDocument]));

export type RetrievedMessageWithContent = t.TypeOf<
  typeof RetrievedMessageWithContent
>;

/**
 * A (previously saved) retrieved Message without content
 */

export interface IRetrievedMessageWithoutContentTag {
  readonly kind: "IRetrievedMessageWithoutContent";
}

export const RetrievedMessageWithoutContent = tag<
  IRetrievedMessageWithoutContentTag
>()(t.intersection([MessageWithoutContent, DocumentDbUtils.RetrievedDocument]));

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
  RetrievedMessageWithContent,
  RetrievedMessageWithoutContent
]);

export type RetrievedMessage = t.TypeOf<typeof RetrievedMessage>;

function toBaseType(o: RetrievedMessage): Message {
  const props: ReadonlyArray<keyof Message> = [
    "fiscalCode",
    "senderServiceId",
    "senderUserId",
    "timeToLiveSeconds",
    "createdAt"
  ];
  return RetrievedMessageWithContent.is(o)
    ? pick(["content", ...props], o)
    : pick(props, o);
}

function toRetrieved(result: DocumentDb.RetrievedDocument): RetrievedMessage {
  return RetrievedMessage.decode(result).getOrElseL(errs => {
    throw new Error(
      "Retrieved result wasn't a RetrievedMessage: " + readableReport(errs)
    );
  });
}

function blobIdFromMessageId(messageId: string): string {
  return `${messageId}${MESSAGE_BLOB_STORAGE_SUFFIX}`;
}

/**
 * A model for handling Messages
 */
export class MessageModel extends DocumentDbModel<
  Message,
  NewMessage,
  RetrievedMessage
> {
  /**
   * Creates a new Message model
   *
   * @param dbClient the DocumentDB client
   * @param collectionUrl the collection URL
   * @param containerName the name of the blob storage container to store message content in
   */
  constructor(
    dbClient: DocumentDb.DocumentClient,
    collectionUrl: DocumentDbUtils.IDocumentDbCollectionUri,
    protected readonly containerName: NonEmptyString
  ) {
    super(dbClient, collectionUrl, toBaseType, toRetrieved);
  }

  /**
   * Returns the message for the provided fiscal code and message ID
   *
   * @param fiscalCode The fiscal code of the recipient
   * @param messageId The ID of the message
   */
  public async findMessageForRecipient(
    fiscalCode: FiscalCode,
    messageId: string
  ): Promise<Either<DocumentDb.QueryError, Option<RetrievedMessage>>> {
    const errorOrMaybeMessage = await this.find(messageId, fiscalCode);

    return errorOrMaybeMessage.map(maybeMessage =>
      maybeMessage.filter(m => m.fiscalCode === fiscalCode)
    );
  }

  /**
   * Returns the messages for the provided fiscal code
   *
   * @param fiscalCode The fiscal code of the recipient
   */
  public findMessages(
    fiscalCode: FiscalCode
  ): DocumentDbUtils.IResultIterator<RetrievedMessageWithContent> {
    return DocumentDbUtils.queryDocuments(
      this.dbClient,
      this.collectionUri,
      {
        parameters: [
          {
            name: "@fiscalCode",
            value: fiscalCode
          }
        ],
        query: `SELECT * FROM m WHERE m.${MESSAGE_MODEL_PK_FIELD} = @fiscalCode`
      },
      fiscalCode
    );
  }

  /**
   * Store the message content in a blob
   *
   * @param blobService The azure.BlobService used to store the media
   * @param messageId The id of the message used to set the blob name
   * @param messageContent The content to store in the blob
   */
  public async storeContentAsBlob(
    blobService: BlobService,
    messageId: string,
    messageContent: MessageContent
  ): Promise<
    Either<Error | DocumentDb.QueryError, Option<BlobService.BlobResult>>
  > {
    // Set the blob name
    const blobName = blobIdFromMessageId(messageId);

    // Store message content in blob storage
    return await upsertBlobFromObject<MessageContent>(
      blobService,
      this.containerName,
      blobName,
      messageContent
    );
  }

  /**
   * Retrieve the message content from a blob
   *
   * @param blobService The azure.BlobService used to store the media
   * @param messageId The id of the message used to set the blob name
   */
  public async getContentFromBlob(
    blobService: BlobService,
    messageId: string
  ): Promise<Either<Error, Option<MessageContent>>> {
    const blobId = blobIdFromMessageId(messageId);

    // Retrieve blob content and deserialize
    const maybeContentAsTextOrError = await getBlobAsText(
      blobService,
      this.containerName,
      blobId
    );

    if (isLeft(maybeContentAsTextOrError)) {
      return left<Error, Option<MessageContent>>(
        maybeContentAsTextOrError.value
      );
    }

    // Blob exists but the content is empty
    const maybeContentAsText = maybeContentAsTextOrError.value;
    if (isNone(maybeContentAsText)) {
      return left<Error, Option<MessageContent>>(
        new Error("Cannot get stored message content from blob")
      );
    }

    const contentAsText = maybeContentAsText.value;

    // Try to decode the MessageContent
    const contentOrError = MessageContent.decode(JSON.parse(contentAsText));

    if (isLeft(contentOrError)) {
      const errors: string = readableReport(contentOrError.value);
      return left<Error, Option<MessageContent>>(
        new Error(`Cannot deserialize stored message content: ${errors}`)
      );
    }

    const content = contentOrError.value;
    return right<Error, Option<MessageContent>>(some(content));
  }
}
