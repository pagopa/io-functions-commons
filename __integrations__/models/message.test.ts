/* eslint-disable no-console */
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { fromEither, taskEither, tryCatch } from "fp-ts/lib/TaskEither";
import {
  MESSAGE_MODEL_PK_FIELD,
  MessageModel,
  NewMessageWithoutContent
} from "../../src/models/message";
import { createContext } from "./cosmos_utils";
import { fromOption } from "fp-ts/lib/Either";
import { toString } from "fp-ts/lib/function";
import { ServiceId } from "../../generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "../../generated/definitions/TimeToLiveSeconds";
import { toCosmosErrorResponse } from "../../src/utils/cosmosdb_model";
import {
  asyncIterableToArray,
  flattenAsyncIterable
} from "../../src/utils/async";

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

const aMessageContentWithNoPayment = {
  subject: "a".repeat(20),
  markdown: "a".repeat(100)
};

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
    title                                      | value
    ${"a message content without"}             | ${aMessageContentWithNoPayment}
    ${"a message content with payment data"}   | ${aMessageContentWithPayment}
    ${"a message content with a prescription"} | ${aMessageContentPrescription}
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
        }
      )
      .run();

    await context.dispose();
  });
});
