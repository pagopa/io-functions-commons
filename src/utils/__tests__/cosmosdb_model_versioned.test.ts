import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";

import {
  aModelIdField,
  aModelIdValue,
  aModelPartitionField,
  aModelPartitionValue,
  aRetrievedExistingDocument,
  documentId,
  aMyDocument,
  someMetadata,
  MyDocument,
  RetrievedMyDocument
} from "../../../__mocks__/mocks";

import {
  Container,
  CosmosDiagnostics,
  ErrorResponse,
  FeedResponse,
  ResourceResponse
} from "@azure/cosmos";

import { CosmosdbModelVersioned } from "../cosmosdb_model_versioned";

const cosmosDiagnostics = new CosmosDiagnostics();

beforeEach(() => {
  jest.clearAllMocks();
});

class MyModel extends CosmosdbModelVersioned<
  MyDocument,
  MyDocument,
  RetrievedMyDocument,
  typeof aModelIdField
> {
  constructor(c: Container) {
    super(c, MyDocument, RetrievedMyDocument, aModelIdField);
  }
}

// eslint-disable-next-line max-classes-per-file
class MyPartitionedModel extends CosmosdbModelVersioned<
  MyDocument,
  MyDocument,
  RetrievedMyDocument,
  typeof aModelIdField,
  typeof aModelPartitionField
> {
  constructor(c: Container) {
    super(
      c,
      MyDocument,
      RetrievedMyDocument,
      aModelIdField,
      aModelPartitionField
    );
  }
}

const containerMock = {
  item: jest.fn(),
  items: {
    create: jest
      .fn()
      .mockImplementation(
        async doc => new ResourceResponse(doc, {}, 200, cosmosDiagnostics, 200)
      ),
    query: jest.fn().mockReturnValue({
      fetchAll: async () => new FeedResponse([], {}, false, cosmosDiagnostics)
    }),
    upsert: jest.fn()
  }
};
const container = (containerMock as unknown) as Container;

const errorResponse: ErrorResponse = new Error();
// eslint-disable-next-line functional/immutable-data
errorResponse.code = 500;

describe("upsert", () => {
  it.each`
    document       | currentlyOnDb                 | expectedVersion
    ${aMyDocument} | ${undefined}                  | ${0}
    ${aMyDocument} | ${aRetrievedExistingDocument} | ${aRetrievedExistingDocument.version + 1}
  `(
    "should create a document with version $expectedVersion",
    async ({ document, currentlyOnDb, expectedVersion }) => {
      containerMock.items.query.mockReturnValueOnce({
        fetchAll: async () =>
          // if currentlyOnDb is undefined return empty array
          new FeedResponse(
            [currentlyOnDb].filter(Boolean),
            {},
            false,
            cosmosDiagnostics
          )
      });

      const model = new MyModel(container);

      const result = await model.upsert(document)();

      expect(containerMock.items.create).toHaveBeenCalledWith(
        {
          ...document,
          id: documentId(document[aModelIdField], expectedVersion),
          version: expectedVersion
        },
        { disableAutomaticIdGeneration: true }
      );
      expect(E.isRight(result));
      if (E.isRight(result)) {
        expect(result.right).toEqual({
          ...document,
          ...someMetadata,
          id: documentId(document[aModelIdField], expectedVersion),
          version: expectedVersion
        });
      }
    }
  );
  it("should fail on query error when retrieving last version", async () => {
    containerMock.items.query.mockReturnValueOnce({
      fetchAll: () => Promise.reject(errorResponse)
    });
    const model = new MyModel(container);

    const result = await model.upsert(aMyDocument)();
    expect(E.isLeft(result));
    if (E.isLeft(result)) {
      expect(result.left.kind).toBe("COSMOS_ERROR_RESPONSE");
      if (result.left.kind === "COSMOS_ERROR_RESPONSE") {
        expect(result.left.error.code).toBe(500);
      }
    }
  });

  it("should fail on query error when creating next version", async () => {
    containerMock.items.query.mockReturnValueOnce({
      fetchAll: () =>
        Promise.resolve(new FeedResponse([], {}, false, cosmosDiagnostics))
    });
    containerMock.items.create.mockRejectedValueOnce(errorResponse);
    const model = new MyModel(container);

    const result = await model.upsert(aMyDocument)();
    expect(E.isLeft(result));
    if (E.isLeft(result)) {
      expect(result.left.kind).toBe("COSMOS_ERROR_RESPONSE");
      if (result.left.kind === "COSMOS_ERROR_RESPONSE") {
        expect(result.left.error.code).toBe(500);
      }
    }
  });
});

describe("update", () => {
  it("should create a new document with explicit version", async () => {
    const expectedNextVersion = 0;
    const modelId = aMyDocument[aModelIdField];
    const model = new MyModel(container);

    const result = await model.create(aMyDocument)();

    expect(containerMock.items.create).toHaveBeenCalledWith(
      {
        ...aMyDocument, // base type
        id: documentId(modelId, expectedNextVersion),
        version: expectedNextVersion
      },
      { disableAutomaticIdGeneration: true }
    );
    expect(E.isRight(result));
    if (E.isRight(result)) {
      expect(result.right).toEqual({
        ...aMyDocument,
        ...someMetadata,
        id: documentId(modelId, expectedNextVersion),
        version: expectedNextVersion
      });
    }
  });
});

describe("create", () => {
  it("should create a new document with version 0", async () => {
    const expectedNextVersion = aRetrievedExistingDocument.version + 1;
    const modelId = aRetrievedExistingDocument[aModelIdField];
    const model = new MyModel(container);

    const result = await model.update(aRetrievedExistingDocument)();

    expect(containerMock.items.create).toHaveBeenCalledWith(
      {
        ...aMyDocument, // base type
        id: documentId(modelId, expectedNextVersion),
        version: expectedNextVersion
      },
      { disableAutomaticIdGeneration: true }
    );
    expect(E.isRight(result));
    if (E.isRight(result)) {
      expect(result.right).toEqual({
        ...aMyDocument,
        ...someMetadata,
        id: documentId(modelId, expectedNextVersion),
        version: expectedNextVersion
      });
    }
  });
});

describe("findLastVersionByModelId", () => {
  it("should return none when the document is not found", async () => {
    const model = new MyModel(container);
    const result = await model.findLastVersionByModelId([aModelIdValue])();
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isNone(result.right)).toBeTruthy();
    }
  });

  it("should return none when the document is not found on partitioned model", async () => {
    const model = new MyPartitionedModel(container);
    const result = await model.findLastVersionByModelId([
      aModelIdValue,
      aModelPartitionValue
    ])();
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isNone(result.right)).toBeTruthy();
    }
  });

  it("should fail on query error", async () => {
    containerMock.items.query.mockReturnValueOnce({
      fetchAll: () => Promise.reject(errorResponse)
    });
    const model = new MyModel(container);
    const result = await model.findLastVersionByModelId([aModelIdValue])();
    expect(E.isLeft(result));
    if (E.isLeft(result)) {
      expect(result.left.kind).toBe("COSMOS_ERROR_RESPONSE");
      if (result.left.kind === "COSMOS_ERROR_RESPONSE") {
        expect(result.left.error.code).toBe(500);
      }
    }
  });
});
