// tslint:disable:no-any

import { CreatedMessageEvent } from "../created_message_event";

import { isRight } from "fp-ts/lib/Either";
import { MessageBodyMarkdown } from "../../../generated/definitions/MessageBodyMarkdown";

const aMessageBodyMarkdown = "test".repeat(80) as MessageBodyMarkdown;

describe("", () => {
  it("should validate valid events CreatedMessageEvents", () => {
    const payloads: ReadonlyArray<any> = [
      {
        content: {
          markdown: aMessageBodyMarkdown,
          subject: "test".repeat(10)
        },
        defaultAddresses: { email: "federico@teamdigitale.governo.it" },
        message: {
          _attachments: "attachments/",
          _etag: '"0000f431-0000-0000-0000-59bffc380000"',
          _rid: "LgNRANj9nwBgAAAAAAAAAA==",
          _self:
            "dbs/LgNRAA==/colls/LgNRANj9nwA=/docs/LgNRANj9nwBgAAAAAAAAAA==/",
          _ts: 1505754168,
          createdAt: new Date().toISOString(),
          fiscalCode: "FRLFRC73E04B157I",
          id: "01BTAZ2HS1PWDJERA510FDXYV4",
          indexedId: "01BTAZ2HS1PWDJERA510FDXYV4",
          kind: "RetrievedMessage",
          senderServiceId: "test",
          senderUserId: "u123"
        },
        senderMetadata: {
          departmentName: "IT",
          organizationFiscalCode: "00000000000",
          organizationName: "AgID",
          requireSecureChannels: false,
          serviceName: "Test"
        },
        serviceVersion: 1
      }
    ];
    payloads.forEach(payload => {
      const event = CreatedMessageEvent.decode(payload);
      expect(isRight(event)).toBeTruthy();
    });
  });
});
