import * as t from "io-ts";

import { pick, tag } from "italia-ts-commons/lib/types";

import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";
import {
  DocumentDbModelVersioned,
  ModelId,
  VersionedModel
} from "../utils/documentdb_model_versioned";

import { Either, isLeft, isRight, left, right } from "fp-ts/lib/Either";
import { isNone, Option } from "fp-ts/lib/Option";

import { QueryError } from "documentdb";
import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { FiscalCode } from "../../generated/definitions/FiscalCode";
import { Timestamp } from "../../generated/definitions/Timestamp";
import { UserDataProcessingChoice } from "../../generated/definitions/UserDataProcessingChoice";
import { UserDataProcessingStatus } from "../../generated/definitions/UserDataProcessingStatus";
import { iteratorToArray } from "../utils/documentdb";

export const USER_DATA_PROCESSING_COLLECTION_NAME = "user-data-processing";
export const USER_DATA_PROCESSING_MODEL_PK_FIELD = "fiscalCode";
export const USER_DATA_PROCESSING_MODEL_ID_FIELD = "id";

/**
 * Base interface for User Data Processing objects
 */
export const UserDataProcessing = t.intersection([
  t.interface({
    // the unique identifier of a user data processing request
    id: NonEmptyString,

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
 * Interface for new Profile objects
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
 * Existing profile records have a version number.
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

// tslint:disable-next-line: prettier
export type RetrievedUserDataProcessing = t.TypeOf<typeof RetrievedUserDataProcessing>;

function toRetrieved(
  result: DocumentDb.RetrievedDocument
): RetrievedUserDataProcessing {
  return RetrievedUserDataProcessing.decode(result).getOrElseL(_ => {
    throw new Error("Fatal, result is not a valid RetrievedUserDataProcessing");
  });
}

function toBaseType(o: RetrievedUserDataProcessing): UserDataProcessing {
  return pick(["id", "fiscalCode", "choice", "status", "createdAt"], o);
}

function getModelId(o: UserDataProcessing): ModelId {
  return (o.id as string) as ModelId;
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
    id: NonEmptyString,
    fiscalCode: FiscalCode
  ): Promise<Either<DocumentDb.QueryError, Option<UserDataProcessing>>> {
    return super.findLastVersionByModelId(
      USER_DATA_PROCESSING_MODEL_ID_FIELD,
      id,
      USER_DATA_PROCESSING_MODEL_PK_FIELD,
      fiscalCode
    );
  }

  public async createOrUpdateByNewOne(
    userDataProcessing: UserDataProcessing
  ): Promise<Either<QueryError, UserDataProcessing>> {
    const checkExistFalseOrMaybeRegisteredOne = await this.getUserDataProcessingExisting(
      userDataProcessing.fiscalCode,
      userDataProcessing.choice
    );
    if (isRight(checkExistFalseOrMaybeRegisteredOne)) {
      // user data processing is already registered for current user
      // Updating updatedAt in this case
      const existingUserDataProcessing = checkExistFalseOrMaybeRegisteredOne.value.getOrElseL(
        () => {
          throw Error("User data processing retrieve error");
        }
      );
      const toUpdate = {
        id: existingUserDataProcessing.id,
        // tslint:disable-next-line: object-literal-sort-keys
        fiscalCode: existingUserDataProcessing.fiscalCode,
        choice: existingUserDataProcessing.choice,
        status: existingUserDataProcessing.status,
        createdAt: existingUserDataProcessing.createdAt,
        updatedAt: userDataProcessing.createdAt
      };
      return super.upsert(
        toUpdate,
        USER_DATA_PROCESSING_MODEL_ID_FIELD,
        toUpdate.id,
        USER_DATA_PROCESSING_MODEL_PK_FIELD,
        toUpdate.fiscalCode
      );
    } else {
      // user data processing is a new request
      return super.create(userDataProcessing, userDataProcessing.fiscalCode);
    }
  }

  public async getUserDataProcessingExisting(
    fiscalCode: FiscalCode,
    userDataProcessingChoice: UserDataProcessingChoice
  ): Promise<Either<DocumentDb.QueryError, Option<UserDataProcessing>>> {
    return await this.findAllByFiscalCodeAndChoice(
      fiscalCode,
      userDataProcessingChoice
    );
  }

  /**
   * Searches for all user data processing request with the provided fiscalCode and choice
   *
   * @param fiscalCode: FiscalCode
   * @param choice: UserDataProcessingChoice
   */
  public findAllByFiscalCodeAndChoice(
    fiscalCode: FiscalCode,
    userDataProcessingChoice: UserDataProcessingChoice
  ): Promise<Either<DocumentDb.QueryError, Option<UserDataProcessing>>> {
    return DocumentDbUtils.queryOneDocument(
      this.dbClient,
      this.collectionUri,
      {
        parameters: [
          {
            name: "@fiscalCode",
            value: fiscalCode
          },
          {
            name: "@choice",
            value: userDataProcessingChoice
          }
        ],
        query: `SELECT TOP 1 * FROM user-data-processing n WHERE (n.fiscalCode = @fiscalCode AND n.choice = @choice) ORDER BY n.version DESC`
      },
      fiscalCode
    );
  }

  public findAllByFiscalCode(
    fiscalCode: FiscalCode
  ): DocumentDbUtils.IResultIterator<UserDataProcessing> {
    return DocumentDbUtils.queryDocuments(
      this.dbClient,
      this.collectionUri,
      {
        parameters: [
          {
            name: "@fiscalCode",
            value: fiscalCode
          }
        ],
        query: `SELECT * FROM user-data-processing n WHERE n.fiscalCode = @fiscalCode`
      },
      fiscalCode
    );
  }
}
