/* eslint-disable no-console */
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import {
  fromEither,
  taskEither,
  taskEitherSeq,
  tryCatch
} from "fp-ts/lib/TaskEither";
import {
  MESSAGE_MODEL_PK_FIELD,
  MessageModel,
  NewMessageWithoutContent,
  RetrievedMessage
} from "../../src/models/message";
import { createContext } from "./cosmos_utils";
import { fromOption } from "fp-ts/lib/Either";
import { toString } from "fp-ts/lib/function";
import { ServiceId } from "../../generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "../../generated/definitions/TimeToLiveSeconds";
import {
  DecodedFeedResponse,
  toCosmosErrorResponse
} from "../../src/utils/cosmosdb_model";
import {
  asyncIterableToArray,
  flattenAsyncIterable
} from "../../src/utils/async";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { array } from "fp-ts/lib/Array";

const MESSAGE_CONTAINER_NAME = "test-message-container" as NonEmptyString;

const aFiscalCode = "RLDBSV36A78Y792X" as FiscalCode;
const anotherFiscalCode = "TDDBSV36A78Y792X" as FiscalCode;

const aSerializedNewMessageWithoutContent = {
  fiscalCode: aFiscalCode,
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

const aMessageContentWithPayment = {
  subject: "a".repeat(20),
  markdown: "a".repeat(100),
  payment_data: {
    amount: 10,
    notice_number: `0${"9".repeat(17)}`
  }
};

const aMessageContentPrescription = {
  subject: "a".repeat(20),
  markdown: "a".repeat(100),
  prescription_data: {
    nre: "a".repeat(15),
    iup: "a".repeat(10),
    prescriber_fiscal_code: anotherFiscalCode
  }
};

const aMessageContentEUCovidCert = {
  subject: "a".repeat(20),
  markdown: "a".repeat(100),
  eu_covid_cert: {
    auth_code: "a".repeat(25)
  }
};

const aMessageContentWithNoPayment = {
  subject: "a".repeat(20),
  markdown: "a".repeat(100)
};

const withId = (
  msg: NewMessageWithoutContent,
  n: number
): NewMessageWithoutContent => ({
  ...msg,
  id: `ID_${n}` as NonEmptyString,
  indexedId: `ID_${n}` as NonEmptyString,
  createdAt: new Date(new Date().getTime() + n)
});

describe("Models |> Message", () => {
  it("should save messages without content", async () => {
    const context = await createContext(MESSAGE_MODEL_PK_FIELD);
    await context.init();
    const model = new MessageModel(context.container, MESSAGE_CONTAINER_NAME);

    // create a new document
    const created = await model
      .create(aNewMessageWithoutContent)
      .fold(
        _ => fail(`Failed to create doc, error: ${toString(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aSerializedNewMessageWithoutContent
            })
          );
          return result;
        }
      )
      .run();

    // find the message by query
    await taskEither
      .of<any, void>(void 0)
      .chain(_ =>
        model.findOneByQuery({
          parameters: [
            {
              name: "@id",
              value: aNewMessageWithoutContent.id
            }
          ],
          query: `SELECT * FROM m WHERE m.id = @id`
        })
      )
      .chain(_ => fromEither(fromOption("It's none")(_)))
      .fold(
        _ => fail(`Failed to read single doc, error: ${toString(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aSerializedNewMessageWithoutContent
            })
          );
        }
      )
      .run();

    // find the message by recipient
    await taskEither
      .of<any, void>(void 0)
      .chain(_ =>
        model.find([
          aNewMessageWithoutContent.id,
          aNewMessageWithoutContent.fiscalCode
        ])
      )
      .chain(_ => fromEither(fromOption("It's none")(_)))
      .fold(
        _ => fail(`Failed to find one doc, error: ${toString(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aSerializedNewMessageWithoutContent
            })
          );
          return result;
        }
      )
      .run();

    // find all message for a fiscal code
    await tryCatch(
      () =>
        asyncIterableToArray(
          flattenAsyncIterable(
            model.getQueryIterator({
              parameters: [
                {
                  name: "@fiscalCode",
                  value: aFiscalCode
                }
              ],
              query: `SELECT * FROM m WHERE m.fiscalCode = @fiscalCode`
            })
          )
        ),
      toCosmosErrorResponse
    )
      .fold(
        _ => fail(`Failed to read all docs, error: ${toString(_)}`),
        results => {
          expect(results).toEqual(expect.any(Array));
          expect(results).toHaveLength(1);
          results[0].fold(
            _ => fail(`Failed to validate , error: ${toString(_)}`),
            result => {
              expect(result).toEqual(
                expect.objectContaining({
                  ...aSerializedNewMessageWithoutContent
                })
              );
            }
          );
        }
      )
      .run();

    context.dispose();
  });

  it.each`
    title                                                        | value
    ${"a message content without"}                               | ${aMessageContentWithNoPayment}
    ${"a message content with payment data"}                     | ${aMessageContentWithPayment}
    ${"a message content with a prescription"}                   | ${aMessageContentPrescription}
    ${"a message content with a EU Covid Certificate auth code"} | ${aMessageContentEUCovidCert}
  `("should save $title correctly", async ({ value }) => {
    const context = await createContext(MESSAGE_MODEL_PK_FIELD, true);
    await context.init();
    const model = new MessageModel(
      context.container,
      context.containerName as NonEmptyString
    );

    const aFakeMessageId = "fakemessageid";

    await model
      .storeContentAsBlob(context.storage, aFakeMessageId, value)
      .fold(
        _ => fail(`Failed to store content, error: ${toString(_)}`),
        result => {
          expect(result.isSome()).toBe(true);
          return result;
        }
      )
      .run();

    await model
      .getContentFromBlob(context.storage, aFakeMessageId)
      .chain(_ => fromEither(fromOption(new Error(`Blob not found`))(_)))
      .fold(
        _ => fail(`Failed to get content, error: ${toString(_)}`),
        result => {
          // check the output contains the values stored before
          expect(result.due_date).toEqual(value.due_date);
          expect(result.markdown).toEqual(value.markdown);
          expect(result.subject).toEqual(value.subject);
          expect(result.payment_data?.amount).toEqual(
            value.payment_data?.amount
          );
          expect(result.payment_data?.notice_number).toEqual(
            value.payment_data?.notice_number
          );
          expect(result.prescription_data?.nre).toEqual(
            value.prescription_data?.nre
          );
          expect(result.prescription_data?.iup).toEqual(
            value.prescription_data?.iup
          );
          expect(result.prescription_data?.prescriber_fiscal_code).toEqual(
            value.prescription_data?.prescriber_fiscal_code
          );
          expect(result.eu_covid_cert?.auth_code).toEqual(
            value.eu_covid_cert?.auth_code
          );
        }
      )
      .run();

    await context.dispose();
  });

  it("should retrieve a hundred messages when no pageSize is given and default value is used", async () => {
    const context = await createContext(MESSAGE_MODEL_PK_FIELD);
    await context.init();
    const model = new MessageModel(context.container, MESSAGE_CONTAINER_NAME);

    // Create 101 messages
    const numberOfMessages = 101;
    await array
      .sequence(taskEitherSeq)(
        [...Array(numberOfMessages).keys()]
          .map(n => withId(aNewMessageWithoutContent, n))
          .map(doc => model.create(doc))
      )
      .run();

    // get a page of messages by fiscal code
    let results: DecodedFeedResponse<RetrievedMessage> = await model
      .findMessages(aFiscalCode)
      .map(ai => ai.next().then(ir => ir.value))
      .getOrElseL(_ => {
        throw new Error("Error");
      })
      .run();

    // default pageSize is 100, so all the messages above that
    // will never be returned for an app without pagination
    const defaultPageSize = 100;
    expect(results.length).toEqual(defaultPageSize);

    await context.dispose();
  });

  it("should retrieve a page without any continuation token when the pageSize is greater than the number of results", async () => {
    const context = await createContext(MESSAGE_MODEL_PK_FIELD);
    await context.init();
    const model = new MessageModel(context.container, MESSAGE_CONTAINER_NAME);

    const numberOfMessages = 2;
    await array
      .sequence(taskEitherSeq)(
        [...Array(numberOfMessages).keys()]
          .map(n => withId(aNewMessageWithoutContent, n))
          .map(doc => model.create(doc))
      )
      .run();

    const pageSize = 10 as NonNegativeInteger;

    // get a page of messages by fiscal code
    let results: DecodedFeedResponse<RetrievedMessage> = await model
      .findMessages(aFiscalCode, pageSize)
      .map(ai => ai.next().then(ir => ir.value))
      .getOrElseL(_ => {
        throw new Error("Error");
      })
      .run();

    expect(results.length).toEqual(numberOfMessages);
    results.forEach(i => {
      expect(i.hasMoreResults).toBe(false);
      expect(i.continuationToken).toBe(undefined);
      expect(i.resource.isRight()).toBe(true);
    });

    await context.dispose();
  });

  it("should retrieve a page with a continuation token when the pageSize is less than the number of results", async () => {
    const context = await createContext(MESSAGE_MODEL_PK_FIELD);
    await context.init();
    const model = new MessageModel(context.container, MESSAGE_CONTAINER_NAME);

    const numberOfMessages = 3;
    await array
      .sequence(taskEitherSeq)(
        [...Array(numberOfMessages).keys()]
          .map(n => withId(aNewMessageWithoutContent, n))
          .map(doc => model.create(doc))
      )
      .run();

    const pageSize = 2 as NonNegativeInteger;

    // get a page of messages by fiscal code
    let results: DecodedFeedResponse<RetrievedMessage> = await model
      .findMessages(aFiscalCode, pageSize)
      .map(ai => ai.next().then(ir => ir.value))
      .getOrElseL(_ => {
        throw new Error("Error");
      })
      .run();

    expect(results.length).toEqual(pageSize);
    results.forEach(i => {
      expect(i.hasMoreResults).toBe(true);
      expect(i.continuationToken).not.toBe(undefined);
      expect(i.resource.isRight()).toBe(true);
    });

    await context.dispose();
  });

  it("should correctly retrieve the next page when using the continuation token", async () => {
    const context = await createContext(MESSAGE_MODEL_PK_FIELD);
    await context.init();
    const model = new MessageModel(context.container, MESSAGE_CONTAINER_NAME);

    const numberOfMessages = 3;
    await array
      .sequence(taskEitherSeq)(
        [...Array(numberOfMessages).keys()]
          .map(n => withId(aNewMessageWithoutContent, n))
          .map(doc => model.create(doc))
      )
      .run();

    const pageSize = 2 as NonNegativeInteger;

    // get the first page of messages by fiscal code
    let results: DecodedFeedResponse<RetrievedMessage> = await model
      .findMessages(aFiscalCode, pageSize)
      .map(ai => ai.next().then(ir => ir.value))
      .getOrElseL(_ => {
        throw new Error("Error");
      })
      .run();

    expect(results.length).toEqual(pageSize);
    results.forEach(i => {
      expect(i.hasMoreResults).toBe(true);
      expect(i.continuationToken).not.toBe(undefined);
      expect(i.resource.isRight()).toBe(true);
    });

    // take the last continuation token
    const continuationToken = results[results.length - 1].continuationToken;
    expect(typeof continuationToken).toBe("string");
    expect(continuationToken).not.toBe(undefined);
    if (continuationToken !== undefined) {
      expect(continuationToken.length).not.toBe(0);
    }

    // get the second page of messages by fiscal code
    results = await model
      .findMessages(aFiscalCode, pageSize, continuationToken as NonEmptyString)
      .map(ai => ai.next().then(ir => ir.value))
      .getOrElseL(_ => {
        throw new Error("Error");
      })
      .run();

    expect(results.length).toEqual(numberOfMessages - pageSize);
    results.forEach(i => {
      expect(i.hasMoreResults).toBe(false);
      expect(i.continuationToken).toBe(undefined);
      expect(i.resource.isRight()).toBe(true);
    });

    await context.dispose();
  });

  it("should correctly keep a descending order by date if new records are inserted before getting the second page", async () => {
    const context = await createContext(MESSAGE_MODEL_PK_FIELD);
    await context.init();
    const model = new MessageModel(context.container, MESSAGE_CONTAINER_NAME);

    const numberOfMessages = 3;
    await array
      .sequence(taskEitherSeq)(
        [...Array(numberOfMessages).keys()]
          .map(n => withId(aNewMessageWithoutContent, n))
          .map(doc => model.create(doc))
      )
      .run();

    const pageSize = 2 as NonNegativeInteger;

    // get the first page of messages by fiscal code
    let results: DecodedFeedResponse<RetrievedMessage> = await model
      .findMessages(aFiscalCode, pageSize)
      .map(ai => ai.next().then(ir => ir.value))
      .getOrElseL(_ => {
        throw new Error("Error");
      })
      .run();

    let prevMessageCreationDate = new Date();
    expect(results.length).toEqual(pageSize);
    results.forEach(i => {
      expect(i.hasMoreResults).toBe(true);
      expect(i.continuationToken).not.toBe(undefined);
      expect(i.resource.isRight()).toBe(true);
      // check that every message has a createdDate less than the previous one
      if (i.resource.isRight()) {
        expect(i.resource.value.createdAt < prevMessageCreationDate).toBe(true);
        prevMessageCreationDate = i.resource.value.createdAt;
      }
    });

    // take the last continuation token
    let continuationToken = results[results.length - 1].continuationToken;
    expect(typeof continuationToken).toBe("string");
    expect(continuationToken).not.toBe(undefined);
    if (continuationToken !== undefined) {
      expect(continuationToken.length).not.toBe(0);
    }

    // a new messages arrives before we get page 2
    // note ID shoudl be >=3 because we already created 0, 1, 2 above
    await model.create(withId(aNewMessageWithoutContent, 3)).run();

    // get the second page of messages by fiscal code that should not have the message 4
    results = await model
      .findMessages(aFiscalCode, pageSize, continuationToken as NonEmptyString)
      .map(ai => ai.next().then(ir => ir.value))
      .getOrElseL(_ => {
        throw new Error("Error");
      })
      .run();

    expect(results.length).toEqual(numberOfMessages - pageSize);
    results.forEach(i => {
      expect(i.hasMoreResults).toBe(false);
      expect(i.continuationToken).toBe(undefined);
      expect(i.resource.isRight()).toBe(true);
      // check that every message has a createdDate less than the previous one
      if (i.resource.isRight()) {
        expect(i.resource.value.createdAt < prevMessageCreationDate).toBe(true);
        prevMessageCreationDate = i.resource.value.createdAt;
      }
    });

    /* -------------------------------------------------------------------- */
    /* let's now check that a newly started procedure will return message 4 */
    /* -------------------------------------------------------------------- */

    // get the first page of messages by fiscal code
    results = await model
      .findMessages(aFiscalCode, pageSize)
      .map(ai => ai.next().then(ir => ir.value))
      .getOrElseL(_ => {
        throw new Error("Error");
      })
      .run();

    prevMessageCreationDate = new Date();
    expect(results.length).toEqual(pageSize);
    results.forEach(i => {
      expect(i.hasMoreResults).toBe(true);
      expect(i.continuationToken).not.toBe(undefined);
      expect(i.resource.isRight()).toBe(true);
      // check that every message has a createdDate less than the previous one
      if (i.resource.isRight()) {
        expect(i.resource.value.createdAt < prevMessageCreationDate).toBe(true);
        prevMessageCreationDate = i.resource.value.createdAt;
      }
    });

    // take the last continuation token
    continuationToken = results[results.length - 1].continuationToken;
    expect(typeof continuationToken).toBe("string");
    expect(continuationToken).not.toBe(undefined);
    if (continuationToken !== undefined) {
      expect(continuationToken.length).not.toBe(0);
    }

    // get the second page of messages by fiscal code that should not have the message 4
    results = await model
      .findMessages(aFiscalCode, pageSize, continuationToken as NonEmptyString)
      .map(ai => ai.next().then(ir => ir.value))
      .getOrElseL(_ => {
        throw new Error("Error");
      })
      .run();

    expect(results.length).toEqual(pageSize);
    results.forEach(i => {
      expect(i.hasMoreResults).toBe(false);
      expect(i.continuationToken).toBe(undefined);
      expect(i.resource.isRight()).toBe(true);
      // check that every message has a createdDate less than the previous one
      if (i.resource.isRight()) {
        expect(i.resource.value.createdAt < prevMessageCreationDate).toBe(true);
        prevMessageCreationDate = i.resource.value.createdAt;
      }
    });

    await context.dispose();
  });
});
