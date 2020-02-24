import { NonEmptyString } from "italia-ts-commons/lib/strings";

import { FiscalCode } from "../../generated/definitions/FiscalCode";
import { NotificationStatusId } from "../models/notification_status";
import { UserDataProcessingId } from "../models/user_data_processing";
import { ModelId } from "./documentdb_model_versioned";

/**
 * Converts a FiscalCode to a ModelId.
 *
 * Note that this is always possible since a valid FiscalCode is
 * also a valid ModelId.
 */
export function fiscalCodeToModelId(o: FiscalCode): ModelId {
  return (o as string) as ModelId;
}

/**
 * Converts a NonEmptyString to a ModelId.
 *
 * Note that this is always possible since a valid NonEmptyString is
 * also a valid ModelId.
 */
export function nonEmptyStringToModelId(o: NonEmptyString): ModelId {
  return (o as string) as ModelId;
}

/**
 * Converts a NotificationStatusId to a ModelId.
 *
 * Note that this is always possible since a valid NotificationStatusId is
 * also a valid ModelId.
 */
export function notificationStatusIdToModelId(
  o: NotificationStatusId
): ModelId {
  return (o as string) as ModelId;
}

/**
 * Converts a UserDataProcessingId to a ModelId.
 *
 * Note that this is always possible since a valid UserDataProcessingId is
 * also a valid ModelId.
 */
export function userDataProcessingIdToModelId(
  o: UserDataProcessingId
): ModelId {
  return (o as string) as ModelId;
}
