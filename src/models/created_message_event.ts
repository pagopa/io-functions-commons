/**
 * Payload of a created message event.
 *
 * This event gets triggered on new message creation by the
 * Messages API.
 */

import { NonNegativeNumber } from "@pagopa/ts-commons/lib/numbers";
import * as t from "io-ts";

import { MessageContent } from "../../generated/definitions/v2/MessageContent";
import { NewMessageDefaultAddresses } from "../../generated/definitions/v2/NewMessageDefaultAddresses";

import { NewMessageWithoutContent } from "./message";

import { CreatedMessageEventSenderMetadata } from "./created_message_sender_metadata";

const CreatedMessageEventR = t.interface({
  content: MessageContent,
  message: NewMessageWithoutContent,
  senderMetadata: CreatedMessageEventSenderMetadata,
  serviceVersion: NonNegativeNumber
});

const CreatedMessageEventO = t.partial({
  defaultAddresses: NewMessageDefaultAddresses
});

export const CreatedMessageEvent = t.intersection(
  [CreatedMessageEventR, CreatedMessageEventO],
  "CreatedMessageEvent"
);

export type CreatedMessageEvent = t.TypeOf<typeof CreatedMessageEvent>;
