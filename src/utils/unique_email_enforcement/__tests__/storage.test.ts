import { describe, it, expect, jest } from "@jest/globals";

import { odata } from "@azure/data-tables";
import { DataTableProfileEmailsRepository } from "../storage";

import { TableClient } from "@azure/data-tables";
import { ProfileEmail } from "../index";

import * as E from "fp-ts/lib/Either";
import { EmailString } from "@pagopa/ts-commons/lib/strings";

jest.mock("@azure/data-tables");

const MockedTableClient = jest.mocked(TableClient);
const mockedOdata = jest.mocked(odata);

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
        try {
          await repo.list(input.right).next();
        } catch {}
        expect(mockedOdata).toHaveBeenCalledWith(
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
          fiscalCode: "RLDBSV36A78Y792X"
        });
        if (E.isRight(profileEmail)) {
          await repo.insert(profileEmail.right);
          expect(tableClient.createEntity).toHaveBeenCalledWith({
            partitionKey: "citizen@email.test.pagopa.it",
            rowKey: "RLDBSV36A78Y792X"
          });
        }
        expect.hasAssertions();
      }
    );
  });
});
