import { Container } from "@azure/cosmos";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";

import { NotRejectedMessageStatusValueEnum as MessageStatusValueEnum } from "../../../generated/definitions/NotRejectedMessageStatusValue";
import { PaymentStatusEnum } from "../../../generated/definitions/PaymentStatus";
import { ServiceId } from "../../../generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "../../../generated/definitions/TimeToLiveSeconds";
import {
  Components,
  MessageView,
  RetrievedMessageView,
  Status,
} from "../message_view";
import { MessageViewModel } from "../message_view";
import { vi } from "vitest";

const aComponents: Components = {
  attachments: { has: false },
  euCovidCert: { has: false },
  legalData: { has: false },
  payment: { has: false },
  thirdParty: { has: false },
};

const aStatus: Status = {
  archived: false,
  processing: MessageStatusValueEnum.PROCESSED,
  read: false,
};

const aMessageView: MessageView = {
  components: aComponents,
  createdAt: new Date(),
  fiscalCode: "AAAAAA00A00A000A" as FiscalCode,
  id: "a-unique-msg-id" as NonEmptyString,
  messageTitle: "a-msg-title" as NonEmptyString,
  senderServiceId: "a-service-id" as ServiceId,
  status: aStatus,
  timeToLive: 3600 as TimeToLiveSeconds,
  version: 0 as NonNegativeInteger,
};

const aRetrievedMessageView: RetrievedMessageView = {
  ...aMessageView,
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
};

const aDueDate = "2022-01-01T00:00:00.000Z";

const mockFetchAll = vi.fn();
const mockGetAsyncIterator = vi.fn();
const mockCreate = vi.fn();

const containerMock = {
  items: {
    create: mockCreate,
    query: vi.fn(() => ({
      fetchAll: mockFetchAll,
    })),
    readAll: vi.fn(() => ({
      fetchAll: mockFetchAll,
      getAsyncIterator: mockGetAsyncIterator,
    })),
  },
} as unknown as Container;

const aNoticeNumber = "177777777777777777";

describe("message_view", () => {
  it("GIVEN a valid message_view object WHEN the object is decode THEN the decode succeed", async () => {
    const result = MessageView.decode(aMessageView);
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a valid message_view object with thirdParty WHEN the object does not contain a valid id THEN the decode fails", async () => {
    const messageViewWithThirdParty = {
      ...aMessageView,
      components: {
        ...aMessageView.components,
        thirdParty: {
          has: true,
          id: "",
        },
      },
    };
    const result = MessageView.decode(messageViewWithThirdParty);
    expect(E.isLeft(result)).toBeTruthy();
  });

  it("GIVEN a valid message_view object with thirdParty WHEN the object contain an invalid configuration_id THEN the decode fails", async () => {
    const messageViewWithThirdParty = {
      ...aMessageView,
      components: {
        ...aMessageView.components,
        thirdParty: {
          configuration_id: "anInvalidUlid",
          has: true,
          id: "AN_ID",
        },
      },
    };
    const result = MessageView.decode(messageViewWithThirdParty);
    expect(E.isLeft(result)).toBeTruthy();
  });

  it("GIVEN a valid message_view object with thirdParty WHEN the object contains a valid configuration_id THEN the decode succeed", async () => {
    const messageViewWithThirdParty = {
      ...aMessageView,
      components: {
        ...aMessageView.components,
        thirdParty: {
          configuration_id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
          has: true,
          id: "AN_ID",
        },
      },
    };
    pipe(
      messageViewWithThirdParty,
      MessageView.decode,
      E.mapLeft((_) => fail(errorsToReadableMessages(_))),
      E.map((decoded) => {
        expect(decoded).toEqual({
          ...messageViewWithThirdParty,
          components: {
            ...messageViewWithThirdParty.components,
            thirdParty: {
              ...messageViewWithThirdParty.components.thirdParty,
              has_attachments: false,
              has_remote_content: false,
            },
          },
        });
      }),
    );
  });

  it("GIVEN a valid message_view object with thirdParty WHEN the object contains a valid id THEN the decode succeed", async () => {
    const messageViewWithThirdParty = {
      ...aMessageView,
      components: {
        ...aMessageView.components,
        thirdParty: {
          has: true,
          id: "AN_ID",
        },
      },
    };
    pipe(
      messageViewWithThirdParty,
      MessageView.decode,
      E.mapLeft((_) => fail(errorsToReadableMessages(_))),
      E.map((decoded) => {
        expect(decoded).toEqual({
          ...messageViewWithThirdParty,
          components: {
            ...messageViewWithThirdParty.components,
            thirdParty: {
              ...messageViewWithThirdParty.components.thirdParty,
              has_attachments: false,
              has_remote_content: false,
            },
          },
        });
      }),
    );
  });

  it("GIVEN a valid message_view object with payment WHEN the object does not contain a valid paymentStatus THEN the decode fails", async () => {
    const messageViewWithPayment = {
      ...aMessageView,
      components: {
        ...aMessageView.components,
        payment: {
          has: true,
          notice_number: aNoticeNumber,
          payment_status: "WRONG",
        },
      },
    };
    const result = MessageView.decode(messageViewWithPayment);
    expect(E.isLeft(result)).toBeTruthy();
  });

  it("GIVEN a valid message_view object with payment WHEN the object contains a valid paymentStatus THEN the decode succeed", async () => {
    const messageViewWithPayment = {
      ...aMessageView,
      components: {
        ...aMessageView.components,
        payment: { has: true, notice_number: aNoticeNumber },
      },
    };
    pipe(
      messageViewWithPayment,
      MessageView.decode,
      E.mapLeft((_) => fail(errorsToReadableMessages(_))),
      E.map((decoded) => {
        expect(decoded).toEqual({
          ...messageViewWithPayment,
          components: {
            ...messageViewWithPayment.components,
            payment: {
              ...messageViewWithPayment.components.payment,
              payment_status: PaymentStatusEnum.NOT_PAID,
            },
          },
        });
      }),
    );
  });

  it("GIVEN a valid message_view object with payment WHEN due_date is set THEN the decode succeed", async () => {
    const messageViewWithPayment = {
      ...aMessageView,
      components: {
        ...aMessageView.components,
        payment: {
          due_date: aDueDate,
          has: true,
          notice_number: aNoticeNumber,
        },
      },
    };
    pipe(
      messageViewWithPayment,
      MessageView.decode,
      E.mapLeft((_) => fail(errorsToReadableMessages(_))),
      E.map((decoded) => {
        expect(decoded).toEqual({
          ...messageViewWithPayment,
          components: {
            ...messageViewWithPayment.components,
            payment: {
              ...messageViewWithPayment.components.payment,
              due_date: new Date(aDueDate),
              payment_status: PaymentStatusEnum.NOT_PAID,
            },
          },
        });
      }),
    );
  });

  it("GIVEN a message_view object with a missing notice_number payment WHEN the object is decode THEN the decode fails", async () => {
    const messageViewWithPayment = {
      ...aMessageView,
      components: {
        ...aMessageView.components,
        payment: { has: true },
      },
    };
    const result = MessageView.decode(messageViewWithPayment);
    expect(E.isLeft(result)).toBeTruthy();
  });

  it("GIVEN a message_view object with a notice_number-only payment WHEN the object is decode THEN the decoded object do not contains a notice_number", async () => {
    const messageViewWithPayment = {
      ...aMessageView,
      components: {
        ...aMessageView.components,
        payment: { has: false, notice_number: aNoticeNumber },
      },
    };
    const result = MessageView.decode(messageViewWithPayment);
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right.components.payment).toEqual(
        expect.not.objectContaining({
          notice_number: aNoticeNumber,
        }),
      );
    }
  });

  it("GIVEN a valid message_view without third party object WHEN the object is decode THEN the decode succeed", async () => {
    const { thirdParty, ...componentsWithoutThirdParty } = aComponents;

    const result = MessageView.decode({
      ...aMessageView,
      components: componentsWithoutThirdParty,
    });
    expect(E.isRight(result)).toBeTruthy();
  });
});

describe("create", () => {
  it("GIVEN a valid message_view WHEN the client create is called THEN the create return a Right", async () => {
    mockCreate.mockImplementationOnce((_, __) =>
      Promise.resolve({
        resource: { ...aRetrievedMessageView },
      }),
    );
    const model = new MessageViewModel(containerMock);
    const result = await model.create(aMessageView)();
    expect(mockCreate).toBeCalledWith();
    expect(mockCreate).toBeCalledWith(
      JSON.parse(JSON.stringify(aMessageView)),
      expect.objectContaining({}),
    );
    expect(E.isRight(result)).toBeTruthy();
  });
});
