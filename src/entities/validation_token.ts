/**
 * Describe the entity stored in the ValidationTokens storage table
 */

import * as t from "io-ts";

import { UTCISODateFromString } from "italia-ts-commons/lib/dates";
import { EmailAddress } from "../../generated/definitions/EmailAddress";
import { FiscalCode } from "../../generated/definitions/FiscalCode";
import { TableEntity } from "../utils/azure_storage";

export const VALIDATION_TOKEN_TABLE_NAME = "ValidationTokens";

/**
 * Used to describe properties of the ValidationToken storage table.
 * By convention storage table properties uses PascalCase.
 */
export const ValidationToken = t.interface({
  Email: EmailAddress,
  FiscalCode,
  InvalidAfter: UTCISODateFromString
});

export const ValidationTokenEntity = t.intersection([
  ValidationToken,
  TableEntity
]);

export type ValidationTokenEntity = t.TypeOf<typeof ValidationTokenEntity>;
