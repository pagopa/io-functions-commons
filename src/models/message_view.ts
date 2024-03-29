import * as t from "io-ts";
import { NonEmptyString, Ulid } from "@pagopa/ts-commons/lib/strings";
import { Container } from "@azure/cosmos";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { enumType, withDefault } from "@pagopa/ts-commons/lib/types";
import { FiscalCode } from "../../generated/definitions/FiscalCode";
import { MessageStatusValue } from "../../generated/definitions/MessageStatusValue";
import { ServiceId } from "../../generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "../../generated/definitions/TimeToLiveSeconds";
import { Timestamp } from "../../generated/definitions/Timestamp";
import { CosmosResource, CosmosdbModel } from "../utils/cosmosdb_model";
import { PaymentNoticeNumber } from "../../generated/definitions/PaymentNoticeNumber";
import {
  PaymentStatus,
  PaymentStatusEnum
} from "../../generated/definitions/PaymentStatus";
import { HasPreconditionEnum } from "../../generated/definitions/HasPrecondition";

export const MESSAGE_VIEW_COLLECTION_NAME = "message-view";
const MESSAGE_VIEW_MODEL_PK_FIELD = "fiscalCode";

const HasComponent = t.interface({ has: t.literal(true) });
const NotHasComponent = t.interface({ has: t.literal(false) });
export type NotHasComponent = t.TypeOf<typeof NotHasComponent>;
export type HasComponent = t.TypeOf<typeof HasComponent>;

export const Component = withDefault(t.union([HasComponent, NotHasComponent]), {
  has: false
});
export type Component = t.TypeOf<typeof Component>;

export const PaymentComponent = t.union([
  t.exact(NotHasComponent),
  t.intersection([
    HasComponent,
    t.interface({
      notice_number: PaymentNoticeNumber,
      payment_status: withDefault(PaymentStatus, PaymentStatusEnum.NOT_PAID)
    }),
    t.partial({
      due_date: Timestamp
    })
  ])
]);

export type PaymentComponent = t.TypeOf<typeof PaymentComponent>;

export const ThirdPartyComponent = t.union([
  t.exact(NotHasComponent),
  t.intersection([
    HasComponent,
    t.interface({
      has_attachments: withDefault(t.boolean, false),
      has_remote_content: withDefault(t.boolean, false),
      id: NonEmptyString
    }),
    t.partial({
      configuration_id: Ulid,
      has_precondition: enumType<HasPreconditionEnum>(
        HasPreconditionEnum,
        "has_precondition"
      ),
      original_receipt_date: Timestamp,
      original_sender: NonEmptyString,
      summary: NonEmptyString
    })
  ])
]);

export type ThirdPartyComponent = t.TypeOf<typeof ThirdPartyComponent>;

export const Components = t.interface({
  attachments: Component,
  euCovidCert: Component,
  legalData: Component,
  payment: PaymentComponent,
  thirdParty: withDefault(ThirdPartyComponent, { has: false })
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
  senderServiceId: ServiceId,
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
   * Creates a new MessageView model
   *
   * @param container the Cosmos container client
   */
  constructor(container: Container) {
    super(container, MessageView, RetrievedMessageView);
  }
}
