/**
 * Describe the entity stored in the ValidationTokens storage table
 */

import * as t from "io-ts";

import { UTCISODateFromString } from "@pagopa/ts-commons/lib/dates";
import { EmailAddress } from "../../generated/definitions/EmailAddress";
import { FiscalCode } from "../../generated/definitions/FiscalCode";
import { TableEntityAzureStorage } from "../utils/azure_storage";
import { TableEntity } from "../utils/data_tables";

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

export const ValidationTokenEntityAzureStorage = t.intersection([
  ValidationToken,
  TableEntityAzureStorage
]);

/**
 * Type to be used with `@azure/data-tables`
 */
export type ValidationTokenEntity = t.TypeOf<typeof ValidationTokenEntity>;

/**
 * Type to be used with the deprecated `azure-storage`
 */
export type ValidationTokenEntityAzureStorage = t.TypeOf<
  typeof ValidationTokenEntityAzureStorage
>;
