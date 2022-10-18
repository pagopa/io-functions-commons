import { Container, FeedResponse, ResourceResponse } from "@azure/cosmos";
import {
  aModelIdField,
  aModelIdValue,
  aRetrievedExistingDocument,
  MyDocument,
  RetrievedMyDocument
} from "../../../__mocks__/mocks";

import * as E from "fp-ts/lib/Either";

import { CosmosdbModelVersionedTTL } from "../cosmosdb_model_versioned_ttl";

const containerMock = {
  item: jest.fn(),
  items: {
    create: jest
      .fn()
      .mockImplementation(async doc => new ResourceResponse(doc, {}, 200, 200)),
    query: jest.fn().mockReturnValue({
      fetchAll: async () => new FeedResponse([], {}, false)
    }),
    upsert: jest.fn()
  }
};
const container = (containerMock as unknown) as Container;

async function* yieldValues<T>(elements: T[]): AsyncIterable<T> {
  for (const e of elements) {
    yield e;
  }
}

class MyModel extends CosmosdbModelVersionedTTL<
  MyDocument,
  MyDocument,
  RetrievedMyDocument,
  typeof aModelIdField
> {
  constructor(c: Container) {
    super(c, MyDocument, RetrievedMyDocument, aModelIdField);
  }
}

describe("findAllVersionsBySearchKey", () => {
  it("should return 3 documents", async () => {
    containerMock.items.query.mockReturnValueOnce({
      getAsyncIterator: () =>
        yieldValues([
          new FeedResponse([aRetrievedExistingDocument], {}, false),
          new FeedResponse(
            [aRetrievedExistingDocument, aRetrievedExistingDocument],
            {},
            false
          )
        ])
    });

    const model = new MyModel(container);
    const result = await model.findAllVersionsBySearchKey([aModelIdValue])();
    if (E.isRight(result)) {
      expect(result.right).toHaveLength(3);
    }
  });
});
