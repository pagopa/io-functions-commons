// tslint:disable: no-console no-identical-functions
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { isLeft, right } from "fp-ts/lib/Either";
import { fromEither, fromLeft, taskEither } from "fp-ts/lib/TaskEither";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { UserDataProcessingChoiceEnum } from "../../../generated/definitions/UserDataProcessingChoice";
import { UserDataProcessingStatusEnum } from "../../../generated/definitions/UserDataProcessingStatus";
import {
  makeUserDataProcessingId,
  RetrievedUserDataProcessing,
  USER_DATA_PROCESSING_COLLECTION_NAME,
  USER_DATA_PROCESSING_MODEL_ID_FIELD,
  USER_DATA_PROCESSING_MODEL_PK_FIELD,
  UserDataProcessing,
  UserDataProcessingId,
  UserDataProcessingModel
} from "../user_data_processing";
import {
  cosmosDatabaseName,
  createContainer,
  createDatabase
} from "./integration_init";

const aUserDataProcessingChoice = UserDataProcessingChoiceEnum.DOWNLOAD;
const aUserDataProcessingStatus = UserDataProcessingStatusEnum.PENDING;
const aFiscalCode = "RLDBSV36A78Y792X" as FiscalCode;

const aUserDataProcessing: UserDataProcessing = UserDataProcessing.decode({
  choice: aUserDataProcessingChoice,
  createdAt: new Date(),
  fiscalCode: aFiscalCode,
  status: aUserDataProcessingStatus,
  userDataProcessingId: makeUserDataProcessingId(
    aUserDataProcessingChoice,
    aFiscalCode
  )
}).getOrElseL(() => {
  throw new Error("Cannot decode userdataprocessing payload.");
});

const aRetrievedUserDataProcessing: RetrievedUserDataProcessing = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  choice: aUserDataProcessingChoice,
  createdAt: new Date(),
  fiscalCode: aFiscalCode,
  id: `${aUserDataProcessing[USER_DATA_PROCESSING_MODEL_ID_FIELD]}-0000000000000000` as NonEmptyString,
  kind: "IRetrievedUserDataProcessing",
  status: aUserDataProcessingStatus,
  userDataProcessingId:
    aUserDataProcessing[USER_DATA_PROCESSING_MODEL_ID_FIELD],
  version: 0 as NonNegativeInteger
};

const createTest = createDatabase(cosmosDatabaseName)
  .chain(db =>
    createContainer(
      db,
      USER_DATA_PROCESSING_COLLECTION_NAME,
      USER_DATA_PROCESSING_MODEL_PK_FIELD
    )
  )
  .chain(container =>
    new UserDataProcessingModel(container).create({
      kind: "INewUserDataProcessing",
      ...aUserDataProcessing
    })
  );

const retrieveTest = (modelId: UserDataProcessingId, partition: FiscalCode) =>
  createDatabase(cosmosDatabaseName)
    .chain(db =>
      createContainer(
        db,
        USER_DATA_PROCESSING_COLLECTION_NAME,
        USER_DATA_PROCESSING_MODEL_PK_FIELD
      )
    )
    .chain(container =>
      new UserDataProcessingModel(container).findLastVersionByModelId([
        modelId,
        partition
      ])
    );

const upsertTest = createDatabase(cosmosDatabaseName)
  .chain(db =>
    createContainer(
      db,
      USER_DATA_PROCESSING_COLLECTION_NAME,
      USER_DATA_PROCESSING_MODEL_PK_FIELD
    )
  )
  .chain(container =>
    new UserDataProcessingModel(container).createOrUpdateByNewOne({
      ...aRetrievedUserDataProcessing,
      status: UserDataProcessingStatusEnum.WIP,
      updatedAt: new Date()
    })
  );

export const test = () =>
  createTest
    .foldTaskEither(
      err => {
        if (err.kind === "COSMOS_ERROR_RESPONSE" && err.error.code === 409) {
          console.log(
            "UserDataProcessing-CreateTest| A document with the same id already exists"
          );
          return taskEither.of(aRetrievedUserDataProcessing);
        } else {
          return fromLeft(err);
        }
      },
      _ => fromEither(right(_))
    )
    .chain(_ => upsertTest)
    .chain(_ =>
      retrieveTest(
        _[USER_DATA_PROCESSING_MODEL_ID_FIELD],
        _[USER_DATA_PROCESSING_MODEL_PK_FIELD]
      )
    )
    .run()
    .then(_ => {
      if (isLeft(_)) {
        console.log(`UserDataProcessing-Test| Error = ${_.value}`);
        console.log(_.value);
      } else {
        console.log("UserDataProcessing-Test| success!");
        console.log(_.value);
      }
    })
    .catch(console.error);
