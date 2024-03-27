import {
  Container,
  CosmosDiagnostics,
  FeedResponse,
  PatchOperationInput,
  ResourceResponse
} from "@azure/cosmos";
import {
  aModelIdField,
  aModelIdValue,
  aRetrievedExistingDocument,
  documentId,
  MyDocument,
  RetrievedMyDocument
} from "../../../__mocks__/mocks";

import * as E from "fp-ts/lib/Either";

import { CosmosdbModelVersionedTTL } from "../cosmosdb_model_versioned_ttl";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

const retrievedDocumentV0 = aRetrievedExistingDocument;
const retrievedDocumentV1 = {
  ...aRetrievedExistingDocument,
  id: documentId(aModelIdValue, 1),
  version: 1
};
const retrievedDocumentV2 = {
  ...aRetrievedExistingDocument,
  id: documentId(aModelIdValue, 2),
  version: 2
};

const mockBatch = jest
  .fn()
  .mockImplementation(
    async (
      operations: ReadonlyArray<PatchOperationInput>,
      partitionKey: NonEmptyString
    ) => {
      return {
        headers: [],
        result: operations.map(_ => ({ statusCode: 200 })),
        code: 200
      };
    }
  );

const containerMock = {
  item: jest.fn(),
  items: {
    create: jest
      .fn()
      .mockImplementation(
        async doc =>
          new ResourceResponse(doc, {}, 200, new CosmosDiagnostics(), 200)
      ),
    query: jest.fn().mockReturnValue({
      getAsyncIterator: () =>
        yieldValues([
          new FeedResponse(
            [retrievedDocumentV2],
            {},
            false,
            new CosmosDiagnostics()
          ),
          new FeedResponse(
            [retrievedDocumentV0, retrievedDocumentV1],
            {},
            false,
            new CosmosDiagnostics()
          )
        ])
    }),
    batch: mockBatch,
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

beforeEach(() => jest.clearAllMocks());

describe("findAllVersionsBySearchKey", () => {
  it("should return 3 documents", async () => {
    const model = new MyModel(container);
    const result = await model.findAllVersionsBySearchKey([aModelIdValue])();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toHaveLength(3);

      // Check that results are returned in right order
      result.right.map((r, i) => {
        expect(r).toEqual(
          E.right(
            expect.objectContaining({
              id: documentId(aModelIdValue, i),
              version: i
            })
          )
        );
      });
    }
  });
});

describe("updateTTLForAllVersions", () => {
  const expectedOperations = [
    retrievedDocumentV0,
    retrievedDocumentV1,
    retrievedDocumentV2
  ].map(d => ({
    id: d.id,
    operationType: "Patch",
    resourceBody: { operations: [{ op: "add", path: "/ttl", value: 42 }] }
  }));

  it("should add ttl for all documents", async () => {
    const model = new MyModel(container);
    const result = await model.updateTTLForAllVersions(
      [aModelIdValue],
      42 as NonNegativeInteger
    )();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toEqual(3);
    }

    expect(mockBatch).toHaveBeenLastCalledWith(
      expectedOperations,
      aModelIdValue
    );
  });

  it("should return a CosmosError if batch fails", async () => {
    mockBatch.mockImplementationOnce(() => {
      return Promise.reject(Error("an Error"));
    });

    const model = new MyModel(container);
    const result = await model.updateTTLForAllVersions(
      [aModelIdValue],
      42 as NonNegativeInteger
    )();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("COSMOS_ERROR_RESPONSE");
    }

    expect(mockBatch).toHaveBeenLastCalledWith(
      expectedOperations,
      aModelIdValue
    );
  });

  it("should return a CosmosError if some updates fail", async () => {
    mockBatch.mockImplementationOnce(
      async (
        operations: ReadonlyArray<PatchOperationInput>,
        partitionKey: NonEmptyString
      ) => {
        return {
          headers: [],
          result: operations.map(_ => ({ statusCode: 404 })),
          code: 207
        };
      }
    );

    const model = new MyModel(container);
    const result = await model.updateTTLForAllVersions(
      [aModelIdValue],
      42 as NonNegativeInteger
    )();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left).toEqual({
        error: {
          message: `Error updating ttl for ${aModelIdValue} - chunk from ${documentId(
            aModelIdValue,
            0
          )} to ${documentId(aModelIdValue, 2)}`,
          name: `Error updating ttl`
        },
        kind: "COSMOS_ERROR_RESPONSE"
      });
    }

    expect(mockBatch).toHaveBeenLastCalledWith(
      expectedOperations,
      aModelIdValue
    );
  });

  it("should return a CosmosError if batch returns a unexpected value", async () => {
    mockBatch.mockImplementationOnce(
      async (
        operations: ReadonlyArray<PatchOperationInput>,
        partitionKey: NonEmptyString
      ) => {
        return {
          headers: [],
          result: operations.map(_ => ({ statusCode: "200" })),
          code: 200
        };
      }
    );

    const model = new MyModel(container);
    const result = await model.updateTTLForAllVersions(
      [aModelIdValue],
      42 as NonNegativeInteger
    )();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left).toMatchObject({
        error: expect.objectContaining({
          name: `Error decoding batch result`
        }),
        kind: "COSMOS_ERROR_RESPONSE"
      });
    }

    expect(mockBatch).toHaveBeenLastCalledWith(
      expectedOperations,
      aModelIdValue
    );
  });

  it("should never call the batch method if the findAllVersionsBySearchKey returns an empty array", async () => {
    containerMock.items.query.mockReturnValueOnce({
      getAsyncIterator: () => yieldValues([])
    });

    const model = new MyModel(container);

    const result = await model.updateTTLForAllVersions(
      [aModelIdValue],
      42 as NonNegativeInteger
    )();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) expect(result.right).toEqual(0);
    expect(mockBatch).not.toHaveBeenCalled();
  });
});
