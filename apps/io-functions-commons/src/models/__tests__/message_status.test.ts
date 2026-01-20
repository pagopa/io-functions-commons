// eslint-disable @typescript-eslint/no-explicit-any
import { Container, CosmosDiagnostics, ResourceResponse } from "@azure/cosmos";
import {
  NonNegativeInteger,
  NonNegativeNumber,
} from "@pagopa/ts-commons/lib/numbers";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as t from "io-ts";

import { NotRejectedMessageStatusValueEnum as MessageStatusValueEnum } from "../../../generated/definitions/NotRejectedMessageStatusValue";
import { RejectedMessageStatusValueEnum } from "../../../generated/definitions/RejectedMessageStatusValue";
import { RejectionReasonEnum } from "../../../generated/definitions/RejectionReason";
import { Ttl } from "../../utils/cosmosdb_model_ttl";
import {
  getMessageStatusUpdater,
  MessageStatus,
  MessageStatusModel,
  NewMessageStatus,
  RetrievedMessageStatus,
} from "../message_status";
import { vi } from "vitest";

const aMessageId = "A_MESSAGE_ID" as NonEmptyString;
const aFiscalCode = "RLDBSV36A78Y792X" as FiscalCode;
const nowDate = new Date();

const aSerializedMessageStatus = {
  fiscalCode: aFiscalCode,
  messageId: aMessageId,
  status: MessageStatusValueEnum.ACCEPTED,
  updatedAt: nowDate.toISOString(),
};

const aNewMessageStatus: NewMessageStatus = {
  ...aSerializedMessageStatus,
  isArchived: false,
  isRead: false,
  kind: "INewMessageStatus",
  updatedAt: nowDate,
};

const aSerializedRetrievedMessageStatus = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  ...aSerializedMessageStatus,
  id: `${aMessageId}-${"0".repeat(16)}` as NonEmptyString,
  kind: "IRetrievedMessageStatus",
  version: 0 as NonNegativeNumber,
};

const aRetrievedMessageStatus = pipe(
  RetrievedMessageStatus.decode(aSerializedRetrievedMessageStatus),
  E.getOrElseW((errs) => {
    const error = readableReport(errs);
    throw new Error("Fix MessageStatus mock: " + error);
  }),
);

// -------------------------
// Mocks
// -------------------------

const mockFetchAll = vi.fn();
const mockCreateItem = vi.fn();

const containerMock = {
  items: {
    create: mockCreateItem,
    query: vi.fn(() => ({
      fetchAll: mockFetchAll,
    })),
  },
} as unknown as Container;

mockCreateItem.mockImplementation(
  async (doc) =>
    new ResourceResponse(
      { ...doc, _etag: "_etag", _rid: "_rid", _self: "_self", _ts: 1 },
      {},
      200,
      new CosmosDiagnostics(),
      200,
    ),
);

mockFetchAll.mockImplementation(async () => ({
  resources: [aRetrievedMessageStatus],
}));

beforeEach(() => {
  vi.clearAllMocks();
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
        isArchived: false,
        isRead: false,
      });
    }
  });

  it("should resolve to an empty value if no message status is found", async () => {
    mockFetchAll.mockImplementationOnce(async () => ({
      resources: undefined,
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
      resources: [{}],
    }));

    const model = new MessageStatusModel(containerMock);

    const result = await model.findLastVersionByModelId([aMessageId])();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toBe("COSMOS_DECODING_ERROR");
    }
  });

  it("should resolve a REJECTED status with UNKNOWN rejection status, if it's not defined", async () => {
    mockFetchAll.mockImplementationOnce(async () => ({
      resources: [
        {
          ...aRetrievedMessageStatus,
          status: RejectedMessageStatusValueEnum.REJECTED,
        },
      ],
    }));

    const model = new MessageStatusModel(containerMock);
    const result = await model.findLastVersionByModelId([aMessageId])();

    expect(result).toEqual(
      E.right(
        O.some({
          ...aRetrievedMessageStatus,
          isArchived: false,
          isRead: false,
          rejection_reason: RejectionReasonEnum.UNKNOWN,
          status: RejectedMessageStatusValueEnum.REJECTED,
        }),
      ),
    );
  });

  it("should resolve a REJECTED status with defined rejection status", async () => {
    mockFetchAll.mockImplementationOnce(async () => ({
      resources: [
        {
          ...aRetrievedMessageStatus,
          rejection_reason: RejectionReasonEnum.SERVICE_NOT_ALLOWED,
          status: RejectedMessageStatusValueEnum.REJECTED,
        },
      ],
    }));

    const model = new MessageStatusModel(containerMock);
    const result = await model.findLastVersionByModelId([aMessageId])();

    expect(result).toEqual(
      E.right(
        O.some({
          ...aRetrievedMessageStatus,
          isArchived: false,
          isRead: false,
          rejection_reason: RejectionReasonEnum.SERVICE_NOT_ALLOWED,
          status: RejectedMessageStatusValueEnum.REJECTED,
        }),
      ),
    );
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
        isArchived: false,
        isRead: false,
      });
    }

    const val = {
      ...aRetrievedMessageStatus,
      isRead: true,
      kind: "INewMessageStatus",
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
          id: "A_MESSAGE_ID-0000000000000001",
          isArchived: false,
          updatedAt: expect.stringContaining(date),
          version: 1,
        }),
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
      isArchived: true,
      kind: "INewMessageStatus",
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
          id: "A_MESSAGE_ID-0000000000000001",
          isRead: false,
          updatedAt: expect.stringContaining(date),
          version: 1,
        }),
      );
    }
  });
});

describe("getMessageStatusUpdater", () => {
  it("should update message status if no previous status are defined", async () => {
    const aNewMessageId = "ANonExistingId-1" as NonEmptyString;
    const newStatus = MessageStatusValueEnum.ACCEPTED;

    mockFetchAll.mockImplementation(async () => ({
      resources: [],
    }));

    const model = new MessageStatusModel(containerMock);

    const updater = getMessageStatusUpdater(model, aNewMessageId, aFiscalCode);

    const res = await updater({ status: newStatus })();

    expect(E.isRight(res)).toBe(true);
    if (E.isRight(res)) {
      expect(mockCreateItem.mock.calls[0][0]).toMatchObject(
        expect.objectContaining({
          fiscalCode: aFiscalCode,
          isArchived: false,
          isRead: false,
          messageId: aNewMessageId,
          status: newStatus,
          version: 0,
        }),
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
          messageId: aNewMessageId,
          status: MessageStatusValueEnum.ACCEPTED,
        },
      ],
    }));

    const model = new MessageStatusModel(containerMock);

    const updater = getMessageStatusUpdater(model, aNewMessageId, aFiscalCode);

    // We expect this call to fail beause not-REJECTED status does not need rejection status
    await updater({
      // @ts-expect-error
      rejection_reason: RejectionReasonEnum.SERVICE_NOT_ALLOWED,
      status: newStatus,
    })();

    const res = await updater({ status: newStatus })();

    expect(E.isRight(res)).toBe(true);
    if (E.isRight(res)) {
      expect(mockCreateItem.mock.calls[0][0]).toMatchObject(
        expect.objectContaining({
          fiscalCode: aFiscalCode,
          isArchived: false,
          isRead: false,
          messageId: aNewMessageId,
          status: newStatus,
          version: 1,
        }),
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
          isArchived: true,
          isRead: true,
          messageId: aNewMessageId,
          status: MessageStatusValueEnum.ACCEPTED,
        },
      ],
    }));

    const model = new MessageStatusModel(containerMock);

    const updater = getMessageStatusUpdater(model, aNewMessageId, aFiscalCode);

    const res = await updater({ status: newStatus })();

    expect(E.isRight(res)).toBe(true);
    if (E.isRight(res)) {
      expect(mockCreateItem.mock.calls[0][0]).toMatchObject(
        expect.objectContaining({
          fiscalCode: aFiscalCode,
          isArchived: true,
          isRead: true,
          messageId: aNewMessageId,
          status: newStatus,
          version: 1,
        }),
      );
    }
  });

  it("should handle a REJECTED message status asking for rejection reason", async () => {
    const aNewMessageId = "ANonExistingId-1" as NonEmptyString;
    const newStatus = RejectedMessageStatusValueEnum.REJECTED;

    mockFetchAll.mockImplementation(async () => ({
      resources: [],
    }));

    const model = new MessageStatusModel(containerMock);

    const updater = getMessageStatusUpdater(model, aNewMessageId, aFiscalCode);

    // We expect this call to fail beause REJECTED status needs also a rejection reason
    // @ts-expect-error
    await updater(newStatus)();

    const res = await updater({
      rejection_reason: RejectionReasonEnum.SERVICE_NOT_ALLOWED,
      status: newStatus,
    })();

    expect(E.isRight(res)).toBe(true);
    if (E.isRight(res)) {
      expect(mockCreateItem.mock.calls[0][0]).toMatchObject(
        expect.objectContaining({
          fiscalCode: aFiscalCode,
          isArchived: false,
          isRead: false,
          messageId: aNewMessageId,
          rejection_reason: RejectionReasonEnum.SERVICE_NOT_ALLOWED,
          status: newStatus,
          version: 0,
        }),
      );
    }
  });

  it("should handle a REJECTED message status with a ttl", async () => {
    const aNewMessageId = "ANonExistingId-1" as NonEmptyString;
    const newStatus = RejectedMessageStatusValueEnum.REJECTED;

    mockFetchAll.mockImplementation(async () => ({
      resources: [],
    }));

    const model = new MessageStatusModel(containerMock);

    const updater = getMessageStatusUpdater(model, aNewMessageId, aFiscalCode);

    // We expect this call to fail beause REJECTED status needs also a rejection reason
    // @ts-expect-error
    await updater(newStatus)();

    const res = await updater({
      rejection_reason: RejectionReasonEnum.SERVICE_NOT_ALLOWED,
      status: newStatus,
      ttl: 200 as Ttl,
    })();

    expect(E.isRight(res)).toBe(true);
    if (E.isRight(res)) {
      expect(mockCreateItem.mock.calls[0][0]).toMatchObject(
        expect.objectContaining({
          fiscalCode: aFiscalCode,
          isArchived: false,
          isRead: false,
          messageId: aNewMessageId,
          rejection_reason: RejectionReasonEnum.SERVICE_NOT_ALLOWED,
          status: newStatus,
          ttl: 200,
          version: 0,
        }),
      );
    }
  });
});
