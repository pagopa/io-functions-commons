/**
 * Describe the entity stored in the ValidationTokens storage table
 */

import * as t from "io-ts";

import { UTCISODateFromString } from "@pagopa/ts-commons/lib/dates";
import { EmailAddress } from "../../generated/definitions/EmailAddress";
import { FiscalCode } from "../../generated/definitions/FiscalCode";
import { TableEntityAzureDataTables } from "../utils/data_tables";
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

/**
 * Used to describe properties of the ValidationTokenEntity obtained with `azure-storage`.
 * For the newest `@azure/data-tables`, see `ValidationTokenEntityAzureDataTables`
 */
export const ValidationTokenEntity = t.intersection([
  ValidationToken,
  TableEntity
]);

export type ValidationTokenEntity = t.TypeOf<typeof ValidationTokenEntity>;

/**
 * Used to describe properties of the ValidationTokenEntity obtained with `@azure/data-tables`.
 */
export const ValidationTokenEntityAzureDataTables = t.intersection([
  ValidationToken,
  TableEntityAzureDataTables
]);

export type ValidationTokenEntityAzureDataTables = t.TypeOf<
  typeof ValidationTokenEntityAzureDataTables
>;
