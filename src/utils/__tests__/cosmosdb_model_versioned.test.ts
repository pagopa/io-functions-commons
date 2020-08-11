import * as t from "io-ts";

import { isLeft, isRight } from "fp-ts/lib/Either";
import { isNone } from "fp-ts/lib/Option";

import { NonNegativeInteger } from "italia-ts-commons/lib/numbers";

import {
  Container,
  ErrorResponse,
  FeedResponse,
  ResourceResponse
} from "@azure/cosmos";

import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { BaseModel } from "../cosmosdb_model";
import {
  CosmosdbModelVersioned,
  NewVersionedModel,
  RetrievedVersionedModel
} from "../cosmosdb_model_versioned";

beforeEach(() => {
  jest.clearAllMocks();
});

// test stub that compose a document id from the pair (modelId, version)
const documentId = (modelId: string, version: number): NonEmptyString =>
  `${modelId}${version}` as NonEmptyString;

const aModelIdField = "aModelIdField" as const;
const aModelPartitionField = "aModelPartitionField" as const;
const aModelIdValue = "aModelIdValue";
const aModelPartitionValue = 123;

const MyDocument = t.interface({
  [aModelIdField]: t.string,
  [aModelPartitionField]: t.number,
  test: t.string
});
type MyDocument = t.TypeOf<typeof MyDocument>;

const NewMyDocument = t.intersection([MyDocument, NewVersionedModel]);
type NewMyDocument = t.TypeOf<typeof NewMyDocument>;

const RetrievedMyDocument = t.intersection([
  MyDocument,
  RetrievedVersionedModel,
  BaseModel
]);
type RetrievedMyDocument = t.TypeOf<typeof RetrievedMyDocument>;

class MyModel extends CosmosdbModelVersioned<
  MyDocument,
  NewMyDocument,
  RetrievedMyDocument,
  typeof aModelIdField
> {
  constructor(c: Container) {
    super(c, NewMyDocument, RetrievedMyDocument, aModelIdField);
  }
}

// tslint:disable-next-line: max-classes-per-file
class MyPartitionedModel extends CosmosdbModelVersioned<
  MyDocument,
  NewMyDocument,
  RetrievedMyDocument,
  typeof aModelIdField,
  typeof aModelPartitionField
> {
  constructor(c: Container) {
    super(
      c,
      NewMyDocument,
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

const aNewMyDocument: NewMyDocument = {
  ...aMyDocument
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
// tslint:disable-next-line: no-object-mutation
errorResponse.code = 500;

describe("upsert", () => {
  it("should create a new document with implicit version", async () => {
    const expectedVersion = 0;

    const model = new MyModel(container);

    const result = await model.upsert(aNewMyDocument).run();

    expect(containerMock.items.create).toHaveBeenCalledWith(
      {
        ...aNewMyDocument,
        id: documentId(aMyDocumentId, expectedVersion),
        version: expectedVersion
      },
      { disableAutomaticIdGeneration: true }
    );
    expect(isRight(result));
    if (isRight(result)) {
      expect(result.value).toEqual({
        ...aNewMyDocument,
        ...someMetadata,
        id: documentId(aMyDocumentId, expectedVersion),
        version: expectedVersion
      });
    }
  });

  it("should create a new document with explicit version", async () => {
    const modelCurrentVersion = 2 as NonNegativeInteger;
    const expectedNextVersion = 3;

    const model = new MyModel(container);

    const result = await model
      .upsert({ ...aNewMyDocument, version: modelCurrentVersion })
      .run();

    expect(containerMock.items.create).toHaveBeenCalledWith(
      {
        ...aNewMyDocument,
        id: documentId(aMyDocumentId, expectedNextVersion),
        version: expectedNextVersion
      },
      { disableAutomaticIdGeneration: true }
    );
    expect(isRight(result));
    if (isRight(result)) {
      expect(result.value).toEqual({
        ...aNewMyDocument,
        ...someMetadata,
        id: documentId(aMyDocumentId, expectedNextVersion),
        version: expectedNextVersion
      });
    }
  });

  it("should update an existing document", async () => {
    // tslint:disable-next-line: restrict-plus-operands
    const expectedNextVersion = aRetrievedExistingDocument.version + 1;

    containerMock.items.query.mockReturnValueOnce({
      fetchAll: async () =>
        new FeedResponse([aRetrievedExistingDocument], {}, false)
    });

    // passing a document without explicit version
    const anUpdatedDocument = {
      ...aMyDocument,
      test: "anUpdatedDocument"
    };

    const model = new MyModel(container);
    const result = await model
      .upsert({ ...aNewMyDocument, test: "anUpdatedDocument" })
      .run();

    expect(containerMock.items.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ...anUpdatedDocument,
        id: documentId(aMyDocumentId, expectedNextVersion),
        version: expectedNextVersion
      }),
      {
        disableAutomaticIdGeneration: true
      }
    );
    expect(isRight(result));
    if (isRight(result)) {
      expect(result.value).toEqual({
        ...aRetrievedExistingDocument,
        ...someMetadata,
        id: documentId(aMyDocumentId, expectedNextVersion),
        test: "anUpdatedDocument",
        version: expectedNextVersion
      });
    }
  });

  it("should fail on query error when retrieving last version", async () => {
    containerMock.items.query.mockReturnValueOnce({
      fetchAll: () => Promise.reject(errorResponse)
    });
    const model = new MyModel(container);

    const result = await model.upsert(aNewMyDocument).run();
    expect(isLeft(result));
    if (isLeft(result)) {
      expect(result.value.kind).toBe("COSMOS_ERROR_RESPONSE");
      if (result.value.kind === "COSMOS_ERROR_RESPONSE") {
        expect(result.value.error.code).toBe(500);
      }
    }
  });

  it("should fail on query error when creating next version", async () => {
    containerMock.items.query.mockReturnValueOnce({
      fetchAll: () => Promise.resolve(new FeedResponse([], {}, false))
    });
    containerMock.items.create.mockRejectedValueOnce(errorResponse);
    const model = new MyModel(container);

    const result = await model.upsert(aNewMyDocument).run();
    expect(isLeft(result));
    if (isLeft(result)) {
      expect(result.value.kind).toBe("COSMOS_ERROR_RESPONSE");
      if (result.value.kind === "COSMOS_ERROR_RESPONSE") {
        expect(result.value.error.code).toBe(500);
      }
    }
  });
});

describe("findLastVersionByModelId", () => {
  it("should return none when the document is not found", async () => {
    const model = new MyModel(container);
    const result = await model.findLastVersionByModelId([aModelIdValue]).run();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(isNone(result.value)).toBeTruthy();
    }
  });

  it("should return none when the document is not found on partitioned model", async () => {
    const model = new MyPartitionedModel(container);
    const result = await model
      .findLastVersionByModelId([aModelIdValue, aModelPartitionValue])
      .run();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(isNone(result.value)).toBeTruthy();
    }
  });

  it("should fail on query error", async () => {
    containerMock.items.query.mockReturnValueOnce({
      fetchAll: () => Promise.reject(errorResponse)
    });
    const model = new MyModel(container);
    const result = await model.findLastVersionByModelId([aModelIdValue]).run();
    expect(isLeft(result));
    if (isLeft(result)) {
      expect(result.value.kind).toBe("COSMOS_ERROR_RESPONSE");
      if (result.value.kind === "COSMOS_ERROR_RESPONSE") {
        expect(result.value.error.code).toBe(500);
      }
    }
  });
});
