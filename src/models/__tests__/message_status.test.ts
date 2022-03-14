// eslint-disable @typescript-eslint/no-explicit-any

import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import { NonNegativeNumber } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { Container, ResourceResponse } from "@azure/cosmos";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { MessageStatusValueEnum } from "../../../generated/definitions/MessageStatusValue";
import {
  getMessageStatusUpdater,
  MessageStatusModel,
  NewMessageStatus,
  RetrievedMessageStatus
} from "../message_status";
import { pipe } from "fp-ts/lib/function";

const aMessageId = "A_MESSAGE_ID" as NonEmptyString;
const aFiscalCode = "RLDBSV36A78Y792X" as FiscalCode;

const aSerializedMessageStatus = {
  messageId: aMessageId,
  fiscalCode: aFiscalCode,
  status: MessageStatusValueEnum.ACCEPTED,
  updatedAt: new Date().toISOString()
};

const aSerializedRetrievedMessageStatus = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  ...aSerializedMessageStatus,
  id: `${aMessageId}-${"0".repeat(16)}` as NonEmptyString,
  kind: "IRetrievedMessageStatus",
  version: 0 as NonNegativeNumber
};

const aRetrievedMessageStatus = pipe(
  RetrievedMessageStatus.decode(aSerializedRetrievedMessageStatus),
  E.getOrElseW(errs => {
    const error = readableReport(errs);
    throw new Error("Fix MessageStatus mock: " + error);
  })
);

// -------------------------
// Mocks
// -------------------------

const mockFetchAll = jest.fn();
const mockCreateItem = jest.fn();

const containerMock = ({
  items: {
    create: mockCreateItem,
    query: jest.fn(() => ({
      fetchAll: mockFetchAll
    }))
  }
} as unknown) as Container;

mockCreateItem.mockImplementation(
  async doc =>
    new ResourceResponse(
      { ...doc, _etag: "_etag", _rid: "_rid", _self: "_self", _ts: 1 },
      {},
      200,
      200
    )
);

mockFetchAll.mockImplementation(async () => ({
  resources: [aRetrievedMessageStatus]
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("findOneMessageStatusById", () => {
  it("should return an existing message status", async () => {
    const model = new MessageStatusModel(containerMock);

    const result = await model.findLastVersionByModelId([aMessageId])();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBeTruthy();
      expect(O.toUndefined(result.right)).toEqual({
        ...aRetrievedMessageStatus,
        isRead: false,
        isArchived: false
      });
    }
  });

  it("should resolve to an empty value if no message status is found", async () => {
    mockFetchAll.mockImplementationOnce(async () => ({
      resources: undefined
    }));

    const model = new MessageStatusModel(containerMock);

    const result = await model.findLastVersionByModelId([aMessageId])();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isNone(result.right)).toBeTruthy();
    }
  });

  it("should validate the retrieved object agains the model type", async () => {
    mockFetchAll.mockImplementationOnce(async () => ({
      resources: [{}]
    }));

    const model = new MessageStatusModel(containerMock);

    const result = await model.findLastVersionByModelId([aMessageId])();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toBe("COSMOS_DECODING_ERROR");
    }
  });
});

describe("Update status", () => {
  // ------------------------------
  // Read messages
  // ------------------------------

  it("should update an existing message status with isRead = true", async () => {
    const model = new MessageStatusModel(containerMock);

    const result = await model.findLastVersionByModelId([aMessageId])();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBeTruthy();
      expect(O.toUndefined(result.right)).toEqual({
        ...aRetrievedMessageStatus,
        isRead: false,
        isArchived: false
      });
    }

    const val = {
      ...aRetrievedMessageStatus,
      kind: "INewMessageStatus",
      isRead: true
    } as NewMessageStatus;

    const upsertedresult = await model.upsert(val)();

    expect(E.isRight(upsertedresult)).toBe(true);
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBeTruthy();

      const param = mockCreateItem.mock.calls[0][0];

      const date = new Date().toJSON().split("T")[0];

      expect(param).toEqual(
        expect.objectContaining({
          ...val,
          isArchived: false,
          updatedAt: expect.stringContaining(date),
          id: "A_MESSAGE_ID-0000000000000001",
          version: 1
        })
      );
    }
  });
  // ------------------------------
  // Archived messages
  // ------------------------------

  it("should update an existing message status with isArchived = true", async () => {
    const model = new MessageStatusModel(containerMock);

    const result = await model.findLastVersionByModelId([aMessageId])();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBeTruthy();
      expect(O.toUndefined(result.right)).toEqual(aRetrievedMessageStatus);
    }

    const val = {
      ...aRetrievedMessageStatus,
      kind: "INewMessageStatus",
      isArchived: true
    } as NewMessageStatus;

    const upsertedresult = await model.upsert(val)();

    expect(E.isRight(upsertedresult)).toBe(true);
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBeTruthy();

      const param = mockCreateItem.mock.calls[0][0];

      const date = new Date().toJSON().split("T")[0];

      expect(param).toEqual(
        expect.objectContaining({
          ...val,
          isRead: false,
          updatedAt: expect.stringContaining(date),
          id: "A_MESSAGE_ID-0000000000000001",
          version: 1
        })
      );
    }
  });
});

describe("getMessageStatusUpdater", () => {
  it("should update message status if no previous status are defined", async () => {
    const aNewMessageId = "ANonExistingId-1" as NonEmptyString;
    const newStatus = MessageStatusValueEnum.ACCEPTED;

    mockFetchAll.mockImplementation(async () => ({
      resources: []
    }));

    const model = new MessageStatusModel(containerMock);

    const updater = getMessageStatusUpdater(model, aNewMessageId, aFiscalCode);

    const res = await updater(newStatus)();

    expect(E.isRight(res)).toBe(true);
    if (E.isRight(res)) {
      expect(mockCreateItem.mock.calls[0][0]).toMatchObject(
        expect.objectContaining({
          version: 0,
          status: newStatus,
          messageId: aNewMessageId,
          fiscalCode: aFiscalCode,
          isRead: false,
          isArchived: false
        })
      );
    }
  });

  it("should update message status if a previous status is defined", async () => {
    const aNewMessageId = "ANonExistingId-2" as NonEmptyString;
    const newStatus = MessageStatusValueEnum.PROCESSED;

    mockFetchAll.mockImplementation(async () => ({
      resources: [
        {
          ...aRetrievedMessageStatus,
          status: MessageStatusValueEnum.ACCEPTED,
          messageId: aNewMessageId
        }
      ]
    }));

    const model = new MessageStatusModel(containerMock);

    const updater = getMessageStatusUpdater(model, aNewMessageId, aFiscalCode);

    const res = await updater(newStatus)();

    expect(E.isRight(res)).toBe(true);
    if (E.isRight(res)) {
      expect(mockCreateItem.mock.calls[0][0]).toMatchObject(
        expect.objectContaining({
          version: 1,
          status: newStatus,
          messageId: aNewMessageId,
          fiscalCode: aFiscalCode,
          isRead: false,
          isArchived: false
        })
      );
    }
  });

  it("should update message status if a previous status is defined without overriding isRead and isArchived", async () => {
    const aNewMessageId = "ANonExistingId-3" as NonEmptyString;
    const newStatus = MessageStatusValueEnum.PROCESSED;

    mockFetchAll.mockImplementation(async () => ({
      resources: [
        {
          ...aRetrievedMessageStatus,
          isRead: true,
          isArchived: true,
          status: MessageStatusValueEnum.ACCEPTED,
          messageId: aNewMessageId
        }
      ]
    }));

    const model = new MessageStatusModel(containerMock);

    const updater = getMessageStatusUpdater(model, aNewMessageId, aFiscalCode);

    const res = await updater(newStatus)();

    expect(E.isRight(res)).toBe(true);
    if (E.isRight(res)) {
      expect(mockCreateItem.mock.calls[0][0]).toMatchObject(
        expect.objectContaining({
          version: 1,
          status: newStatus,
          messageId: aNewMessageId,
          fiscalCode: aFiscalCode,
          isRead: true,
          isArchived: true
        })
      );
    }
  });
});
