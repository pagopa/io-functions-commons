import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { isRight } from "fp-ts/lib/Either";

import { EmailAddress } from "../../../generated/definitions/EmailAddress";
import { MessageBodyMarkdown } from "../../../generated/definitions/MessageBodyMarkdown";
import { MessageContent } from "../../../generated/definitions/MessageContent";
import { MessageSubject } from "../../../generated/definitions/MessageSubject";
import { OrganizationFiscalCode } from "../../../generated/definitions/OrganizationFiscalCode";
import { StandardServiceCategoryEnum } from "../../../generated/definitions/StandardServiceCategory";
import { TimeToLiveSeconds } from "../../../generated/definitions/TimeToLiveSeconds";
import { CreatedMessageEventSenderMetadata } from "../created_message_sender_metadata";
import { NotificationEvent } from "../notification_event";

const aMessageId = "A_MESSAGE_ID" as NonEmptyString;
const aNotificationId = "A_NOTIFICATION_ID" as NonEmptyString;
const anOrganizationFiscalCode = "00000000000" as OrganizationFiscalCode;

const aMessageBodyMarkdown = "test".repeat(80) as MessageBodyMarkdown;

const aMessageContent: MessageContent = {
  markdown: aMessageBodyMarkdown,
  subject: "test".repeat(10) as MessageSubject,
};

const aMessage = {
  createdAt: new Date().toISOString(),
  fiscalCode: "FRLFRC74E04B157I",
  id: aMessageId,
  indexedId: aMessageId,
  kind: "INewMessageWithoutContent",
  senderServiceId: "s123",
  senderUserId: "u123" as NonEmptyString,
  timeToLive: 3600 as TimeToLiveSeconds,
};

const aSenderMetadata: CreatedMessageEventSenderMetadata = {
  departmentName: "IT" as NonEmptyString,
  organizationFiscalCode: anOrganizationFiscalCode,
  organizationName: "AgID" as NonEmptyString,
  requireSecureChannels: false,
  serviceCategory: StandardServiceCategoryEnum.STANDARD,
  serviceName: "Test" as NonEmptyString,
  serviceUserEmail: "email@example.com" as EmailAddress,
};

describe("isNotificationEvent", () => {
  it("should return true for valid payloads", () => {
    const fixtures: readonly any[] = [
      {
        content: aMessageContent,
        message: aMessage,
        notificationId: aNotificationId,
        senderMetadata: aSenderMetadata,
      },
    ];

    fixtures.forEach((f) => {
      const errorOrNotification = NotificationEvent.decode(f);
      expect(isRight(errorOrNotification)).toBeTruthy();
    });
  });

  it("should return false for invalid payloads", () => {
    const fixtures: readonly any[] = [
      undefined,
      null,
      {},
      {
        messageId: aMessageId,
        notificationId: aNotificationId,
        senderMetadata: aSenderMetadata,
      },
      {
        messageContent: aMessageContent,
        notificationId: aNotificationId,
        senderMetadata: aSenderMetadata,
      },
      {
        messageContent: aMessageContent,
        messageId: aMessageId,
        senderMetadata: aSenderMetadata,
      },
      {
        messageContent: aMessageContent,
        messageId: aMessageId,
        notificationId: aNotificationId,
      },
    ];

    fixtures.forEach((f) => {
      const errorOrNotification = NotificationEvent.decode(f);
      expect(isRight(errorOrNotification)).toBeFalsy();
    });
  });
});
