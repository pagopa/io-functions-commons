import * as t from "io-ts";

import { EmailString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { OrganizationFiscalCode } from "../../generated/definitions/OrganizationFiscalCode";
import { ServiceCategory } from "../../generated/definitions/ServiceCategory";
import { withDefault } from "@pagopa/ts-commons/lib/types";
import { StandardServiceCategoryEnum } from "../../generated/definitions/StandardServiceCategory";

/**
 * Sender metadata associated to a message
 */
export const CreatedMessageEventSenderMetadata = t.interface({
  // withDefault is required for old messages already sent with missing serviceCategory
  // to prevent decode errors on running orchestrators. The default value is STANDARD.
  serviceCategory: withDefault(ServiceCategory, StandardServiceCategoryEnum.STANDARD),
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
