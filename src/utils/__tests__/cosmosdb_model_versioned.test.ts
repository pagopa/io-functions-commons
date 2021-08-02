import * as t from "io-ts";

import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";

import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";

import {
  Container,
  ErrorResponse,
  FeedResponse,
  ResourceResponse
} from "@azure/cosmos";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { BaseModel } from "../cosmosdb_model";
import {
  CosmosdbModelVersioned,
  generateVersionedModelId,
  RetrievedVersionedModel
} from "../cosmosdb_model_versioned";

beforeEach(() => {
  jest.clearAllMocks();
});

const aModelIdField = "aModelIdField" as const;
const aModelPartitionField = "aModelPartitionField" as const;
const aModelIdValue = "aModelIdValue";
const aModelPartitionValue = 123;

// test stub that compose a document id from the pair (modelId, version)
const documentId = (modelId: string, version: number): NonEmptyString =>
  generateVersionedModelId<MyDocument, typeof aModelIdField>(
    modelId,
    version as NonNegativeInteger
  );

const MyDocument = t.interface({
  [aModelIdField]: t.string,
  [aModelPartitionField]: t.number,
  test: t.string
});
type MyDocument = t.TypeOf<typeof MyDocument>;

const RetrievedMyDocument = t.intersection([
  MyDocument,
  RetrievedVersionedModel,
  BaseModel
]);
type RetrievedMyDocument = t.TypeOf<typeof RetrievedMyDocument>;

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

const aMyDocumentId = aModelIdValue + "-000000000000000";

const aMyDocument = {
  [aModelIdField]: aModelIdValue,
  [aModelPartitionField]: aModelPartitionValue,
  test: "aNewMyDocument"
};

const someMetadata = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};

const aRetrievedExistingDocument: RetrievedMyDocument = {
  ...someMetadata,
  ...aMyDocument,
  id: documentId(aMyDocumentId, 1),
  version: 1 as NonNegativeInteger
};
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
          new FeedResponse([currentlyOnDb].filter(Boolean), {}, false)
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
      fetchAll: () => Promise.resolve(new FeedResponse([], {}, false))
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
