// tslint:disable: no-console no-identical-functions
import {
  EmailString,
  FiscalCode,
  NonEmptyString
} from "italia-ts-commons/lib/strings";

import { isLeft, right } from "fp-ts/lib/Either";
import { fromEither, fromLeft, taskEither } from "fp-ts/lib/TaskEither";
import { NonNegativeInteger } from "italia-ts-commons/lib/numbers";
import {
  Profile,
  PROFILE_COLLECTION_NAME,
  PROFILE_MODEL_PK_FIELD,
  ProfileModel,
  RetrievedProfile
} from "../profile";
import {
  cosmosDatabaseName,
  createContainer,
  createDatabase
} from "./integration_init";

const logPrefix = "Profile";

const aProfile: Profile = Profile.decode({
  acceptedTosVersion: 1,
  email: "email@example.com",
  fiscalCode: "AAAAAA00A00A000A",
  isEmailEnabled: true,
  isEmailValidated: true,
  isInboxEnabled: true,
  isWebhookEnabled: true
}).getOrElseL(() => {
  throw new Error("Cannot decode profile payload.");
});

const aRetrievedProfile: RetrievedProfile = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  acceptedTosVersion: 1,
  fiscalCode: "FRLFRC74E04B157I" as FiscalCode,
  id: "xyz-0" as NonEmptyString,
  isEmailValidated: false,
  isInboxEnabled: false,
  isWebhookEnabled: false,
  kind: "IRetrievedProfile",
  version: 0 as NonNegativeInteger
};

const createTest = createDatabase(cosmosDatabaseName)
  .chain(db =>
    createContainer(db, PROFILE_COLLECTION_NAME, PROFILE_MODEL_PK_FIELD)
  )
  .chain(container =>
    new ProfileModel(container).create({
      kind: "INewProfile",
      ...aProfile,
      version: 0 as NonNegativeInteger
    })
  );

const retrieveTest = (modelId: string) =>
  createDatabase(cosmosDatabaseName)
    .chain(db =>
      createContainer(db, PROFILE_COLLECTION_NAME, PROFILE_MODEL_PK_FIELD)
    )
    .chain(container =>
      new ProfileModel(container).findLastVersionByModelId(modelId)
    );

const upsertTest = createDatabase(cosmosDatabaseName)
  .chain(db =>
    createContainer(db, PROFILE_COLLECTION_NAME, PROFILE_MODEL_PK_FIELD)
  )
  .chain(container =>
    new ProfileModel(container).upsert({
      kind: "INewProfile",
      ...aProfile,
      email: "emailUpdated@example.com" as EmailString,
      version: undefined
    })
  );

export const test = () =>
  createTest
    .foldTaskEither(
      err => {
        if (err.kind === "COSMOS_ERROR_RESPONSE" && err.error.code === 409) {
          console.log(
            `${logPrefix}-CreateTest| A document with the same id already exists`
          );
          return taskEither.of(aRetrievedProfile);
        } else {
          return fromLeft(err);
        }
      },
      _ => fromEither(right(_))
    )
    .chain(_ => upsertTest)
    .chain(_ => retrieveTest(_.fiscalCode))
    .run()
    .then(_ => {
      if (isLeft(_)) {
        console.log(`${logPrefix}-Test| Error = `);
        console.log(_.value);
      } else {
        console.log(`${logPrefix}-Test| success!`);
        console.log(_.value);
      }
    })
    .catch(console.error);
