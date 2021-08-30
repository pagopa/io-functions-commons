/* eslint-disable no-console */
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import {
  bimap,
  chain,
  chainW,
  fold,
  foldW,
  fromEither,
  taskEither,
  of,
  toUnion,
  tryCatch
} from "fp-ts/lib/TaskEither";
import {
  MESSAGE_MODEL_PK_FIELD,
  MessageModel,
  NewMessageWithoutContent
} from "../../src/models/message";
import { createContext } from "./cosmos_utils";
import { fromOption } from "fp-ts/lib/Either";
import { ServiceId } from "../../generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "../../generated/definitions/TimeToLiveSeconds";
import { toCosmosErrorResponse } from "../../src/utils/cosmosdb_model";
import {
  asyncIterableToArray,
  flattenAsyncIterable
} from "../../src/utils/async";
import { pipe } from "fp-ts/lib/function";

import * as e from "fp-ts/lib/Either";
import { isSome } from "fp-ts/lib/Option";

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

describe("Models |> Message", () => {
  it("should save messages without content", async () => {
    const context = await createContext(MESSAGE_MODEL_PK_FIELD);
    await context.init();
    const model = new MessageModel(context.container, MESSAGE_CONTAINER_NAME);

    // create a new document
    const created = await pipe(
      model.create(aNewMessageWithoutContent),
      x => x,
      bimap(
        _ => fail(`Failed to create doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aSerializedNewMessageWithoutContent
            })
          );
          return result;
        }
      ),
      toUnion
    )();

    // find the message by query
    await pipe(
      of<any, void>(void 0),
      chainW(_ =>
        model.findOneByQuery({
          parameters: [
            {
              name: "@id",
              value: aNewMessageWithoutContent.id
            }
          ],
          query: `SELECT * FROM m WHERE m.id = @id`
        })
      ),
      chain(_ => fromEither(fromOption(() => "It's none")(_))),
      bimap(
        _ => fail(`Failed to read single doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aSerializedNewMessageWithoutContent
            })
          );
        }
      )
    )();

    // find the message by recipient
    await pipe(
      of<any, void>(void 0),
      chainW(_ =>
        model.find([
          aNewMessageWithoutContent.id,
          aNewMessageWithoutContent.fiscalCode
        ])
      ),
      chain(_ => fromEither(fromOption(() => "It's none")(_))),
      bimap(
        _ => fail(`Failed to find one doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aSerializedNewMessageWithoutContent
            })
          );
          return result;
        }
      )
    )();

    // find all message for a fiscal code
    await pipe(
      tryCatch(
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
      ),
      bimap(
        _ => fail(`Failed to read all docs, error: ${JSON.stringify(_)}`),
        results => {
          expect(results).toEqual(expect.any(Array));
          expect(results).toHaveLength(1);
          pipe(
            results[0],
            e.bimap(
              _ => fail(`Failed to validate , error: ${JSON.stringify(_)}`),
              result => {
                expect(result).toEqual(
                  expect.objectContaining({
                    ...aSerializedNewMessageWithoutContent
                  })
                );
              }
            ),
            e.toUnion
          );
        }
      )
    )();

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

    await pipe(
      model.storeContentAsBlob(context.storage, aFakeMessageId, value),
      bimap(
        _ => fail(`Failed to store content, error: ${JSON.stringify(_)}`),
        result => {
          expect(isSome(result)).toBe(true);
          return result;
        }
      )
    )();

    await pipe(
      model.getContentFromBlob(context.storage, aFakeMessageId),
      chain(_ => fromEither(fromOption(() => new Error(`Blob not found`))(_))),
      bimap(
        _ => fail(`Failed to get content, error: ${JSON.stringify(_)}`),
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
    )();

    await context.dispose();
  });
});
