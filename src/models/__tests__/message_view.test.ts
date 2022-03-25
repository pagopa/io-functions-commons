import * as E from "fp-ts/lib/Either";

import { Container } from "@azure/cosmos";
import {
  FiscalCode,
  NonEmptyString,
  OrganizationFiscalCode
} from "@pagopa/ts-commons/lib/strings";
import {
  MessageView,
  RetrievedMessageView,
  Components,
  Status
} from "../message_view";
import { ServiceId } from "../../../generated/definitions/ServiceId";
import { MessageStatusValueEnum } from "../../../generated/definitions/MessageStatusValue";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { MessageViewModel } from "../message_view";

const aComponents: Components = {
  attachments: { has: false },
  euCovidCert: { has: false },
  legalData: { has: false },
  payment: { has: false }
};

const aStatus: Status = {
  archived: false,
  processing: MessageStatusValueEnum.PROCESSED,
  read: false
};

const aMessageView: MessageView = {
  components: aComponents,
  createdAt: new Date(),
  fiscalCode: "AAAAAA00A00A000A" as FiscalCode,
  id: "a-unique-msg-id" as NonEmptyString,
  messageTitle: "a-msg-title" as NonEmptyString,
  senderServiceId: "a-service-id" as ServiceId,
  status: aStatus,
  version: 0 as NonNegativeInteger
};

const aRetrievedMessageView: RetrievedMessageView = {
  ...aMessageView,
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};

const mockFetchAll = jest.fn();
const mockGetAsyncIterator = jest.fn();
const mockCreate = jest.fn();

const containerMock = ({
  items: {
    readAll: jest.fn(() => ({
      fetchAll: mockFetchAll,
      getAsyncIterator: mockGetAsyncIterator
    })),
    create: mockCreate,
    query: jest.fn(() => ({
      fetchAll: mockFetchAll
    }))
  }
} as unknown) as Container;

const aNoticeNumber = "177777777777777777";

describe("message_view", () => {
  it("GIVEN a valid message_view obejct WHEN the object is decode THEN the decode succeed", async () => {
    const result = MessageView.decode(aMessageView);
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a valid message_view obejct with payment WHEN the object is decode THEN the decode succeed", async () => {
    const messageViewWithPayment = {
      ...aMessageView,
      components: {
        ...aMessageView.components,
        payment: { has: true, notice_number: aNoticeNumber }
      }
    };
    const result = MessageView.decode(messageViewWithPayment);
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a message_view obejct with a missing notice_number payment WHEN the object is decode THEN the decode fails", async () => {
    const messageViewWithPayment = {
      ...aMessageView,
      components: {
        ...aMessageView.components,
        payment: { has: true }
      }
    };
    const result = MessageView.decode(messageViewWithPayment);
    expect(E.isLeft(result)).toBeTruthy();
  });

  it("GIVEN a message_view obejct with a notice_number-only payment WHEN the object is decode THEN the decode fails", async () => {
    const messageViewWithPayment = {
      ...aMessageView,
      components: {
        ...aMessageView.components,
        payment: { has: false, notice_number: aNoticeNumber }
      }
    };
    const result = MessageView.decode(messageViewWithPayment);
    expect(E.isRight(result)).toBeTruthy();
  });
});

describe("create", () => {
  it("GIVEN a valid message_view WHEN the client create is called THEN the create return a Right", async () => {
    mockCreate.mockImplementationOnce((_, __) =>
      Promise.resolve({
        resource: { ...aRetrievedMessageView }
      })
    );
    const model = new MessageViewModel(containerMock);
    const result = await model.create(aMessageView)();
    expect(mockCreate).toBeCalled();
    expect(mockCreate).toBeCalledWith(
      JSON.parse(JSON.stringify(aMessageView)),
      expect.objectContaining({})
    );
    expect(E.isRight(result)).toBeTruthy();
  });
});
