import { Container } from "@azure/cosmos";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import { TaskEither } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";

import { FiscalCode } from "../../generated/definitions/FiscalCode";
import { Timestamp } from "../../generated/definitions/Timestamp";
import { UserDataProcessingChoice } from "../../generated/definitions/UserDataProcessingChoice";
import {
  UserDataProcessingStatus,
  UserDataProcessingStatusEnum,
} from "../../generated/definitions/UserDataProcessingStatus";
import { CosmosErrors } from "../utils/cosmosdb_model";
import {
  CosmosdbModelVersioned,
  RetrievedVersionedModel,
} from "../utils/cosmosdb_model_versioned";
import { wrapWithKind } from "../utils/types";

export const USER_DATA_PROCESSING_COLLECTION_NAME = "user-data-processing";
export const USER_DATA_PROCESSING_MODEL_PK_FIELD = "fiscalCode" as const;
export const USER_DATA_PROCESSING_MODEL_ID_FIELD =
  "userDataProcessingId" as const;

/**
 * Ensure UserDataProcessing IDs are in correct shape
 * The unique identifier of a user data processing request identified by concatenation offiscalCode - choice
 */
export type UserDataProcessingId = t.TypeOf<typeof UserDataProcessingId>;
export const UserDataProcessingId = t.brand(
  t.string,
  (
    s: string,
  ): s is t.Branded<string, { readonly IUserDataProcessingIdTag: symbol }> => {
    // enforce pattern {fiscalCode-Choice}
    const [fiscalCode, choice] = s.split("-");
    return (
      E.isRight(FiscalCode.decode(fiscalCode)) &&
      E.isRight(UserDataProcessingChoice.decode(choice))
    );
  },
  "IUserDataProcessingIdTag",
);

/**
 * Base interface for User Data Processing objects
 */
export const UserDataProcessing = t.intersection([
  t.interface({
    // the request choice made by user to download or delete its own data
    choice: UserDataProcessingChoice,

    // creation date of this user data processing request
    createdAt: Timestamp,

    // the fiscal code of the citized associated to this user data processing request
    fiscalCode: FiscalCode,

    // the status of the user's request
    status: UserDataProcessingStatus,

    // the unique identifier of a user data processing request identified by concatenation of
    // fiscalCode - choice
    [USER_DATA_PROCESSING_MODEL_ID_FIELD]: UserDataProcessingId,
  }),
  t.partial({
    // an optional string field in which store a descriptive error message in case of a FAILED processing
    //   it should be modelled for FAILED records only using a disjointed union on the status field
    //   it turns out it would introduce unwanted complexity, so we rather sacrifice type-soundness in favor of usability
    reason: NonEmptyString,
    // update date of this user data processing request
    updatedAt: Timestamp,
  }),
]);

export type UserDataProcessing = t.TypeOf<typeof UserDataProcessing>;

export const NewUserDataProcessing = wrapWithKind(
  UserDataProcessing,
  "INewUserDataProcessing" as const,
);

export type NewUserDataProcessing = t.TypeOf<typeof NewUserDataProcessing>;

export const RetrievedUserDataProcessing = wrapWithKind(
  t.intersection([UserDataProcessing, RetrievedVersionedModel]),
  "IRetrievedUserDataProcessing" as const,
);

export type RetrievedUserDataProcessing = t.TypeOf<
  typeof RetrievedUserDataProcessing
>;

export const makeUserDataProcessingId = (
  choice: UserDataProcessingChoice,
  fiscalCode: FiscalCode,
): UserDataProcessingId =>
  pipe(
    UserDataProcessingId.decode(`${fiscalCode}-${choice}`),
    E.getOrElseW((errors) => {
      throw new Error(
        `Invalid User Data Processing id, reason: ${readableReport(errors)}`,
      );
    }),
  );

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
      USER_DATA_PROCESSING_MODEL_PK_FIELD,
    );
  }

  public createOrUpdateByNewOne(
    // omit userDataProcessingId from new documents as we create it from the
    // provided object
    userDataProcessing: Omit<
      UserDataProcessing,
      typeof USER_DATA_PROCESSING_MODEL_ID_FIELD
    >,
  ): TaskEither<CosmosErrors, RetrievedUserDataProcessing> {
    const newId = makeUserDataProcessingId(
      userDataProcessing.choice,
      userDataProcessing.fiscalCode,
    );

    const toUpdate: NewUserDataProcessing = {
      ...userDataProcessing,
      kind: "INewUserDataProcessing",
      // In order to keep data clean, we skim reason field if status is different than FAILED
      [USER_DATA_PROCESSING_MODEL_ID_FIELD]: newId,
    };
    return this.upsert(toUpdate);
  }

  protected beforeSave(o: UserDataProcessing): UserDataProcessing {
    const { reason, status, ...rest } = o;
    return {
      ...rest,
      status,
      // In order to keep data clean, we skim reason field if status is different than FAILED
      ...(status === UserDataProcessingStatusEnum.FAILED ? { reason } : {}),
    };
  }
}
