/* eslint-disable @typescript-eslint/no-explicit-any */

import * as azureStorage from "azure-storage";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
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
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { pipe } from "fp-ts/lib/function";

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
      [E.right(aRetrievedMessageWithContent)]
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

    const errorsOrResultIterator = await model.findMessages(
      aRetrievedMessageWithContent.fiscalCode
    )();

    expect(asyncIteratorSpy).toHaveBeenCalledTimes(1);
    expect(containerMock.items.query).toHaveBeenCalledTimes(1);
    expect(E.isRight(errorsOrResultIterator)).toBeTruthy();
    if (E.isRight(errorsOrResultIterator)) {
      const result = await errorsOrResultIterator.right.next();
      expect(E.isRight(result.value[0])).toBeTruthy();
      if (E.isRight(result.value[0])) {
        const item = result.value[0].right;
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

    const errorsOrResultIterator = await model.findMessages(
      aRetrievedMessageWithContent.fiscalCode
    )();

    expect(asyncIteratorSpy).toHaveBeenCalledTimes(1);
    expect(containerMock.items.query).toHaveBeenCalledTimes(1);
    expect(E.isRight(errorsOrResultIterator)).toBeTruthy();
    if (E.isRight(errorsOrResultIterator)) {
      const result = await errorsOrResultIterator.right.next();
      expect(result.value).toMatchObject([]);
    }
  });
});

it("should return an iterator containing results page of correct pageSize", async () => {
  const iteratorMock = iteratorGenMock([
    [E.right(aRetrievedMessageWithContent), E.right(aRetrievedMessageWithContent)],
    [E.right(aRetrievedMessageWithContent)]
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
    ();

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
  expect(E.isRight(errorsOrResultIterator)).toBeTruthy();
  if (E.isRight(errorsOrResultIterator)) {
    const iterator = errorsOrResultIterator.right;
    const result = await iterator.next();
    expect(result.value).toMatchObject([
      E.right(aRetrievedMessageWithContent),
      E.right(aRetrievedMessageWithContent)
    ]);
    const result2 = await iterator.next();
    expect(result2.value).toMatchObject([E.right(aRetrievedMessageWithContent)]);
  }
});

it("should construct the correct query with maximumMessageId param", async () => {
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
    ();

  expect(asyncIteratorSpy).toHaveBeenCalledTimes(1);
  expect(containerMock.items.query).toHaveBeenCalledTimes(1);
  expect(containerMock.items.query).toHaveBeenCalledWith(
    {
      parameters: [
        { name: "@fiscalCode", value: aRetrievedMessageWithContent.fiscalCode },
        { name: "@maxId", value: "A_MESSAGE_ID" }
      ],
      query: "SELECT * FROM m WHERE m.fiscalCode = @fiscalCode AND m.id < @maxId ORDER BY m.id DESC"
    },
    { maxItemCount: 2 }
  );
});

it("should construct the correct query with minimumMessageId param", async () => {
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
    ();

  expect(asyncIteratorSpy).toHaveBeenCalledTimes(1);
  expect(containerMock.items.query).toHaveBeenCalledTimes(1);
  expect(containerMock.items.query).toHaveBeenCalledWith(
    {
      parameters: [
        { name: "@fiscalCode", value: aRetrievedMessageWithContent.fiscalCode },
        { name: "@minId", value: "A_MESSAGE_ID" }
      ],
      query: "SELECT * FROM m WHERE m.fiscalCode = @fiscalCode AND m.id > @minId ORDER BY m.id DESC"
    },
    { maxItemCount: 2 }
  );
});

it("should return an iterator with correct done definition", async () => {
  const iteratorMock = iteratorGenMock([
    [E.right(aRetrievedMessageWithContent), E.right(aRetrievedMessageWithContent)]
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
    ();

  expect(asyncIteratorSpy).toHaveBeenCalledTimes(1);
  expect(containerMock.items.query).toHaveBeenCalledTimes(1);
  expect(E.isRight(errorsOrResultIterator)).toBeTruthy();
  if (E.isRight(errorsOrResultIterator)) {
    const iterator = errorsOrResultIterator.right;
    const result = await iterator.next();
    expect(result.value).toMatchObject([
      E.right(aRetrievedMessageWithContent),
      E.right(aRetrievedMessageWithContent)
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

    const result = await model.findMessageForRecipient(
      aRetrievedMessageWithContent.fiscalCode,
      aRetrievedMessageWithContent.id
    )();

    expect(containerMock.item).toHaveBeenCalledTimes(1);
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBeTruthy();
      expect(O.toUndefined(result.right)).toEqual({
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

    const result = await model.findMessageForRecipient(
      "FRLFRC73E04B157I" as FiscalCode,
      aRetrievedMessageWithContent.id
    )();

    expect(containerMock.item).toHaveBeenCalledTimes(1);
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isNone(result.right)).toBeTruthy();
    }
  });

  it("should return an error", async () => {
    const readMock = jest.fn().mockRejectedValueOnce({ code: 500 });
    const containerMock = ({
      item: jest.fn().mockReturnValue({ read: readMock })
    } as unknown) as Container;

    const model = new MessageModel(containerMock, MESSAGE_CONTAINER_NAME);

    const result = await model.findMessageForRecipient(
      "FRLFRC73E04B157I" as FiscalCode,
      aRetrievedMessageWithContent.id
    )();

    expect(containerMock.item).toHaveBeenCalledTimes(1);
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("COSMOS_ERROR_RESPONSE");
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
      .mockReturnValueOnce(Promise.resolve(E.right(fromNullable(aBlobResult))));

    const blob = await model.storeContentAsBlob(
      blobServiceMock as any,
      aMessageId,
      aMessageContent
    )();

    expect(upsertBlobFromObjectSpy).toBeCalledWith(
      blobServiceMock,
      expect.any(String),
      expect.any(String),
      aMessageContent
    );
    expect(E.isRight(blob)).toBeTruthy();
    if (E.isRight(blob)) {
      expect(
        pipe(
          blob.right,
          O.map(b => expect(b).toEqual(aBlobResult))
        )
      );
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
        Promise.resolve(E.right(some(JSON.stringify(aMessageContent))))
      );

    const errorOrMaybeMessageContent = await model.getContentFromBlob(
      blobServiceMock as any,
      aMessageId
    )();

    expect(getBlobAsTextSpy).toBeCalledWith(
      blobServiceMock,
      expect.any(String), // Container name
      `${aMessageId}.json`
    );
    expect(E.isRight(errorOrMaybeMessageContent)).toBeTruthy();
    if (E.isRight(errorOrMaybeMessageContent)) {
      const maybeMessageContent = errorOrMaybeMessageContent.right;
      expect(O.isSome(maybeMessageContent)).toBeTruthy();
      if (O.isSome(maybeMessageContent)) {
        expect(maybeMessageContent.value).toEqual(aMessageContent);
      }
    }

    getBlobAsTextSpy.mockReset();
  });

  it("should fail with an error when the blob cannot be retrieved", async () => {
    const err = Error();
    const getBlobAsTextSpy = jest
      .spyOn(azureStorageUtils, "getBlobAsText")
      .mockReturnValueOnce(Promise.resolve(E.left(err)));

    const errorOrMaybeMessageContent = await model.getContentFromBlob(
      blobServiceMock as any,
      aMessageId
    )();

    expect(E.isLeft(errorOrMaybeMessageContent)).toBeTruthy();
    if (E.isLeft(errorOrMaybeMessageContent)) {
      expect(errorOrMaybeMessageContent.left).toEqual(err);
    }

    getBlobAsTextSpy.mockReset();
  });

  it("should fail with an error when the retrieved blob is empty", async () => {
    const getBlobAsTextSpy = jest
      .spyOn(azureStorageUtils, "getBlobAsText")
      .mockResolvedValueOnce(E.right(none));

    const errorOrMaybeMessageContent = await model.getContentFromBlob(
      blobServiceMock as any,
      aMessageId
    )();

    expect(E.isLeft(errorOrMaybeMessageContent)).toBeTruthy();
    if (E.isLeft(errorOrMaybeMessageContent)) {
      expect(errorOrMaybeMessageContent.left).toBeInstanceOf(Error);
    }

    getBlobAsTextSpy.mockReset();
  });

  it("should fail with an error when the retrieved blob can't be decoded", async () => {
    const invalidMessageContent = {};
    const getBlobAsTextSpy = jest
      .spyOn(azureStorageUtils, "getBlobAsText")
      .mockResolvedValueOnce(
        E.right(some(JSON.stringify(invalidMessageContent)))
      );

    const errorOrMaybeMessageContent = await model.getContentFromBlob(
      blobServiceMock as any,
      aMessageId
    )();

    expect(E.isLeft(errorOrMaybeMessageContent)).toBeTruthy();
    if (E.isLeft(errorOrMaybeMessageContent)) {
      expect(errorOrMaybeMessageContent.left).toBeInstanceOf(Error);
    }

    getBlobAsTextSpy.mockReset();
  });
});
