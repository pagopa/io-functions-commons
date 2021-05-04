import * as t from "io-ts";

import { withDefault } from "@pagopa/ts-commons/lib/types";

import { Container } from "@azure/cosmos";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  CosmosdbModelVersioned,
  RetrievedVersionedModel
} from "../utils/cosmosdb_model_versioned";
import { FiscalCode } from "../../generated/definitions/FiscalCode";
import { Timestamp } from "../../generated/definitions/Timestamp";
import { UserDataProcessingChoice } from "../../generated/definitions/UserDataProcessingChoice";
import {
  UserDataProcessingStatus,
  UserDataProcessingStatusEnum
} from "../../generated/definitions/UserDataProcessingStatus";
import { CosmosErrors } from "../utils/cosmosdb_model";
import { wrapWithKind } from "../utils/types";

export const USER_DATA_PROCESSING_COLLECTION_NAME = "user-data-processing";
export const USER_DATA_PROCESSING_MODEL_PK_FIELD = "fiscalCode" as const;
export const USER_DATA_PROCESSING_MODEL_ID_FIELD = "userDataProcessingId" as const;

/**
 * Ensure UserDataProcessing IDs are in correct shape
 * The unique identifier of a user data processing request identified by concatenation offiscalCode - choice
 */
export type UserDataProcessingId = t.TypeOf<typeof UserDataProcessingId>;
export const UserDataProcessingId = t.brand(
  t.string,
  (
    s: string
  ): s is t.Branded<string, { readonly IUserDataProcessingIdTag: symbol }> => {
    // enforce pattern {fiscalCode-Choice}
    const [fiscalCode, choice] = s.split("-");
    return (
      FiscalCode.decode(fiscalCode).isRight() &&
      UserDataProcessingChoice.decode(choice).isRight()
    );
  },
  "IUserDataProcessingIdTag"
);

/**
 * Base interface for User Data Processing objects
 * For convenience, IT DOES NOT HAVE ID FIELD (it will be added later).
 * This is because we need a version of UserDataProcessing WITHOUT the ID, and Omit<> won't work as expected
 */
const CommonUserDataProcessing = t.intersection([
  t.interface({
    // the request choice made by user to download or delete its own data
    choice: UserDataProcessingChoice,

    // creation date of this user data processing request
    createdAt: Timestamp,

    // the fiscal code of the citized associated to this user data processing request
    fiscalCode: FiscalCode,

    // the status of the user's request
    status: UserDataProcessingStatus
  }),
  t.partial({
    // update date of this user data processing request
    updatedAt: Timestamp
  })
]);

/**
 * A reason field is needed (and accepted) only on records of status FAILED
 */
const WithFailureReason = t.union([
  t.partial({
    // we might want not to enumerate all status but FAILED,
    // we'd like to just say "any status but FAILED"
    // so far, we have no solution but the following
    reason: t.void,
    status: t.union([
      t.literal(UserDataProcessingStatusEnum.ABORTED),
      t.literal(UserDataProcessingStatusEnum.CLOSED),
      t.literal(UserDataProcessingStatusEnum.PENDING),
      t.literal(UserDataProcessingStatusEnum.WIP)
    ])
  }),
  t.interface({
    reason: withDefault(NonEmptyString, "no reason found" as NonEmptyString),
    status: t.literal(UserDataProcessingStatusEnum.FAILED)
  })
]);

export type UserDataProcessingWithoutId = t.TypeOf<
  typeof UserDataProcessingWithoutId
>;
export const UserDataProcessingWithoutId = t.intersection([
  CommonUserDataProcessing,
  WithFailureReason
]);

export type UserDataProcessing = t.TypeOf<typeof UserDataProcessing>;
export const UserDataProcessing = t.intersection([
  UserDataProcessingWithoutId,
  t.interface({
    [USER_DATA_PROCESSING_MODEL_ID_FIELD]: UserDataProcessingId
  })
]);

export const NewUserDataProcessing = wrapWithKind(
  UserDataProcessing,
  "INewUserDataProcessing" as const
);

export type NewUserDataProcessing = t.TypeOf<typeof NewUserDataProcessing>;

export const RetrievedUserDataProcessing = wrapWithKind(
  t.intersection([UserDataProcessing, RetrievedVersionedModel]),
  "IRetrievedUserDataProcessing" as const
);

export type RetrievedUserDataProcessing = t.TypeOf<
  typeof RetrievedUserDataProcessing
>;

export const makeUserDataProcessingId = (
  choice: UserDataProcessingChoice,
  fiscalCode: FiscalCode
): UserDataProcessingId =>
  UserDataProcessingId.decode(`${fiscalCode}-${choice}`).getOrElseL(errors => {
    throw new Error(
      `Invalid User Data Processing id, reason: ${readableReport(errors)}`
    );
  });

/**
 * A model for handling UserDataProcessing
 */
export class UserDataProcessingModel extends CosmosdbModelVersioned<
  UserDataProcessing,
  NewUserDataProcessing,
  RetrievedUserDataProcessing,
  typeof USER_DATA_PROCESSING_MODEL_ID_FIELD,
  typeof USER_DATA_PROCESSING_MODEL_PK_FIELD
> {
  /**
   * Creates a new User Data Processing model
   *
   * @param dbClient the DocumentDB client
   * @param collectionUrl the collection URL
   */
  constructor(container: Container) {
    super(
      container,
      NewUserDataProcessing,
      RetrievedUserDataProcessing,
      USER_DATA_PROCESSING_MODEL_ID_FIELD,
      USER_DATA_PROCESSING_MODEL_PK_FIELD
    );
  }

  public createOrUpdateByNewOne(
    // omit userDataProcessingId from new documents as we create it from the
    // provided object
    userDataProcessing: UserDataProcessingWithoutId
  ): TaskEither<CosmosErrors, RetrievedUserDataProcessing> {
    const newId = makeUserDataProcessingId(
      userDataProcessing.choice,
      userDataProcessing.fiscalCode
    );

    const toUpdate: NewUserDataProcessing = {
      ...userDataProcessing,
      [USER_DATA_PROCESSING_MODEL_ID_FIELD]: newId,
      kind: "INewUserDataProcessing"
    };
    return this.upsert(toUpdate);
  }
}
