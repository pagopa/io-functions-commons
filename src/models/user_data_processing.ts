import * as t from "io-ts";

import { pick, tag } from "italia-ts-commons/lib/types";

import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";
import {
  DocumentDbModelVersioned,
  ModelId,
  VersionedModel
} from "../utils/documentdb_model_versioned";

import { QueryError } from "documentdb";
import { Either } from "fp-ts/lib/Either";
import { Option } from "fp-ts/lib/Option";
import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { FiscalCode } from "../../generated/definitions/FiscalCode";
import { Timestamp } from "../../generated/definitions/Timestamp";
import { UserDataProcessingChoice } from "../../generated/definitions/UserDataProcessingChoice";
import { UserDataProcessingStatus } from "../../generated/definitions/UserDataProcessingStatus";
import { userDataProcessingIdToModelId } from "../utils/conversions";

export const USER_DATA_PROCESSING_COLLECTION_NAME = "user-data-processing";
export const USER_DATA_PROCESSING_MODEL_PK_FIELD = "fiscalCode";
export const USER_DATA_PROCESSING_MODEL_ID_FIELD = "userDataProcessingId";

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
    userDataProcessingId: UserDataProcessingId,

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

/**
 * Interface for new User Data processing objects
 */

interface INewUserDataProcessing {
  readonly kind: "INewUserDataProcessing";
}

export const NewUserDataProcessing = tag<INewUserDataProcessing>()(
  t.intersection([
    UserDataProcessing,
    DocumentDbUtils.NewDocument,
    VersionedModel
  ])
);

export type NewUserDataProcessing = t.TypeOf<typeof NewUserDataProcessing>;

/**
 * Interface for retrieved User Data Processing objects
 *
 * Existing user data processing records have a version number.
 */
interface IRetrievedUserDataProcessing {
  readonly kind: "IRetrievedUserDataProcessing";
}

export const RetrievedUserDataProcessing = tag<IRetrievedUserDataProcessing>()(
  t.intersection([
    UserDataProcessing,
    DocumentDbUtils.RetrievedDocument,
    VersionedModel
  ])
);

export type RetrievedUserDataProcessing = t.TypeOf<
  typeof RetrievedUserDataProcessing
>;

function toRetrieved(
  result: DocumentDb.RetrievedDocument
): RetrievedUserDataProcessing {
  return RetrievedUserDataProcessing.decode(result).getOrElseL(_ => {
    throw new Error("Fatal, result is not a valid RetrievedUserDataProcessing");
  });
}

function toBaseType(o: RetrievedUserDataProcessing): UserDataProcessing {
  return pick(
    ["userDataProcessingId", "fiscalCode", "choice", "status", "createdAt"],
    o
  );
}

function getModelId(o: UserDataProcessing): ModelId {
  return userDataProcessingIdToModelId(
    makeUserDataProcessingId(o.choice, o.fiscalCode)
  );
}

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

function updateModelId(
  o: UserDataProcessing,
  id: NonEmptyString,
  version: NonNegativeNumber
): NewUserDataProcessing {
  return {
    ...o,
    id,
    kind: "INewUserDataProcessing",
    version
  };
}

/**
 * A model for handling UserDataProcessing
 */
export class UserDataProcessingModel extends DocumentDbModelVersioned<
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
  constructor(
    dbClient: DocumentDb.DocumentClient,
    collectionUrl: DocumentDbUtils.IDocumentDbCollectionUri
  ) {
    super(
      dbClient,
      collectionUrl,
      toBaseType,
      toRetrieved,
      getModelId,
      updateModelId
    );
  }

  /**
   * Searches for one user data processing request to the provided id
   *
   * @param id
   */
  public findOneUserDataProcessingById(
    fiscalCode: FiscalCode,
    userDataProcessingId: UserDataProcessingId
  ): Promise<
    Either<DocumentDb.QueryError, Option<RetrievedUserDataProcessing>>
  > {
    return super.findLastVersionByModelId(
      USER_DATA_PROCESSING_MODEL_ID_FIELD,
      userDataProcessingId,
      USER_DATA_PROCESSING_MODEL_PK_FIELD,
      fiscalCode
    );
  }

  public async createOrUpdateByNewOne(
    userDataProcessing: UserDataProcessing
  ): Promise<Either<QueryError, RetrievedUserDataProcessing>> {
    const newId = makeUserDataProcessingId(
      userDataProcessing.choice,
      userDataProcessing.fiscalCode
    );

    const toUpdate: UserDataProcessing = {
      choice: userDataProcessing.choice,
      createdAt: userDataProcessing.createdAt,
      fiscalCode: userDataProcessing.fiscalCode,
      status: userDataProcessing.status,
      updatedAt: userDataProcessing.createdAt,
      userDataProcessingId: newId
    };
    return super.upsert(
      toUpdate,
      USER_DATA_PROCESSING_MODEL_ID_FIELD,
      toUpdate.userDataProcessingId,
      USER_DATA_PROCESSING_MODEL_PK_FIELD,
      toUpdate.fiscalCode
    );
  }
}
