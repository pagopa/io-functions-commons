/* tslint:disable:no-any */
/* tslint:disable:no-null-keyword */

import { NonEmptyString } from "italia-ts-commons/lib/strings";

import { MessageBodyMarkdown } from "../../../generated/definitions/MessageBodyMarkdown";

import { NotificationEvent } from "../notification_event";

import { MessageContent } from "../../../generated/definitions/MessageContent";

import { isRight } from "fp-ts/lib/Either";
import { MessageSubject } from "../../../generated/definitions/MessageSubject";
import { OrganizationFiscalCode } from "../../../generated/definitions/OrganizationFiscalCode";
import { TimeToLiveSeconds } from "../../../generated/definitions/TimeToLiveSeconds";
import { CreatedMessageEventSenderMetadata } from "../created_message_sender_metadata";

const aMessageId = "A_MESSAGE_ID" as NonEmptyString;
const aNotificationId = "A_NOTIFICATION_ID" as NonEmptyString;
const anOrganizationFiscalCode = "00000000000" as OrganizationFiscalCode;

const aMessageBodyMarkdown = "test".repeat(80) as MessageBodyMarkdown;

const aMessageContent: MessageContent = {
  markdown: aMessageBodyMarkdown,
  subject: "test".repeat(10) as MessageSubject
};

const aMessage = {
  createdAt: new Date().toISOString(),
  fiscalCode: "FRLFRC74E04B157I",
  id: aMessageId,
  indexedId: aMessageId,
  kind: "INewMessageWithoutContent",
  senderServiceId: "s123",
  senderUserId: "u123" as NonEmptyString,
  timeToLive: 3600 as TimeToLiveSeconds
};

const aSenderMetadata: CreatedMessageEventSenderMetadata = {
  departmentName: "IT" as NonEmptyString,
  organizationFiscalCode: anOrganizationFiscalCode,
  organizationName: "AgID" as NonEmptyString,
  requireSecureChannels: false,
  serviceName: "Test" as NonEmptyString
};

describe("isNotificationEvent", () => {
  it("should return true for valid payloads", () => {
    const fixtures: ReadonlyArray<any> = [
      {
        content: aMessageContent,
        message: aMessage,
        notificationId: aNotificationId,
        senderMetadata: aSenderMetadata
      }
    ];

    fixtures.forEach(f => {
      const errorOrNotification = NotificationEvent.decode(f);
      expect(isRight(errorOrNotification)).toBeTruthy();
    });
  });

  it("should return false for invalid payloads", () => {
    const fixtures: ReadonlyArray<any> = [
      undefined,
      null,
      {},
      {
        messageId: aMessageId,
        notificationId: aNotificationId,
        senderMetadata: aSenderMetadata
      },
      {
        messageContent: aMessageContent,
        notificationId: aNotificationId,
        senderMetadata: aSenderMetadata
      },
      {
        messageContent: aMessageContent,
        messageId: aMessageId,
        senderMetadata: aSenderMetadata
      },
      {
        messageContent: aMessageContent,
        messageId: aMessageId,
        notificationId: aNotificationId
      }
    ];

    fixtures.forEach(f => {
      const errorOrNotification = NotificationEvent.decode(f);
      expect(isRight(errorOrNotification)).toBeFalsy();
    });
  });
});
