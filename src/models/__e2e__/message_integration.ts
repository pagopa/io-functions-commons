// tslint:disable: no-console no-identical-functions
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";

import { isLeft, right } from "fp-ts/lib/Either";
import {
  fromEither,
  fromLeft,
  taskEither,
  tryCatch
} from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { ServiceId } from "../../../generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "../../../generated/definitions/TimeToLiveSeconds";
import { asyncIterableToArray, flattenAsyncIterable } from "../../utils/async";
import {
  CosmosErrors,
  toCosmosErrorResponse
} from "../../utils/cosmosdb_model";
import {
  MESSAGE_COLLECTION_NAME,
  MESSAGE_MODEL_PK_FIELD,
  MessageModel,
  NewMessageWithoutContent,
  RetrievedMessage,
  RetrievedMessageWithoutContent
} from "../message";
import {
  cosmosDatabaseName,
  createContainer,
  createDatabase
} from "./integration_init";

const logPrefix = "Message";

const MESSAGE_CONTAINER_NAME = "message-content" as NonEmptyString;

const aSerializedNewMessageWithoutContent = {
  createdAt: new Date().toISOString(),
  fiscalCode: "RLDBSV36A78Y792X" as FiscalCode,
  id: "A_MESSAGE_ID" as NonEmptyString,
  indexedId: "A_MESSAGE_ID" as NonEmptyString,
  senderServiceId: "agid" as ServiceId,
  senderUserId: "u123" as NonEmptyString,
  timeToLiveSeconds: 3600 as TimeToLiveSeconds
};

const aNewMessageWithoutContent: NewMessageWithoutContent = {
  ...aSerializedNewMessageWithoutContent,
  createdAt: new Date(),
  kind: "INewMessageWithoutContent"
};

const aRetrievedMessageWithoutContent: RetrievedMessageWithoutContent = {
  ...aNewMessageWithoutContent,
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  kind: "IRetrievedMessageWithoutContent"
};

const createTest = createDatabase(cosmosDatabaseName)
  .chain(db =>
    createContainer(db, MESSAGE_COLLECTION_NAME, MESSAGE_MODEL_PK_FIELD)
  )
  .chain(container =>
    new MessageModel(container, MESSAGE_CONTAINER_NAME).create(
      aNewMessageWithoutContent
    )
  )
  .foldTaskEither<CosmosErrors, RetrievedMessageWithoutContent>(
    err => fromLeft(err),
    _ => taskEither.of({ ..._ } as RetrievedMessageWithoutContent)
  );

const findMessagesTest = (fiscalCode: FiscalCode) =>
  createDatabase(cosmosDatabaseName)
    .chain(db =>
      createContainer(db, MESSAGE_COLLECTION_NAME, MESSAGE_MODEL_PK_FIELD)
    )
    .chain(container =>
      new MessageModel(container, MESSAGE_CONTAINER_NAME).findMessages(
        fiscalCode
      )
    );

const retrieveOneByQueryTest = (modelId: string) =>
  createDatabase(cosmosDatabaseName)
    .chain(db =>
      createContainer(db, MESSAGE_COLLECTION_NAME, MESSAGE_MODEL_PK_FIELD)
    )
    .chain(container =>
      new MessageModel(container, MESSAGE_CONTAINER_NAME).findOneByQuery({
        parameters: [
          {
            name: "@id",
            value: modelId
          }
        ],
        query: `SELECT * FROM m WHERE m.id = @id`
      })
    );

const findTest = (modelId: NonEmptyString, fiscalCode: FiscalCode) =>
  createDatabase(cosmosDatabaseName)
    .chain(db =>
      createContainer(db, MESSAGE_COLLECTION_NAME, MESSAGE_MODEL_PK_FIELD)
    )
    .chain(container =>
      new MessageModel(container, MESSAGE_CONTAINER_NAME).find([
        modelId,
        fiscalCode
      ])
    );

const upsertTest = createDatabase(cosmosDatabaseName)
  .chain(db =>
    createContainer(db, MESSAGE_COLLECTION_NAME, MESSAGE_MODEL_PK_FIELD)
  )
  .chain(container =>
    new MessageModel(container, MESSAGE_CONTAINER_NAME).upsert({
      ...aNewMessageWithoutContent,
      indexedId: "AN_UPDATED_MESSAGE_ID" as NonEmptyString
    })
  );

const findAllTest = (fiscalCode: FiscalCode) =>
  createDatabase(cosmosDatabaseName)
    .chain(db =>
      createContainer(db, MESSAGE_COLLECTION_NAME, MESSAGE_MODEL_PK_FIELD)
    )
    .chain(container =>
      tryCatch(
        () =>
          asyncIterableToArray(
            flattenAsyncIterable(
              new MessageModel(
                container,
                MESSAGE_CONTAINER_NAME
              ).getQueryIterator({
                parameters: [
                  {
                    name: "@fiscalCode",
                    value: fiscalCode
                  }
                ],
                query: `SELECT * FROM m WHERE m.fiscalCode = @fiscalCode`
              })
            )
          ),
        toCosmosErrorResponse
      )
    );

export const test = () =>
  createTest
    .foldTaskEither<CosmosErrors, RetrievedMessageWithoutContent>(
      err => {
        if (err.kind === "COSMOS_ERROR_RESPONSE" && err.error.code === 409) {
          console.log(
            `${logPrefix}-CreateTest| A document with the same id already exists`
          );
          return taskEither.of(aRetrievedMessageWithoutContent);
        } else {
          return fromLeft(err);
        }
      },
      _ => fromEither(right(_))
    )
    .chain(_ => retrieveOneByQueryTest(_.id))
    .chain(_ => upsertTest)
    .chain(_ => findTest(_.id, _.fiscalCode))
    .foldTaskEither<
      CosmosErrors,
      AsyncIterator<ReadonlyArray<t.Validation<RetrievedMessage>>>
    >(
      () =>
        fromLeft(
          toCosmosErrorResponse(
            new Error("cannot retrieve a Message using findOneByQuery")
          )
        ),
      _ =>
        _.foldL(
          () =>
            fromLeft(
              toCosmosErrorResponse(
                new Error("No Message found for given modelId")
              )
            ),
          result => findMessagesTest(result.fiscalCode)
        )
    )
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

export const findAllByQueryTest = () =>
  findAllTest(aSerializedNewMessageWithoutContent.fiscalCode)
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
