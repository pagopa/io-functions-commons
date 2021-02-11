import * as t from "io-ts";

import { isLeft, isRight } from "fp-ts/lib/Either";

import { Container, ErrorResponse, ResourceResponse } from "@azure/cosmos";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  BaseModel,
  CosmosdbModel,
  CosmosResource,
  DocumentSearchKey
} from "../cosmosdb_model";

beforeEach(() => {
  jest.resetAllMocks();
});

const MyDocument = t.interface({
  pk: t.string,
  test: t.string
});
type MyDocument = t.TypeOf<typeof MyDocument>;

const NewMyDocument = t.intersection([MyDocument, BaseModel]);
type NewMyDocument = t.TypeOf<typeof NewMyDocument>;

const RetrievedMyDocument = t.intersection([MyDocument, CosmosResource]);
type RetrievedMyDocument = t.TypeOf<typeof RetrievedMyDocument>;

class MyModel extends CosmosdbModel<
  MyDocument,
  NewMyDocument,
  RetrievedMyDocument
> {
  constructor(c: Container) {
    super(c, NewMyDocument, RetrievedMyDocument);
  }
}

// tslint:disable-next-line: max-classes-per-file
class MyPartitionedModel extends CosmosdbModel<
  MyDocument,
  NewMyDocument,
  RetrievedMyDocument,
  "pk"
> {
  constructor(c: Container) {
    super(c, NewMyDocument, RetrievedMyDocument);
  }
}

const readMock = jest.fn();
const containerMock = {
  item: jest.fn(),
  items: {
    create: jest.fn(),
    upsert: jest.fn()
  }
};
const container = (containerMock as unknown) as Container;

const testId = "test-id-1" as NonEmptyString;
const testPartition = "test-partition";

const aDocument = {
  id: testId,
  pk: testPartition,
  test: "test"
};

export const someMetadata = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};

const errorResponse: ErrorResponse = new Error();
// tslint:disable-next-line: no-object-mutation
errorResponse.code = 500;

describe("create", () => {
  it("should create a document", async () => {
    containerMock.items.create.mockResolvedValueOnce(
      new ResourceResponse(
        {
          ...aDocument,
          ...someMetadata
        },
        {},
        200,
        200
      )
    );
    const model = new MyModel(container);
    const result = await model.create(aDocument).run();
    expect(containerMock.items.create).toHaveBeenCalledWith(aDocument, {
      disableAutomaticIdGeneration: true
    });
    expect(isRight(result));
    if (isRight(result)) {
      expect(result.value).toEqual({
        ...aDocument,
        ...someMetadata
      });
    }
  });

  it("should fail on query error", async () => {
    containerMock.items.create.mockRejectedValueOnce(errorResponse);
    const model = new MyModel(container);

    const result = await model.create(aDocument).run();
    expect(isLeft(result));
    if (isLeft(result)) {
      expect(result.value.kind).toBe("COSMOS_ERROR_RESPONSE");
      if (result.value.kind === "COSMOS_ERROR_RESPONSE") {
        expect(result.value.error.code).toBe(500);
      }
    }
  });

  it("should fail on empty response", async () => {
    containerMock.items.create.mockResolvedValueOnce({});
    const model = new MyModel(container);

    const result = await model.create(aDocument).run();
    expect(isLeft(result));
    if (isLeft(result)) {
      expect(result.value).toEqual({ kind: "COSMOS_EMPTY_RESPONSE" });
    }
  });
});

describe("upsert", () => {
  it("should create a document", async () => {
    containerMock.items.upsert.mockResolvedValueOnce({});
    const model = new MyModel(container);
    await model.upsert(aDocument).run();
    expect(containerMock.items.upsert).toHaveBeenCalledWith(aDocument, {
      disableAutomaticIdGeneration: true
    });
  });

  it("should fail on query error", async () => {
    containerMock.items.upsert.mockRejectedValueOnce(errorResponse);
    const model = new MyModel(container);

    const result = await model.upsert(aDocument).run();
    expect(isLeft(result));
    if (isLeft(result)) {
      expect(result.value.kind).toBe("COSMOS_ERROR_RESPONSE");
      if (result.value.kind === "COSMOS_ERROR_RESPONSE") {
        expect(result.value.error.code).toBe(500);
      }
    }
  });

  it("should fail on empty response", async () => {
    containerMock.items.upsert.mockResolvedValueOnce({});
    const model = new MyModel(container);

    const result = await model.upsert(aDocument).run();
    expect(isLeft(result));
    if (isLeft(result)) {
      expect(result.value).toEqual({ kind: "COSMOS_EMPTY_RESPONSE" });
    }
  });

  it("should return the created document as retrieved type", async () => {
    containerMock.items.upsert.mockResolvedValueOnce(
      new ResourceResponse(
        {
          ...aDocument,
          ...someMetadata
        },
        {},
        200,
        200
      )
    );
    const model = new MyModel(container);

    const result = await model.upsert(aDocument).run();
    expect(isRight(result));
    if (isRight(result)) {
      expect(result.value).toEqual({
        ...aDocument,
        ...someMetadata
      });
    }
  });
});

// tslint:disable-next-line: interface-name

describe("find", () => {
  it("should retrieve an existing document", async () => {
    readMock.mockResolvedValueOnce(
      new ResourceResponse(
        {
          ...aDocument,
          ...someMetadata
        },
        {},
        200,
        200
      )
    );
    containerMock.item.mockReturnValue({ read: readMock });
    const model = new MyModel(container);

    const result = await model.find([testId]).run();

    expect(containerMock.item).toHaveBeenCalledWith(testId, testId);
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual({
        ...aDocument,
        ...someMetadata
      });
    }
  });

  it("should retrieve an existing document for a model with a partition", async () => {
    readMock.mockResolvedValueOnce(
      new ResourceResponse(
        {
          ...aDocument,
          ...someMetadata
        },
        {},
        200,
        200
      )
    );
    containerMock.item.mockReturnValue({ read: readMock });
    const model = new MyPartitionedModel(container);

    const result = await model.find([testId, testPartition]).run();

    expect(containerMock.item).toHaveBeenCalledWith(testId, testPartition);
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual({
        ...aDocument,
        ...someMetadata
      });
    }
  });

  it("should return an empty option if the document does not exist", async () => {
    readMock.mockResolvedValueOnce(
      // TODO: check whether this is what the client actually returns
      new ResourceResponse(undefined, {}, 200, 200)
    );
    containerMock.item.mockReturnValue({ read: readMock });
    const model = new MyModel(container);

    const result = await model.find([testId]).run();

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isNone()).toBeTruthy();
    }
  });

  it("should return the query error", async () => {
    readMock.mockRejectedValueOnce(
      // TODO: check whether this is what the client actually returns
      errorResponse
    );
    containerMock.item.mockReturnValue({ read: readMock });
    const model = new MyModel(container);

    const result = await model.find([testId]).run();

    expect(isLeft(result));
    if (isLeft(result)) {
      expect(result.value.kind).toBe("COSMOS_ERROR_RESPONSE");
      if (result.value.kind === "COSMOS_ERROR_RESPONSE") {
        expect(result.value.error.code).toBe(500);
      }
    }
  });
});
