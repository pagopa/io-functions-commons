import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { CosmosdbModelComposedVersioned, generateComposedVersionedModelId } from "../cosmosdb_model_composed_versioned";
import * as t from "io-ts";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { RetrievedVersionedModel } from "../cosmosdb_model_versioned";
import { BaseModel } from "../cosmosdb_model";
import { Container, ErrorResponse, FeedResponse, ResourceResponse } from "@azure/cosmos";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";

const aModelExternalKeyId = "aModelExternalKeyId" as const;
const aModelPartitionField = "aModelPartitionField" as const;
const aModelExternalKeyValue = "aModelExternalKeyValue";
const aModelPartitionValue = 123;

const MyDocument = t.interface({
  [aModelExternalKeyId]: t.string,
  [aModelPartitionField]: t.number,
  test: t.string
});
type MyDocument = t.TypeOf<typeof MyDocument>;

// test stub that compose a document id from the tuple (externalKey, partitionKey, version)
const documentId = (externalKey: string, partitionKey: number, version: number): NonEmptyString =>
  generateComposedVersionedModelId<MyDocument, typeof aModelExternalKeyId, typeof aModelPartitionField>(
    externalKey,
    partitionKey,
    version as NonNegativeInteger
  );

const RetrievedMyDocument = t.intersection([
  MyDocument,
  RetrievedVersionedModel,
  BaseModel
]);
type RetrievedMyDocument = t.TypeOf<typeof RetrievedMyDocument>;

class MyComposedModel extends CosmosdbModelComposedVersioned<
  MyDocument,
  MyDocument,
  RetrievedMyDocument,
  typeof aModelExternalKeyId,
  typeof aModelPartitionField
> {
  constructor(c: Container) {
    super(c, MyDocument, RetrievedMyDocument, aModelExternalKeyId, aModelPartitionField);
  }
}

const aMyDocument = {
  [aModelExternalKeyId]: aModelExternalKeyValue,
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
  id: documentId(aModelExternalKeyValue, aModelPartitionValue, 1),
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

beforeEach(() => {
  jest.clearAllMocks();
});

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

      const model = new MyComposedModel(container);
      const result = await model.upsert(document)();

      expect(containerMock.items.create).toHaveBeenCalledWith(
        {
          ...document,
          id: documentId(document[aModelExternalKeyId], document[aModelPartitionField], expectedVersion),
          version: expectedVersion
        },
        { disableAutomaticIdGeneration: true }
      );
      expect(E.isRight(result));
      if (E.isRight(result)) {
        expect(result.right).toEqual({
          ...document,
          ...someMetadata,
          id: documentId(document[aModelExternalKeyId], document[aModelPartitionField], expectedVersion),
          version: expectedVersion
        });
      }
    }
  );

  it("should fail on query error when retrieving last version", async () => {
    containerMock.items.query.mockReturnValueOnce({
      fetchAll: () => Promise.reject(errorResponse)
    });
    const model = new MyComposedModel(container);

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
    const model = new MyComposedModel(container);

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
    const externalKey = aMyDocument[aModelExternalKeyId];
    const pk = aMyDocument[aModelPartitionField];
    const model = new MyComposedModel(container);

    const result = await model.create(aMyDocument)();

    expect(containerMock.items.create).toHaveBeenCalledWith(
      {
        ...aMyDocument, // base type
        id: documentId(externalKey, pk, expectedNextVersion),
        version: expectedNextVersion
      },
      { disableAutomaticIdGeneration: true }
    );
    expect(E.isRight(result));
    if (E.isRight(result)) {
      expect(result.right).toEqual({
        ...aMyDocument,
        ...someMetadata,
        id: documentId(externalKey, pk, expectedNextVersion),
        version: expectedNextVersion
      });
    }
  });
});

describe("create", () => {
  it("should create a new document with version 0", async () => {
    const expectedNextVersion = aRetrievedExistingDocument.version + 1;
    const externalKey = aRetrievedExistingDocument[aModelExternalKeyId];
    const pk = aRetrievedExistingDocument[aModelPartitionField];
    const model = new MyComposedModel(container);

    const result = await model.update(aRetrievedExistingDocument)();

    expect(containerMock.items.create).toHaveBeenCalledWith(
      {
        ...aMyDocument, // base type
        id: documentId(externalKey, pk, expectedNextVersion),
        version: expectedNextVersion
      },
      { disableAutomaticIdGeneration: true }
    );
    expect(E.isRight(result));
    if (E.isRight(result)) {
      expect(result.right).toEqual({
        ...aMyDocument,
        ...someMetadata,
        id: documentId(externalKey, pk, expectedNextVersion),
        version: expectedNextVersion
      });
    }
  });
});

describe("findLastVersionByModelId", () => {
  it("should return none when the document is not found on partitioned model", async () => {
    const model = new MyComposedModel(container);
    const result = await model.findLastVersionByModelId([
      aModelExternalKeyValue,
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
    const model = new MyComposedModel(container);
    const result = await model.findLastVersionByModelId([aModelExternalKeyValue, aModelPartitionValue])();
    expect(E.isLeft(result));
    if (E.isLeft(result)) {
      expect(result.left.kind).toBe("COSMOS_ERROR_RESPONSE");
      if (result.left.kind === "COSMOS_ERROR_RESPONSE") {
        expect(result.left.error.code).toBe(500);
      }
    }
  });
});

describe("typings restrictions", () => {
  it("should NOT accept modelExternalKeyId equals to partitionKeyId", () => {
    class MyComposedModel extends CosmosdbModelComposedVersioned<
      MyDocument,
      MyDocument,
      RetrievedMyDocument,
      typeof aModelExternalKeyId,
      // @ts-expect-error
      typeof aModelExternalKeyId
    > {
      constructor(c: Container) {
        super(c, MyDocument, RetrievedMyDocument, aModelExternalKeyId, aModelExternalKeyId);
      }
    }
  });
});

