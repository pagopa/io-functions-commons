/* eslint-disable @typescript-eslint/no-explicit-any */

import * as azureStorage from "azure-storage";
import { isLeft, isRight, left, right } from "fp-ts/lib/Either";
import { isSome } from "fp-ts/lib/Option";
import * as asyncI from "../../utils/async";

import { FiscalCode } from "../../../generated/definitions/FiscalCode";
import { MessageBodyMarkdown } from "../../../generated/definitions/MessageBodyMarkdown";
import { MessageContent } from "../../../generated/definitions/MessageContent";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { fromNullable, none, some } from "fp-ts/lib/Option";

import {
  MessageModel,
  NewMessageWithContent,
  RetrievedMessageWithContent
} from "../message";

jest.mock("../../utils/azure_storage");
import { Container, ResourceResponse } from "@azure/cosmos";
import { MessageSubject } from "../../../generated/definitions/MessageSubject";
import { ServiceId } from "../../../generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "../../../generated/definitions/TimeToLiveSeconds";
import * as azureStorageUtils from "../../utils/azure_storage";
import { elem } from "fp-ts/lib/Foldable";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";

beforeEach(() => {
  jest.resetAllMocks();
});

const MESSAGE_CONTAINER_NAME = "message-content" as NonEmptyString;

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

const aRetrievedMessageWithContent: RetrievedMessageWithContent = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  ...aNewMessageWithContent,
  kind: "IRetrievedMessageWithContent"
};

const iteratorGenMock = async function*(arr: any[]) {
  for (let a of arr) yield a;
};

describe("findMessages", () => {
  it("should return the messages for a fiscal code", async () => {
    const iteratorMock = iteratorGenMock([
      [right(aRetrievedMessageWithContent)]
    ]);

    const asyncIteratorSpy = jest
      .spyOn(asyncI, "mapAsyncIterable")
      .mockImplementation(() => {
        return {
          [Symbol.asyncIterator]: () => iteratorMock
        };
      });

    const containerMock = ({
      items: {
        query: jest.fn(() => ({
          getAsyncIterator: jest.fn(() => iteratorMock)
        }))
      }
    } as unknown) as Container;

    const model = new MessageModel(containerMock, MESSAGE_CONTAINER_NAME);

    const errorsOrResultIterator = await model
      .findMessages(aRetrievedMessageWithContent.fiscalCode)
      .run();

    expect(asyncIteratorSpy).toHaveBeenCalledTimes(1);
    expect(containerMock.items.query).toHaveBeenCalledTimes(1);
    expect(isRight(errorsOrResultIterator)).toBeTruthy();
    if (isRight(errorsOrResultIterator)) {
      const result = await errorsOrResultIterator.value.next();
      expect(isRight(result.value[0])).toBeTruthy();
      if (isRight(result.value[0])) {
        const item = result.value[0].value;
        expect(item).toEqual(aRetrievedMessageWithContent);
      }
    }
  });

  it("should return an empty iterator if fiscalCode doesn't match", async () => {
    const iteratorMock = iteratorGenMock([[]]);

    const asyncIteratorSpy = jest
      .spyOn(asyncI, "mapAsyncIterable")
      // eslint-disable-next-line sonarjs/no-identical-functions
      .mockImplementation(() => {
        return {
          [Symbol.asyncIterator]: () => iteratorMock
        };
      });

    const containerMock = ({
      items: {
        query: jest.fn(() => ({
          getAsyncIterator: jest.fn(() => iteratorMock)
        }))
      }
    } as unknown) as Container;

    const model = new MessageModel(containerMock, MESSAGE_CONTAINER_NAME);

    const errorsOrResultIterator = await model
      .findMessages(aRetrievedMessageWithContent.fiscalCode)
      .run();

    expect(asyncIteratorSpy).toHaveBeenCalledTimes(1);
    expect(containerMock.items.query).toHaveBeenCalledTimes(1);
    expect(isRight(errorsOrResultIterator)).toBeTruthy();
    if (isRight(errorsOrResultIterator)) {
      const result = await errorsOrResultIterator.value.next();
      expect(result.value).toMatchObject([]);
    }
  });
});

it("should return an iterator containing results page of correct pageSize", async () => {
  const iteratorMock = iteratorGenMock([
    [right(aRetrievedMessageWithContent), right(aRetrievedMessageWithContent)],
    [right(aRetrievedMessageWithContent)]
  ]);

  const asyncIteratorSpy = jest
    .spyOn(asyncI, "mapAsyncIterable")
    // eslint-disable-next-line sonarjs/no-identical-functions
    .mockImplementation(() => {
      return {
        [Symbol.asyncIterator]: () => iteratorMock
      };
    });

  const containerMock = ({
    items: {
      query: jest.fn(() => ({
        getAsyncIterator: jest.fn(() => iteratorMock)
      }))
    }
  } as unknown) as Container;

  const model = new MessageModel(containerMock, MESSAGE_CONTAINER_NAME);

  const errorsOrResultIterator = await model
    .findMessages(
      aRetrievedMessageWithContent.fiscalCode,
      2 as NonNegativeInteger
    )
    .run();

  expect(asyncIteratorSpy).toHaveBeenCalledTimes(1);
  expect(containerMock.items.query).toHaveBeenCalledTimes(1);
  expect(containerMock.items.query).toHaveBeenCalledWith(
    {
      parameters: [
        { name: "@fiscalCode", value: aRetrievedMessageWithContent.fiscalCode }
      ],
      query: "SELECT * FROM m WHERE m.fiscalCode = @fiscalCode ORDER BY m.id DESC"
    },
    { maxItemCount: 2 }
  );
  expect(isRight(errorsOrResultIterator)).toBeTruthy();
  if (isRight(errorsOrResultIterator)) {
    const iterator = errorsOrResultIterator.value;
    const result = await iterator.next();
    expect(result.value).toMatchObject([
      right(aRetrievedMessageWithContent),
      right(aRetrievedMessageWithContent)
    ]);
    const result2 = await iterator.next();
    expect(result2.value).toMatchObject([right(aRetrievedMessageWithContent)]);
  }
});

it("should construct the correct query with nextId param", async () => {
  const iteratorMock = iteratorGenMock([[]]);

  const asyncIteratorSpy = jest
    .spyOn(asyncI, "mapAsyncIterable")
    // eslint-disable-next-line sonarjs/no-identical-functions
    .mockImplementation(() => {
      return {
        [Symbol.asyncIterator]: () => iteratorMock
      };
    });

  const containerMock = ({
    items: {
      query: jest.fn(() => ({
        getAsyncIterator: jest.fn(() => iteratorMock)
      }))
    }
  } as unknown) as Container;

  const model = new MessageModel(containerMock, MESSAGE_CONTAINER_NAME);

  await model
    .findMessages(
      aRetrievedMessageWithContent.fiscalCode,
      2 as NonNegativeInteger,
      "A_MESSAGE_ID" as NonEmptyString
    )
    .run();

  expect(asyncIteratorSpy).toHaveBeenCalledTimes(1);
  expect(containerMock.items.query).toHaveBeenCalledTimes(1);
  expect(containerMock.items.query).toHaveBeenCalledWith(
    {
      parameters: [
        { name: "@fiscalCode", value: aRetrievedMessageWithContent.fiscalCode },
        { name: "@nextId", value: "A_MESSAGE_ID" }
      ],
      query: "SELECT * FROM m WHERE m.fiscalCode = @fiscalCode AND m.id < @nextId ORDER BY m.id DESC"
    },
    { maxItemCount: 2 }
  );
});

it("should construct the correct query with prevId param", async () => {
  const iteratorMock = iteratorGenMock([[]]);

  const asyncIteratorSpy = jest
    .spyOn(asyncI, "mapAsyncIterable")
    // eslint-disable-next-line sonarjs/no-identical-functions
    .mockImplementation(() => {
      return {
        [Symbol.asyncIterator]: () => iteratorMock
      };
    });

  const containerMock = ({
    items: {
      query: jest.fn(() => ({
        getAsyncIterator: jest.fn(() => iteratorMock)
      }))
    }
  } as unknown) as Container;

  const model = new MessageModel(containerMock, MESSAGE_CONTAINER_NAME);

  await model
    .findMessages(
      aRetrievedMessageWithContent.fiscalCode,
      2 as NonNegativeInteger,
      undefined,
      "A_MESSAGE_ID" as NonEmptyString
    )
    .run();

  expect(asyncIteratorSpy).toHaveBeenCalledTimes(1);
  expect(containerMock.items.query).toHaveBeenCalledTimes(1);
  expect(containerMock.items.query).toHaveBeenCalledWith(
    {
      parameters: [
        { name: "@fiscalCode", value: aRetrievedMessageWithContent.fiscalCode },
        { name: "@prevId", value: "A_MESSAGE_ID" }
      ],
      query: "SELECT * FROM m WHERE m.fiscalCode = @fiscalCode AND m.id > @prevId ORDER BY m.id DESC"
    },
    { maxItemCount: 2 }
  );
});

it("should return an iterator with correct done definition", async () => {
  const iteratorMock = iteratorGenMock([
    [right(aRetrievedMessageWithContent), right(aRetrievedMessageWithContent)]
  ]);

  const asyncIteratorSpy = jest
    .spyOn(asyncI, "mapAsyncIterable")
    // eslint-disable-next-line sonarjs/no-identical-functions
    .mockImplementation(() => {
      return {
        [Symbol.asyncIterator]: () => iteratorMock
      };
    });

  const containerMock = ({
    items: {
      query: jest.fn(() => ({
        getAsyncIterator: jest.fn(() => iteratorMock)
      }))
    }
  } as unknown) as Container;

  const model = new MessageModel(containerMock, MESSAGE_CONTAINER_NAME);

  const errorsOrResultIterator = await model
    .findMessages(
      aRetrievedMessageWithContent.fiscalCode,
      2 as NonNegativeInteger
    )
    .run();

  expect(asyncIteratorSpy).toHaveBeenCalledTimes(1);
  expect(containerMock.items.query).toHaveBeenCalledTimes(1);
  expect(isRight(errorsOrResultIterator)).toBeTruthy();
  if (isRight(errorsOrResultIterator)) {
    const iterator = errorsOrResultIterator.value;
    const result = await iterator.next();
    expect(result.value).toMatchObject([
      right(aRetrievedMessageWithContent),
      right(aRetrievedMessageWithContent)
    ]);
    const result2 = await iterator.next();
    expect(result2.done).toBe(true);
  }
});

describe("findMessageForRecipient", () => {
  it("should return the messages if the recipient matches", async () => {
    const readMock = jest.fn().mockResolvedValueOnce(
      new ResourceResponse(
        {
          ...aRetrievedMessageWithContent
        },
        {},
        200,
        200
      )
    );
    const containerMock = ({
      item: jest.fn().mockReturnValue({ read: readMock })
    } as unknown) as Container;

    const model = new MessageModel(containerMock, MESSAGE_CONTAINER_NAME);

    const result = await model
      .findMessageForRecipient(
        aRetrievedMessageWithContent.fiscalCode,
        aRetrievedMessageWithContent.id
      )
      .run();

    expect(containerMock.item).toHaveBeenCalledTimes(1);
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual({
        ...aRetrievedMessageWithContent
      });
    }
  });

  it("should return an empty value if the recipient doesn't match", async () => {
    const readMock = jest
      .fn()
      .mockResolvedValueOnce(new ResourceResponse(undefined, {}, 200, 200));
    const containerMock = ({
      item: jest.fn().mockReturnValue({ read: readMock })
    } as unknown) as Container;

    const model = new MessageModel(containerMock, MESSAGE_CONTAINER_NAME);

    const result = await model
      .findMessageForRecipient(
        "FRLFRC73E04B157I" as FiscalCode,
        aRetrievedMessageWithContent.id
      )
      .run();

    expect(containerMock.item).toHaveBeenCalledTimes(1);
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isNone()).toBeTruthy();
    }
  });

  it("should return an error", async () => {
    const readMock = jest.fn().mockRejectedValueOnce({ code: 500 });
    const containerMock = ({
      item: jest.fn().mockReturnValue({ read: readMock })
    } as unknown) as Container;

    const model = new MessageModel(containerMock, MESSAGE_CONTAINER_NAME);

    const result = await model
      .findMessageForRecipient(
        "FRLFRC73E04B157I" as FiscalCode,
        aRetrievedMessageWithContent.id
      )
      .run();

    expect(containerMock.item).toHaveBeenCalledTimes(1);
    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toEqual("COSMOS_ERROR_RESPONSE");
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

    const containerMock = ({} as unknown) as Container;
    const model = new MessageModel(containerMock, MESSAGE_CONTAINER_NAME);

    const upsertBlobFromObjectSpy = jest
      .spyOn(azureStorageUtils, "upsertBlobFromObject")
      .mockReturnValueOnce(Promise.resolve(right(fromNullable(aBlobResult))));

    const blob = await model
      .storeContentAsBlob(blobServiceMock as any, aMessageId, aMessageContent)
      .run();

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
  const containerMock = ({} as unknown) as Container;
  const model = new MessageModel(containerMock, MESSAGE_CONTAINER_NAME);

  it("should get message content from stored blob", async () => {
    const getBlobAsTextSpy = jest
      .spyOn(azureStorageUtils, "getBlobAsText")
      .mockReturnValueOnce(
        Promise.resolve(right(some(JSON.stringify(aMessageContent))))
      );

    const errorOrMaybeMessageContent = await model
      .getContentFromBlob(blobServiceMock as any, aMessageId)
      .run();

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

    const errorOrMaybeMessageContent = await model
      .getContentFromBlob(blobServiceMock as any, aMessageId)
      .run();

    expect(isLeft(errorOrMaybeMessageContent)).toBeTruthy();
    expect(errorOrMaybeMessageContent.value).toEqual(err);

    getBlobAsTextSpy.mockReset();
  });

  it("should fail with an error when the retrieved blob is empty", async () => {
    const getBlobAsTextSpy = jest
      .spyOn(azureStorageUtils, "getBlobAsText")
      .mockResolvedValueOnce(right(none));

    const errorOrMaybeMessageContent = await model
      .getContentFromBlob(blobServiceMock as any, aMessageId)
      .run();

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

    const errorOrMaybeMessageContent = await model
      .getContentFromBlob(blobServiceMock as any, aMessageId)
      .run();

    expect(isLeft(errorOrMaybeMessageContent)).toBeTruthy();
    expect(errorOrMaybeMessageContent.value).toBeInstanceOf(Error);

    getBlobAsTextSpy.mockReset();
  });
});
