/**
 * Describe the entity stored in the ValidationTokens storage table
 */

import { UTCISODateFromString } from "@pagopa/ts-commons/lib/dates";
import * as t from "io-ts";

import { EmailAddress } from "../../generated/definitions/EmailAddress";
import { FiscalCode } from "../../generated/definitions/FiscalCode";
import { TableEntity } from "../utils/azure_storage";
import { TableEntityAzureDataTables } from "../utils/data_tables";

export const VALIDATION_TOKEN_TABLE_NAME = "ValidationTokens";

/**
 * Used to describe properties of the ValidationToken storage table.
 * By convention storage table properties uses PascalCase.
 */
export const ValidationToken = t.interface({
  Email: EmailAddress,
  FiscalCode,
  InvalidAfter: UTCISODateFromString,
});

/**
 * Used to describe properties of the ValidationTokenEntity obtained with `azure-storage`.
 * For the newest `@azure/data-tables`, see `ValidationTokenEntityAzureDataTables`
 */
export const ValidationTokenEntity = t.intersection([
  ValidationToken,
  TableEntity,
]);

export type ValidationTokenEntity = t.TypeOf<typeof ValidationTokenEntity>;

/**
 * Used to describe properties of the ValidationTokenEntity obtained with `@azure/data-tables`.
 */
export const ValidationTokenEntityAzureDataTables = t.intersection([
  ValidationToken,
  TableEntityAzureDataTables,
]);

export type ValidationTokenEntityAzureDataTables = t.TypeOf<
  typeof ValidationTokenEntityAzureDataTables
>;
