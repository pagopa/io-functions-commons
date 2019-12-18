/* tslint:disable:no-any */

import * as azureStorage from "azure-storage";
import * as DocumentDb from "documentdb";
import { isLeft, isRight, left, right } from "fp-ts/lib/Either";
import { isSome } from "fp-ts/lib/Option";

import * as DocumentDbUtils from "../../utils/documentdb";

import { FiscalCode } from "../../../generated/definitions/FiscalCode";
import { MessageBodyMarkdown } from "../../../generated/definitions/MessageBodyMarkdown";
import { MessageContent } from "../../../generated/definitions/MessageContent";

import { NonEmptyString } from "italia-ts-commons/lib/strings";

import { fromNullable, none, some } from "fp-ts/lib/Option";

import {
  MESSAGE_COLLECTION_NAME,
  MessageModel,
  NewMessageWithContent,
  RetrievedMessageWithContent
} from "../message";

jest.mock("../../utils/azure_storage");
import { MessageSubject } from "../../../generated/definitions/MessageSubject";
import { ServiceId } from "../../../generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "../../../generated/definitions/TimeToLiveSeconds";
import * as azureStorageUtils from "../../utils/azure_storage";

const MESSAGE_CONTAINER_NAME = "message-content" as NonEmptyString;

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb" as NonEmptyString);
const aMessagesCollectionUrl = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  MESSAGE_COLLECTION_NAME
);

const aMessageBodyMarkdown = "test".repeat(80) as MessageBodyMarkdown;

const aMessageContent: MessageContent = {
  markdown: aMessageBodyMarkdown,
  subject: "test".repeat(10) as MessageSubject
};

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;

const aSerializedNewMessageWithContent = {
  content: aMessageContent,
  createdAt: new Date().toISOString(),
  fiscalCode: aFiscalCode,
  id: "A_MESSAGE_ID" as NonEmptyString,
  indexedId: "A_MESSAGE_ID" as NonEmptyString,
  senderServiceId: "agid" as ServiceId,
  senderUserId: "u123" as NonEmptyString,
  timeToLiveSeconds: 3600 as TimeToLiveSeconds
};

const aNewMessageWithContent: NewMessageWithContent = {
  ...aSerializedNewMessageWithContent,
  createdAt: new Date(),
  kind: "INewMessageWithContent"
};

const aSerializedRetrievedMessageWithContent = {
  ...aSerializedNewMessageWithContent,
  _self: "xyz",
  _ts: 123,
  kind: "IRetrievedMessageWithContent"
};

const aRetrievedMessageWithContent: RetrievedMessageWithContent = {
  ...aNewMessageWithContent,
  _self: "xyz",
  _ts: 123,
  kind: "IRetrievedMessageWithContent"
};

describe("createMessage", () => {
  it("should create a new Message", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) =>
        cb(undefined, aSerializedRetrievedMessageWithContent)
      )
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );

    const result = await model.create(
      aNewMessageWithContent,
      aNewMessageWithContent.fiscalCode
    );

    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value).toEqual({
        ...aRetrievedMessageWithContent,
        createdAt: expect.any(Date)
      });
    }
  });

  it("should return the error if creation fails", async () => {
    const clientMock = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error"))
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );

    const result = await model.create(
      aNewMessageWithContent,
      aNewMessageWithContent.fiscalCode
    );

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][0]).toEqual(
      "dbs/mockdb/colls/messages"
    );
    expect(clientMock.createDocument.mock.calls[0][1]).toEqual({
      ...aNewMessageWithContent,
      kind: undefined
    });
    expect(clientMock.createDocument.mock.calls[0][2]).toEqual({
      partitionKey: aNewMessageWithContent.fiscalCode
    });
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("find", () => {
  it("should return an existing message", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) =>
        cb(undefined, aSerializedRetrievedMessageWithContent)
      )
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );

    const result = await model.find(
      aRetrievedMessageWithContent.id,
      aRetrievedMessageWithContent.fiscalCode
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.readDocument.mock.calls[0][0]).toEqual(
      "dbs/mockdb/colls/messages/docs/A_MESSAGE_ID"
    );
    expect(clientMock.readDocument.mock.calls[0][1]).toEqual({
      partitionKey: aRetrievedMessageWithContent.fiscalCode
    });
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual({
        ...aRetrievedMessageWithContent,
        createdAt: expect.any(Date)
      });
    }
  });

  it("should return the error", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb({ code: 500 }))
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );

    const result = await model.find(
      aRetrievedMessageWithContent.id,
      aRetrievedMessageWithContent.fiscalCode
    );

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual({ code: 500 });
    }
  });

  it("should return an empty value on 404 error", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb({ code: 404 }))
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );

    const result = await model.find(
      aRetrievedMessageWithContent.id,
      aRetrievedMessageWithContent.fiscalCode
    );

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isNone()).toBeTruthy();
    }
  });
});

describe("findMessages", () => {
  it("should return the messages for a fiscal code", async () => {
    const iteratorMock = {
      executeNext: jest.fn(cb => cb(undefined, ["result"], undefined))
    };

    const clientMock = {
      queryDocuments: jest.fn(() => iteratorMock)
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );

    const resultIterator = model.findMessages(
      aRetrievedMessageWithContent.fiscalCode
    );

    expect(clientMock.queryDocuments).toHaveBeenCalledTimes(1);

    const result = await resultIterator.executeNext();

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(["result"]);
    }
  });
});

describe("findMessageForRecipient", () => {
  it("should return the messages if the recipient matches", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) =>
        cb(undefined, aSerializedRetrievedMessageWithContent)
      )
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );

    const result = await model.findMessageForRecipient(
      aRetrievedMessageWithContent.fiscalCode,
      aRetrievedMessageWithContent.id
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.readDocument.mock.calls[0][0]).toEqual(
      "dbs/mockdb/colls/messages/docs/A_MESSAGE_ID"
    );
    expect(clientMock.readDocument.mock.calls[0][1]).toEqual({
      partitionKey: aRetrievedMessageWithContent.fiscalCode
    });
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual({
        ...aRetrievedMessageWithContent,
        createdAt: expect.any(Date)
      });
    }
  });

  it("should return an empty value if the recipient doesn't match", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) =>
        cb(undefined, aSerializedRetrievedMessageWithContent)
      )
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );

    const result = await model.findMessageForRecipient(
      "FRLFRC73E04B157I" as FiscalCode,
      aRetrievedMessageWithContent.id
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isNone()).toBeTruthy();
    }
  });

  it("should return an error", async () => {
    const clientMock = {
      readDocument: jest.fn((_, __, cb) => cb("error"))
    };

    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );

    const result = await model.findMessageForRecipient(
      "FRLFRC73E04B157I" as FiscalCode,
      aRetrievedMessageWithContent.id
    );

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toBe("error");
    }
  });
});

describe("storeContentAsBlob", () => {
  const aMessageId = "MESSAGE_ID";
  const aBlobResult = {
    name: "blobName"
  } as azureStorage.BlobService.BlobResult;
  it("should save the message content in a blob", async () => {
    const blobServiceMock = {};

    const clientMock = {};
    const model = new MessageModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      aMessagesCollectionUrl,
      MESSAGE_CONTAINER_NAME
    );

    const upsertBlobFromObjectSpy = jest
      .spyOn(azureStorageUtils, "upsertBlobFromObject")
      .mockReturnValueOnce(Promise.resolve(right(fromNullable(aBlobResult))));

    const blob = await model.storeContentAsBlob(
      blobServiceMock as any,
      aMessageId,
      aMessageContent
    );

    expect(upsertBlobFromObjectSpy).toBeCalledWith(
      blobServiceMock,
      expect.any(String),
      expect.any(String),
      aMessageContent
    );
    expect(isRight(blob)).toBeTruthy();
    if (isRight(blob)) {
      expect(blob.value.map(b => expect(b).toEqual(aBlobResult)));
    }

    upsertBlobFromObjectSpy.mockReset();
  });
});

describe("getContentFromBlob", () => {
  const aMessageId = "MESSAGE_ID";
  const blobServiceMock = {};
  const model = new MessageModel(
    ({} as any) as DocumentDb.DocumentClient,
    aMessagesCollectionUrl,
    MESSAGE_CONTAINER_NAME
  );

  it("should get message content from stored blob", async () => {
    const getBlobAsTextSpy = jest
      .spyOn(azureStorageUtils, "getBlobAsText")
      .mockReturnValueOnce(
        Promise.resolve(right(some(JSON.stringify(aMessageContent))))
      );

    const errorOrMaybeMessageContent = await model.getContentFromBlob(
      blobServiceMock as any,
      aMessageId
    );

    expect(getBlobAsTextSpy).toBeCalledWith(
      blobServiceMock,
      expect.any(String), // Container name
      `${aMessageId}.json`
    );
    expect(isRight(errorOrMaybeMessageContent)).toBeTruthy();
    if (isRight(errorOrMaybeMessageContent)) {
      const maybeMessageContent = errorOrMaybeMessageContent.value;
      expect(isSome(maybeMessageContent)).toBeTruthy();
      if (isSome(maybeMessageContent)) {
        expect(maybeMessageContent.value).toEqual(aMessageContent);
      }
    }

    getBlobAsTextSpy.mockReset();
  });

  it("should fail with an error when the blob cannot be retrieved", async () => {
    const err = Error();
    const getBlobAsTextSpy = jest
      .spyOn(azureStorageUtils, "getBlobAsText")
      .mockReturnValueOnce(Promise.resolve(left(err)));

    const errorOrMaybeMessageContent = await model.getContentFromBlob(
      blobServiceMock as any,
      aMessageId
    );

    expect(isLeft(errorOrMaybeMessageContent)).toBeTruthy();
    expect(errorOrMaybeMessageContent.value).toEqual(err);

    getBlobAsTextSpy.mockReset();
  });

  it("should fail with an error when the retrieved blob is empty", async () => {
    const getBlobAsTextSpy = jest
      .spyOn(azureStorageUtils, "getBlobAsText")
      .mockResolvedValueOnce(right(none));

    const errorOrMaybeMessageContent = await model.getContentFromBlob(
      blobServiceMock as any,
      aMessageId
    );

    expect(isLeft(errorOrMaybeMessageContent)).toBeTruthy();
    expect(errorOrMaybeMessageContent.value).toBeInstanceOf(Error);

    getBlobAsTextSpy.mockReset();
  });

  it("should fail with an error when the retrieved blob can't be decoded", async () => {
    const invalidMessageContent = {};
    const getBlobAsTextSpy = jest
      .spyOn(azureStorageUtils, "getBlobAsText")
      .mockResolvedValueOnce(
        right(some(JSON.stringify(invalidMessageContent)))
      );

    const errorOrMaybeMessageContent = await model.getContentFromBlob(
      blobServiceMock as any,
      aMessageId
    );

    expect(isLeft(errorOrMaybeMessageContent)).toBeTruthy();
    expect(errorOrMaybeMessageContent.value).toBeInstanceOf(Error);

    getBlobAsTextSpy.mockReset();
  });
});
