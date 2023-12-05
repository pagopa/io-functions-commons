import { describe, it, expect, jest } from "@jest/globals";

import { TableEntityResult, odata } from "@azure/data-tables";
import {
  DataTableProfileEmailsRepository,
  toProfileEmailsAsyncIterator
} from "../storage";

import { TableClient } from "@azure/data-tables";
import { ProfileEmail } from "../index";

import * as E from "fp-ts/lib/Either";
import { EmailString } from "@pagopa/ts-commons/lib/strings";

jest.mock("@azure/data-tables");

async function* listEntities(): AsyncIterableIterator<
  TableEntityResult<unknown>
> {
  yield {
    partitionKey: "citizen@email.test.pagopa.it",
    rowKey: "AAAAAA00A00A000A",
    etag: "etag"
  };
  yield {
    partitionKey: "not-a-valid-email",
    rowKey: "AAAAAA00A00A000A",
    etag: "etag"
  };
}

describe("toProfileEmailsAsyncIterator", () => {
  it("emits only valid entities", async () => {
    let count = 0;
    for await (const _ of toProfileEmailsAsyncIterator(listEntities())) {
      count++;
    }
    expect(count).toBe(1);
  });
});

const MockedTableClient = jest.mocked(TableClient);

const tableClient = new MockedTableClient(
  "https://test.localhost",
  "test-table"
);

describe("DataTableProfileEmailsRepository", () => {
  describe("profileEmails", () => {
    it("normalizes input e-mail address", async () => {
      const repo = new DataTableProfileEmailsRepository(tableClient);
      const input = EmailString.decode("CITIZEN@EMAIL.TEST.PAGOPA.IT");
      if (E.isRight(input)) {
        await repo.profileEmails(input.right).next();
        expect(jest.mocked(odata)).toHaveBeenCalledWith(
          expect.any(Array),
          "citizen@email.test.pagopa.it"
        );
      }
      expect.hasAssertions();
    });
  });

  describe("insert", () => {
    it.each(["citizen@email.test.pagopa.it", "CITIZEN@EMAIL.TEST.PAGOPA.IT"])(
      "normalizes input e-mail addresses",
      async email => {
        const repo = new DataTableProfileEmailsRepository(tableClient);
        const profileEmail = ProfileEmail.decode({
          email,
          fiscalCode: "AAAAAA00A00A000A"
        });
        if (E.isRight(profileEmail)) {
          await repo.insert(profileEmail.right);
          expect(tableClient.createEntity).toHaveBeenCalledWith({
            partitionKey: "citizen@email.test.pagopa.it",
            rowKey: "AAAAAA00A00A000A"
          });
        }
        expect.hasAssertions();
      }
    );
  });
});
