import {
  GetTableEntityResponse,
  odata,
  TableEntityResult,
} from "@azure/data-tables";
import { TableClient } from "@azure/data-tables";
import { describe, expect, it, vi } from "vitest";
import { EmailString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";

import { ProfileEmail } from "../index";
import { DataTableProfileEmailsRepository } from "../storage";

vi.mock("@azure/data-tables");

const MockedTableClient = vi.mocked(TableClient);
const mockedOdata = vi.mocked(odata);

class MockPagedAsyncIterableIterator {
  constructor() {}
  byPage(): AsyncIterableIterator<TableEntityResult<unknown>[]> {
    return {
      async next() {
        return this.next();
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  }
  async next(): Promise<IteratorResult<TableEntityResult<unknown>>> {
    return {
      done: false,
      value: {
        etag: "",
        partitionKey: "",
        rowKey: "",
      },
    };
  }
  [Symbol.asyncIterator]() {
    return this;
  }
}

MockedTableClient.prototype.listEntities.mockReturnValue(
  new MockPagedAsyncIterableIterator(),
);

MockedTableClient.prototype.getEntity.mockImplementation(
  <T extends object = Record<string, unknown>>(
    partitionKey: string,
    rowKey: string,
  ) =>
    Promise.resolve({
      etag: "etag",
      "odata.metadata": "odata.metadata",
      partitionKey,
      rowKey,
      timestamp: "2024-01-09T09:41:37.7269414Z",
    } as unknown as GetTableEntityResponse<TableEntityResult<T>>),
);

const tableClient = new MockedTableClient(
  "https://test.localhost",
  "test-table",
);

describe("DataTableProfileEmailsRepository", () => {
  describe("list", () => {
    it("normalizes input e-mail address", async () => {
      const repo = new DataTableProfileEmailsRepository(tableClient);
      const input = EmailString.decode("CITIZEN@EMAIL.TEST.PAGOPA.IT");
      if (E.isRight(input)) {
        try {
          await repo.list(input.right).next();
        } catch {}
        expect(mockedOdata).toHaveBeenCalledWith(
          expect.any(Array),
          "citizen@email.test.pagopa.it",
        );
      }
      expect.hasAssertions();
    });
    it("throws an error on invalid entity", () => {
      const repo = new DataTableProfileEmailsRepository(tableClient);
      const input = EmailString.decode("CITIZEN@EMAIL.TEST.PAGOPA.IT");
      if (E.isRight(input)) {
        expect(() => repo.list(input.right).next()).rejects.toThrowError(
          /can't parse/,
        );
      }
      expect.hasAssertions();
    });
  });

  describe("insert", () => {
    it.each(["citizen@email.test.pagopa.it", "CITIZEN@EMAIL.TEST.PAGOPA.IT"])(
      "normalizes input e-mail addresses",
      async (email) => {
        const repo = new DataTableProfileEmailsRepository(tableClient);
        const profileEmail = ProfileEmail.decode({
          email,
          fiscalCode: "RLDBSV36A78Y792X",
        });
        if (E.isRight(profileEmail)) {
          await repo.insert(profileEmail.right);
          expect(tableClient.createEntity).toHaveBeenCalledWith({
            partitionKey: "citizen@email.test.pagopa.it",
            rowKey: "RLDBSV36A78Y792X",
          });
        }
        expect.hasAssertions();
      },
    );
  });

  describe("delete", () => {
    it("deletes the rights entity", async () => {
      const repo = new DataTableProfileEmailsRepository(tableClient);
      const profileEmail = ProfileEmail.decode({
        email: "citizen@email.test.pagopa.it",
        fiscalCode: "RLDBSV36A78Y792X",
      });
      if (E.isRight(profileEmail)) {
        await repo.delete(profileEmail.right);
        expect(tableClient.createEntity).toHaveBeenCalledWith({
          partitionKey: "citizen@email.test.pagopa.it",
          rowKey: "RLDBSV36A78Y792X",
        });
      }
    });
  });
});
