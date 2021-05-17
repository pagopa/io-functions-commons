/* eslint-disable no-console */
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { fromEither, taskEither, tryCatch } from "fp-ts/lib/TaskEither";
import {
  Message,
  MESSAGE_MODEL_PK_FIELD,
  MessageModel,
  NewMessageWithoutContent,
  MessageWithoutContent
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

describe("Models |> Service", () => {
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
});
