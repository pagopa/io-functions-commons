import * as t from "io-ts";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Container } from "@azure/cosmos";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode } from "../../generated/definitions/FiscalCode";
import { MessageStatusValue } from "../../generated/definitions/MessageStatusValue";
import { ServiceId } from "../../generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "../../generated/definitions/TimeToLiveSeconds";
import { Timestamp } from "../../generated/definitions/Timestamp";
import { CosmosResource, CosmosdbModel } from "../utils/cosmosdb_model";

export const MESSAGE_VIEW_COLLECTION_NAME = "message-view";
const MESSAGE_VIEW_MODEL_PK_FIELD = "fiscalCode";

export const Component = t.interface({
  has: t.boolean
});
export type Component = t.TypeOf<typeof Component>;

export const PaymentComponent = t.intersection([
  Component,
  t.interface({ rptId: t.string })
]);
export type PaymentComponent = t.TypeOf<typeof PaymentComponent>;

export const Components = t.interface({
  attachments: Component,
  euCovidCert: Component,
  legalData: Component,
  payment: PaymentComponent
});
export type Components = t.TypeOf<typeof Components>;

export const Status = t.interface({
  archived: t.boolean,
  processing: MessageStatusValue,
  read: t.boolean
});
export type Status = t.TypeOf<typeof Status>;

const MessageViewR = t.interface({
  components: Components,
  createdAt: Timestamp,
  fiscalCode: FiscalCode,
  id: NonEmptyString,
  messageTitle: NonEmptyString,
  organizationName: NonEmptyString,
  senderServiceId: ServiceId,
  serviceName: NonEmptyString,
  status: Status,
  version: NonNegativeInteger
});

const MessageViewO = t.partial({
  timeToLive: TimeToLiveSeconds
});

export const MessageView = t.intersection([MessageViewR, MessageViewO]);
export type MessageView = t.TypeOf<typeof MessageView>;

export const RetrievedMessageView = t.intersection([
  MessageView,
  CosmosResource
]);
export type RetrievedMessageView = t.TypeOf<typeof RetrievedMessageView>;

export class MessageViewModel extends CosmosdbModel<
  MessageView,
  MessageView,
  RetrievedMessageView,
  typeof MESSAGE_VIEW_MODEL_PK_FIELD
> {
  /**
   * Creates a new Message model
   *
   * @param container the Cosmos container client
   */
  constructor(
    container: Container,
    protected readonly containerName: NonEmptyString
  ) {
    super(container, MessageView, RetrievedMessageView);
  }
}
