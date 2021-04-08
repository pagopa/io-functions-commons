import * as t from "io-ts";

import { EmailString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { OrganizationFiscalCode } from "../../generated/definitions/OrganizationFiscalCode";

/**
 * Sender metadata associated to a message
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const CreatedMessageEventSenderMetadata = t.interface({
  departmentName: NonEmptyString,
  organizationFiscalCode: OrganizationFiscalCode,
  organizationName: NonEmptyString,
  requireSecureChannels: t.boolean,
  serviceName: NonEmptyString,
  serviceUserEmail: EmailString
});

export type CreatedMessageEventSenderMetadata = t.TypeOf<
  typeof CreatedMessageEventSenderMetadata
>;
