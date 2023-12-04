import { describe, it, expect } from "@jest/globals";

import { TableEntityResult } from "@azure/data-tables";
import { toProfileEmailsAsyncIterator } from "../storage";

describe("toProfileEmailsAsyncIterator", () => {
  it("emits only valid entities", async () => {
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
    let count = 0;
    for await (const _ of toProfileEmailsAsyncIterator(listEntities())) {
      count++;
    }
    expect(count).toBe(1);
  });
});
