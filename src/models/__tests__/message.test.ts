/* eslint-disable @typescript-eslint/no-explicit-any */

import * as azureStorage from "azure-storage";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import * as asyncI from "../../utils/async";

import { FiscalCode } from "../../../generated/definitions/FiscalCode";
import { MessageBodyMarkdown } from "../../../generated/definitions/MessageBodyMarkdown";
import { MessageContent } from "../../../generated/definitions/MessageContent";

import {
  NonEmptyString,
  OrganizationFiscalCode
} from "@pagopa/ts-commons/lib/strings";

import { fromNullable, none, some } from "fp-ts/lib/Option";

import {
  MessageModel,
  MessageWithContent,
  NewMessageWithContent,
  RetrievedMessage,
  NewMessageWithoutContent,
  RetrievedMessageWithContent,
  NewMessage
} from "../message";

jest.mock("../../utils/azure_storage");
import { Container, ResourceResponse } from "@azure/cosmos";
import { MessageSubject } from "../../../generated/definitions/MessageSubject";
import { ServiceId } from "../../../generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "../../../generated/definitions/TimeToLiveSeconds";
import * as azureStorageUtils from "../../utils/azure_storage";
import { PaymentData } from "../../../generated/definitions/PaymentData";
import { PaymentAmount } from "../../../generated/definitions/PaymentAmount";
import { PaymentNoticeNumber } from "../../../generated/definitions/PaymentNoticeNumber";
import { Payee } from "../../../generated/definitions/Payee";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { pipe } from "fp-ts/lib/function";
import { PaymentDataWithRequiredPayee } from "../../../generated/definitions/PaymentDataWithRequiredPayee";

beforeEach(() => {
  jest.resetAllMocks();
});

const MESSAGE_CONTAINER_NAME = "message-content" as NonEmptyString;

const aMessageBodyMarkdown = "test".repeat(80) as MessageBodyMarkdown;
const aGeneralMessageContent = {
  markdown: aMessageBodyMarkdown,
  subject: "test".repeat(10) as MessageSubject
}

const aMessageContent = {
  ...aGeneralMessageContent
};

const cosmosMetadata = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
}

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const anOrganizationFiscalCode = "12345678901" as OrganizationFiscalCode;

const aSerializedNewMessageWithoutContent = {
  createdAt: new Date().toISOString(),
  fiscalCode: aFiscalCode,
  id: "A_MESSAGE_ID" as NonEmptyString,
  indexedId: "A_MESSAGE_ID" as NonEmptyString,
  senderServiceId: "agid" as ServiceId,
  senderUserId: "u123" as NonEmptyString,
  timeToLiveSeconds: 3600 as TimeToLiveSeconds
};

const aSerializedNewMessageWithContent = {
  ...aSerializedNewMessageWithoutContent,
  content: aMessageContent
};

const aNewMessageWithContent: NewMessageWithContent = {
  ...aSerializedNewMessageWithoutContent,
  content: {
    ...aGeneralMessageContent
  },
  createdAt: new Date(),
  kind: "INewMessageWithContent"
};

const aNewMessageWithoutContent: NewMessageWithoutContent = {
  ...aSerializedNewMessageWithoutContent,
  createdAt: new Date(),
  kind: "INewMessageWithoutContent"
};

const aPaymentDataWithoutPayee: PaymentData = {
  amount: 1000 as PaymentAmount,
  notice_number: "177777777777777777" as PaymentNoticeNumber
};
const aPayee: Payee = { fiscal_code: anOrganizationFiscalCode };
const aPaymentDataWithPayee: PaymentDataWithRequiredPayee = {
  ...aPaymentDataWithoutPayee,
  payee: aPayee
};

const aNewMessageWithContentWithPaymentData: NewMessageWithContent = {
  ...aNewMessageWithContent,
  content: {
    ...aNewMessageWithContent.content,
    payment_data: aPaymentDataWithPayee
  },
  kind: "INewMessageWithContent"
};

const aNewMessageWithContentWithPaymentDataWithoutPayee = {
  ...aNewMessageWithContent,
  content: {
    ...aNewMessageWithContent.content,
    payment_data: aPaymentDataWithoutPayee
  },
  kind: "INewMessageWithContent"
};

const aRetrievedMessageWithoutContent = {
  ...cosmosMetadata,
  ...aNewMessageWithoutContent
};
const aRetrievedMessageWithContent: RetrievedMessageWithContent = {
  ...cosmosMetadata,
  ...aNewMessageWithContent,
  kind: "IRetrievedMessageWithContent"
};
const aRetrievedMessageWithContentWithPaymentData: RetrievedMessageWithContent = {
  ...cosmosMetadata,
  ...aNewMessageWithContentWithPaymentData,
  kind: "IRetrievedMessageWithContent",
};

const aRetrievedMessageWithContentWithPaymentDataWithoutPayee = {
  
  ...aRetrievedMessageWithContent,
  content: {
    ...aRetrievedMessageWithContent.content,
    payment_data: aPaymentDataWithoutPayee
  }
};

describe("Models ", () => {
  it("should decode MessageWithContent with payment data with payee", () => {
    const messageWithContentWithPayee = NewMessageWithContent.decode(
      aNewMessageWithContentWithPaymentData
    );

    pipe(
      messageWithContentWithPayee,
      E.fold(
        () => fail(), 
        _ => expect(_).toEqual({
          ...aNewMessageWithContentWithPaymentData,
          content: {
            ...aNewMessageWithContentWithPaymentData.content,
            payment_data: {
              ...aNewMessageWithContentWithPaymentData.content.payment_data,
              invalid_after_due_date: false
            }
          }
        })
      )
    );
  });

  it("should decode MessageWithContentWithPaymentData with payment data without payee", () => {
    const messageWithContentWithoutPayee = MessageWithContent.decode(
      aRetrievedMessageWithContentWithPaymentDataWithoutPayee
    );

    expect(E.isRight(messageWithContentWithoutPayee)).toBeTruthy();
  });

  it("should NOT decode NewMessage with content with payment data without payee", () => {
    const messageWithContentWithoutPayee = NewMessageWithContent.decode(
      aNewMessageWithContentWithPaymentDataWithoutPayee
    );
    expect(E.isLeft(messageWithContentWithoutPayee)).toBeTruthy();
  });

  it("should deserialize MessageWithContent with payment data without payee", () => {
    pipe(
      aRetrievedMessageWithContentWithPaymentDataWithoutPayee,
      MessageWithContent.decode, 
      E.fold(
        () => fail(),
        _ => expect(_).toEqual({
          ...aRetrievedMessageWithContentWithPaymentDataWithoutPayee,
          content: {
            ...aRetrievedMessageWithContentWithPaymentDataWithoutPayee.content,
            payment_data: {
              ...aRetrievedMessageWithContentWithPaymentDataWithoutPayee.content
                .payment_data,
              invalid_after_due_date: false
            }
          }
        }) 
      )
    )
  });

  it("should deserialize MessageWithContent without payment_data", () => {
    expect(E.isRight(MessageWithContent.decode(aNewMessageWithContent))).toBeTruthy();
  });
});

describe("RetrievedMessage", () => {
  it("should deserialize RetrievedMessage without payment_data", () => {
    pipe(
      aRetrievedMessageWithContent,
      RetrievedMessage.decode,
      E.fold(
        () => fail(), 
        val => {
          expect(val).toEqual({
            ...aRetrievedMessageWithContent,
            kind: "IRetrievedMessageWithContent"
          });
      })
    )
    
  });

  it("should deserialize RetrievedMessage with payment_data without payee", () => {
    const expected = {
      ...aRetrievedMessageWithContentWithPaymentDataWithoutPayee,
      kind: "IRetrievedMessageWithContent",
      content: {
        ...aRetrievedMessageWithContentWithPaymentDataWithoutPayee.content,
        payment_data: {
          ...aRetrievedMessageWithContentWithPaymentDataWithoutPayee.content
            .payment_data,
          invalid_after_due_date: false
        }
      }
    };
    pipe(
      aRetrievedMessageWithContentWithPaymentDataWithoutPayee,
      RetrievedMessage.decode,
      E.fold(
        () => fail(), 
        value => expect(value).toEqual(expected)
      )
    );
  });

  it("should deserialize RetrievedMessage without Content", () => {
    const expected = {
      ...aRetrievedMessageWithoutContent,
      kind: "IRetrievedMessageWithoutContent"
    };
    pipe(
      aRetrievedMessageWithoutContent,
      RetrievedMessage.decode,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(expected)
      )
    );
  });

  it("should deserialize RetrievedMessage with payment_data with payee", () => {
    const expected = {
      ...aRetrievedMessageWithContentWithPaymentData,
      kind: "IRetrievedMessageWithContent",
      content: {
        ...aRetrievedMessageWithContentWithPaymentData.content,
        payment_data: {
          ...aRetrievedMessageWithContentWithPaymentData.content.payment_data,
          invalid_after_due_date: false
        }
      }
    };

    pipe(
      aRetrievedMessageWithContentWithPaymentData,
      RetrievedMessage.decode,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(expected)
      )
    );
  });
});

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
      query: "SELECT * FROM m WHERE m.fiscalCode = @fiscalCode ORDER BY m.fiscalCode, m.id DESC"
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
      query: "SELECT * FROM m WHERE m.fiscalCode = @fiscalCode AND m.id < @maxId ORDER BY m.fiscalCode, m.id DESC"
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
      query: "SELECT * FROM m WHERE m.fiscalCode = @fiscalCode AND m.id > @minId ORDER BY m.fiscalCode, m.id DESC"
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
