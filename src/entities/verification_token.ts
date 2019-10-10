/**
 * Describe the entity stored in the VerificationTokens storage table
 */

import * as t from "io-ts";

import { UTCISODateFromString } from "italia-ts-commons/lib/dates";
import { FiscalCode } from "../../generated/definitions/FiscalCode";
import { TableEntity } from "../utils/azure_storage";

export const VerificationToken = t.interface({
  ExpireAt: UTCISODateFromString,
  FiscalCode
});

export const VerificationTokenEntity = t.intersection([
  VerificationToken,
  TableEntity
]);

export type VerificationTokenEntity = t.TypeOf<typeof VerificationTokenEntity>;
