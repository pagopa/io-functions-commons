import * as t from "io-ts";

import { isLeft, isRight } from "fp-ts/lib/Either";
import { fromNullable, isNone } from "fp-ts/lib/Option";

import { NonNegativeInteger } from "italia-ts-commons/lib/numbers";

import { Container, FeedResponse, ResourceResponse } from "@azure/cosmos";

import { BaseModel } from "../cosmosdb_model";
import {
  CosmosdbModelVersioned,
  VersionedModel
} from "../cosmosdb_model_versioned";

beforeEach(() => {
  jest.resetAllMocks();
});

const aModelIdField = "aModelIdField" as const;
const aModelIdValue = "aModelIdValue";

const MyDocument = t.interface({
  [aModelIdField]: t.string,
  test: t.string
});
type MyDocument = t.TypeOf<typeof MyDocument>;

const NewMyDocument = t.intersection([
  MyDocument,
  t.partial({
    version: NonNegativeInteger
  })
]);
type NewMyDocument = t.TypeOf<typeof NewMyDocument>;

const RetrievedMyDocument = t.intersection([
  MyDocument,
  VersionedModel,
  BaseModel
]);
type RetrievedMyDocument = t.TypeOf<typeof RetrievedMyDocument>;

class MyModel extends CosmosdbModelVersioned<
  MyDocument,
  NewMyDocument,
  RetrievedMyDocument
> {
  constructor(c: Container) {
    super(c, NewMyDocument, RetrievedMyDocument, aModelIdField);
  }
}

const aMyDocumentId = aModelIdValue + "-000000000000000";

const aNewMyDocument: NewMyDocument = {
  [aModelIdField]: aModelIdValue,
  test: "aNewMyDocument"
};

const anExistingDocument = {
  id: aMyDocumentId + "1",
  [aModelIdField]: aModelIdValue,
  test: "anExistingDocument",
  version: 1 as NonNegativeInteger
};

const someMetadata = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};

const containerMock = {
  item: jest.fn(),
  items: {
    create: jest.fn(),
    query: jest.fn(),
    upsert: jest.fn()
  }
};
const container = (containerMock as unknown) as Container;

describe("upsert", () => {
  it("should create a new document with implicit version", async () => {
    containerMock.items.query.mockReturnValueOnce({
      fetchAll: () => Promise.resolve(new FeedResponse([], {}, false))
    });
    containerMock.items.create.mockResolvedValueOnce(
      new ResourceResponse(
        {
          ...aNewMyDocument,
          ...someMetadata,
          id: aMyDocumentId + "0",
          version: 0
        },
        {},
        200,
        200
      )
    );
    const model = new MyModel(container);

    const result = await model.upsert(aNewMyDocument).run();
    expect(containerMock.items.create).toHaveBeenCalledWith(
      {
        ...aNewMyDocument,
        id: aMyDocumentId + "0",
        version: 0
      },
      { disableAutomaticIdGeneration: true }
    );
    expect(isRight(result));
    if (isRight(result)) {
      expect(result.value).toEqual({
        ...aNewMyDocument,
        ...someMetadata,
        id: aMyDocumentId + "0",
        version: 0
      });
    }
  });

  it("should create a new document with explicit version", async () => {
    containerMock.items.query.mockReturnValueOnce({
      fetchAll: () => Promise.resolve(new FeedResponse([], {}, false))
    });
    containerMock.items.create.mockResolvedValueOnce(
      new ResourceResponse(
        {
          ...aNewMyDocument,
          ...someMetadata,
          id: aMyDocumentId + "2",
          version: 2
        },
        {},
        200,
        200
      )
    );
    const model = new MyModel(container);

    const result = await model
      .upsert({ ...aNewMyDocument, version: 2 as NonNegativeInteger })
      .run();
    expect(containerMock.items.create).toHaveBeenCalledWith(
      {
        ...aNewMyDocument,
        id: aMyDocumentId + "2",
        version: 2
      },
      { disableAutomaticIdGeneration: true }
    );
    expect(isRight(result));
    if (isRight(result)) {
      expect(result.value).toEqual({
        ...aNewMyDocument,
        ...someMetadata,
        id: aMyDocumentId + "2",
        version: 2
      });
    }
  });

  it("should update an existing document", async () => {
    containerMock.items.query.mockReturnValueOnce({
      fetchAll: () =>
        Promise.resolve(new FeedResponse([anExistingDocument], {}, false))
    });
    containerMock.items.create.mockResolvedValueOnce(
      new ResourceResponse(
        {
          ...aNewMyDocument,
          ...someMetadata,
          id: aMyDocumentId + "2",
          test: "anUpdatedDocument",
          version: 2
        },
        {},
        200,
        200
      )
    );
    const model = new MyModel(container);
    const result = await model
      .upsert({ ...aNewMyDocument, test: "anUpdatedDocument" })
      .run();
    expect(containerMock.items.create).toHaveBeenCalledWith(
      {
        ...anExistingDocument,
        id: aMyDocumentId + "2",
        test: "anUpdatedDocument",
        version: 2
      },
      { disableAutomaticIdGeneration: true }
    );
    expect(isRight(result));
    if (isRight(result)) {
      expect(result.value).toEqual({
        ...anExistingDocument,
        ...someMetadata,
        id: aMyDocumentId + "2",
        test: "anUpdatedDocument",
        version: 2
      });
    }
  });

  it("should fail on query error when retrieving last version", async () => {
    containerMock.items.query.mockReturnValueOnce({
      fetchAll: () => Promise.reject({ code: 500 })
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
    containerMock.items.create.mockRejectedValueOnce({ code: 500 });
    const model = new MyModel(container);

    const result = await model.upsert(aNewMyDocument).run();
    expect(isLeft(result));
    if (isLeft(result)) {
      expect(result.value.kind).toBe("COSMOS_ERROR_RESPONSE");
      if (
        result.value.kind === "COSMOS_ERROR_RESPONSE" &&
        fromNullable(result.value.error.code).isSome()
      ) {
        expect(result.value.error.code).toBe(500);
      }
    }
  });
});

describe("findLastVersionByModelId", () => {
  it("should return none when the document is not found", async () => {
    containerMock.items.query.mockReturnValueOnce({
      fetchAll: () => Promise.resolve(new FeedResponse([], {}, false))
    });
    const model = new MyModel(container);
    const result = await model
      .findLastVersionByModelId(aModelIdField, aModelIdValue)
      .run();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(isNone(result.value)).toBeTruthy();
    }
  });

  it("should fail on query error", async () => {
    containerMock.items.query.mockReturnValueOnce({
      fetchAll: () => Promise.reject({ code: 500 })
    });
    const model = new MyModel(container);
    const result = await model
      .findLastVersionByModelId(aModelIdField, aModelIdValue)
      .run();
    expect(isLeft(result));
    if (isLeft(result)) {
      expect(result.value.kind).toBe("COSMOS_ERROR_RESPONSE");
      if (result.value.kind === "COSMOS_ERROR_RESPONSE") {
        expect(result.value.error.code).toBe(500);
      }
    }
  });
});
