import * as t from "io-ts";

import { tag } from "italia-ts-commons/lib/types";

import {
  CosmosdbModelVersioned,
  VersionedModel
} from "../utils/cosmosdb_model_versioned";

import { Container } from "@azure/cosmos";
import { Option } from "fp-ts/lib/Option";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { FiscalCode } from "../../generated/definitions/FiscalCode";
import { Timestamp } from "../../generated/definitions/Timestamp";
import { UserDataProcessingChoice } from "../../generated/definitions/UserDataProcessingChoice";
import { UserDataProcessingStatus } from "../../generated/definitions/UserDataProcessingStatus";
import { BaseModel, CosmosErrors } from "../utils/cosmosdb_model";
import { wrapWithKind } from "../utils/types";

export const USER_DATA_PROCESSING_COLLECTION_NAME = "user-data-processing";
export const USER_DATA_PROCESSING_MODEL_PK_FIELD = "fiscalCode";
export const USER_DATA_PROCESSING_MODEL_ID_FIELD = "userDataProcessingId" as const;

interface IUserDataProcessingIdTag {
  readonly kind: "IUserDataProcessingIdTag";
}

export const UserDataProcessingId = tag<IUserDataProcessingIdTag>()(t.string);
export type UserDataProcessingId = t.TypeOf<typeof UserDataProcessingId>;

/**
 * Base interface for User Data Processing objects
 */
export const UserDataProcessing = t.intersection([
  t.interface({
    // the unique identifier of a user data processing request identified by concatenation of
    // fiscalCode - choice
    [USER_DATA_PROCESSING_MODEL_ID_FIELD]: UserDataProcessingId,

    // the fiscal code of the citized associated to this user data processing request
    fiscalCode: FiscalCode,

    // the request choice made by user to download or delete its own data
    choice: UserDataProcessingChoice,

    // the status of the user's request
    status: UserDataProcessingStatus,

    // creation date of this user data processing request
    createdAt: Timestamp
  }),
  t.partial({
    // update date of this user data processing request
    updatedAt: Timestamp
  })
]);

export type UserDataProcessing = t.TypeOf<typeof UserDataProcessing>;

export const NewUserDataProcessing = wrapWithKind(
  UserDataProcessing,
  "INewUserDataProcessing" as const
);

export type NewUserDataProcessing = t.TypeOf<typeof NewUserDataProcessing>;

export const RetrievedUserDataProcessing = wrapWithKind(
  t.intersection([UserDataProcessing, VersionedModel, BaseModel]),
  "IRetrievedUserDataProcessing" as const
);

export type RetrievedUserDataProcessing = t.TypeOf<
  typeof RetrievedUserDataProcessing
>;

export function makeUserDataProcessingId(
  choice: UserDataProcessingChoice,
  fiscalCode: FiscalCode
): UserDataProcessingId {
  return UserDataProcessingId.decode(`${fiscalCode}-${choice}`).getOrElseL(
    () => {
      throw new Error("Invalid User Data Processing id");
    }
  );
}

/**
 * A model for handling UserDataProcessing
 */
export class UserDataProcessingModel extends CosmosdbModelVersioned<
  UserDataProcessing,
  NewUserDataProcessing,
  RetrievedUserDataProcessing
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
      USER_DATA_PROCESSING_MODEL_ID_FIELD
    );
  }

  /**
   * Searches for one user data processing request to the provided id
   *
   * @param id
   * @deprecated Use findLastVersionByModelId
   */
  public findOneUserDataProcessingById(
    fiscalCode: FiscalCode,
    userDataProcessingId: UserDataProcessingId
  ): TaskEither<CosmosErrors, Option<RetrievedUserDataProcessing>> {
    return super.findLastVersionByModelId(userDataProcessingId, fiscalCode);
  }

  public createOrUpdateByNewOne(
    // omit userDataProcessingId from new documents as we create it from the
    // provided object
    userDataProcessing: Omit<
      UserDataProcessing,
      typeof USER_DATA_PROCESSING_MODEL_ID_FIELD
    >
  ): TaskEither<CosmosErrors, RetrievedUserDataProcessing> {
    const newId = makeUserDataProcessingId(
      userDataProcessing.choice,
      userDataProcessing.fiscalCode
    );

    const toUpdate: NewUserDataProcessing = {
      choice: userDataProcessing.choice,
      createdAt: userDataProcessing.createdAt,
      fiscalCode: userDataProcessing.fiscalCode,
      kind: "INewUserDataProcessing",
      status: userDataProcessing.status,
      updatedAt: userDataProcessing.createdAt,
      [USER_DATA_PROCESSING_MODEL_ID_FIELD]: newId
    };
    return this.upsert(toUpdate);
  }
}
