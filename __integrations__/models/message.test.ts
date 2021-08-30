/* eslint-disable no-console */
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  MESSAGE_MODEL_PK_FIELD,
  MessageModel,
  NewMessageWithoutContent,
  RetrievedMessage
} from "../../src/models/message";
import { createContext } from "./cosmos_utils";
import { fromOption } from "fp-ts/lib/Either";
import { ServiceId } from "../../generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "../../generated/definitions/TimeToLiveSeconds";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import { isSome } from "fp-ts/lib/Option";
import { CosmosErrors } from "../../src/utils/cosmosdb_model";
import { Validation } from "io-ts";
import * as E from "fp-ts/lib/Either";

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

const asyncIteratorToPagedResults = <T>(source: AsyncIterator<T>) => {
  return source.next().then(ir => ir.value as T);
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
      TE.bimap(
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
      TE.toUnion
    )();

    // find the message by query
    await pipe(
      TE.of<any, void>(void 0),
      TE.chainW(_ =>
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
      TE.chain(_ => TE.fromEither(fromOption(() => "It's none")(_))),
      TE.bimap(
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
      TE.of<any, void>(void 0),
      TE.chainW(_ =>
        model.find([
          aNewMessageWithoutContent.id,
          aNewMessageWithoutContent.fiscalCode
        ])
      ),
      TE.chain(_ => TE.fromEither(fromOption(() => "It's none")(_))),
      TE.bimap(
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
    const results = await pipe(
      model.findMessages(aFiscalCode),
      TE.map(asyncIteratorToPagedResults),
      TE.getOrElseW<CosmosErrors, ReadonlyArray<Validation<RetrievedMessage>>>(
        _ => {
          throw new Error("Error");
        }
      )
    )();

    expect(results).toEqual(expect.any(Array));
    expect(results).toHaveLength(1);
    expect(E.isRight(results[0])).toBe(true);
    if (E.isRight(results[0])) {
      expect(results[0].right).toEqual(
        expect.objectContaining({
          ...aSerializedNewMessageWithoutContent
        })
      );
    }

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
      TE.bimap(
        _ => fail(`Failed to store content, error: ${JSON.stringify(_)}`),
        result => {
          expect(isSome(result)).toBe(true);
          return result;
        }
      )
    )();

    await pipe(
      model.getContentFromBlob(context.storage, aFakeMessageId),
      TE.chain(_ =>
        TE.fromEither(fromOption(() => new Error(`Blob not found`))(_))
      ),
      TE.bimap(
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
