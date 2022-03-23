import * as t from "io-ts";

import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";

import { Container, ErrorResponse, ResourceResponse } from "@azure/cosmos";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { BaseModel, CosmosdbModel, CosmosResource } from "../cosmosdb_model";

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

// eslint-disable-next-line max-classes-per-file
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
const patchMock = jest.fn();
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
// eslint-disable-next-line functional/immutable-data
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
    const result = await model.create(aDocument)();
    expect(containerMock.items.create).toHaveBeenCalledWith(aDocument, {
      disableAutomaticIdGeneration: true
    });
    expect(E.isRight(result));
    if (E.isRight(result)) {
      expect(result.right).toEqual({
        ...aDocument,
        ...someMetadata
      });
    }
  });

  it("should fail on query error", async () => {
    containerMock.items.create.mockRejectedValueOnce(errorResponse);
    const model = new MyModel(container);

    const result = await model.create(aDocument)();
    expect(E.isLeft(result));
    if (E.isLeft(result)) {
      expect(result.left.kind).toBe("COSMOS_ERROR_RESPONSE");
      if (result.left.kind === "COSMOS_ERROR_RESPONSE") {
        expect(result.left.error.code).toBe(500);
      }
    }
  });

  it("should fail on empty response", async () => {
    containerMock.items.create.mockResolvedValueOnce({});
    const model = new MyModel(container);

    const result = await model.create(aDocument)();
    expect(E.isLeft(result));
    if (E.isLeft(result)) {
      expect(result.left).toEqual({ kind: "COSMOS_EMPTY_RESPONSE" });
    }
  });
});

describe("upsert", () => {
  it("should create a document", async () => {
    containerMock.items.upsert.mockResolvedValueOnce({});
    const model = new MyModel(container);
    await model.upsert(aDocument)();
    expect(containerMock.items.upsert).toHaveBeenCalledWith(aDocument, {
      disableAutomaticIdGeneration: true
    });
  });

  it("should fail on query error", async () => {
    containerMock.items.upsert.mockRejectedValueOnce(errorResponse);
    const model = new MyModel(container);

    const result = await model.upsert(aDocument)();
    expect(E.isLeft(result));
    if (E.isLeft(result)) {
      expect(result.left.kind).toBe("COSMOS_ERROR_RESPONSE");
      if (result.left.kind === "COSMOS_ERROR_RESPONSE") {
        expect(result.left.error.code).toBe(500);
      }
    }
  });

  it("should fail on empty response", async () => {
    containerMock.items.upsert.mockResolvedValueOnce({});
    const model = new MyModel(container);

    const result = await model.upsert(aDocument)();
    expect(E.isLeft(result));
    if (E.isLeft(result)) {
      expect(result.left).toEqual({ kind: "COSMOS_EMPTY_RESPONSE" });
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

    const result = await model.upsert(aDocument)();
    expect(E.isRight(result));
    if (E.isRight(result)) {
      expect(result.right).toEqual({
        ...aDocument,
        ...someMetadata
      });
    }
  });
});

// eslint-disable-next-line @typescript-eslint/interface-name-prefix

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

    const result = await model.find([testId])();

    expect(containerMock.item).toHaveBeenCalledWith(testId, testId);
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBeTruthy();
      expect(O.toUndefined(result.right)).toEqual({
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

    const result = await model.find([testId, testPartition])();

    expect(containerMock.item).toHaveBeenCalledWith(testId, testPartition);
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBeTruthy();
      expect(O.toUndefined(result.right)).toEqual({
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

    const result = await model.find([testId])();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isNone(result.right)).toBeTruthy();
    }
  });

  it("should return the query error", async () => {
    readMock.mockRejectedValueOnce(
      // TODO: check whether this is what the client actually returns
      errorResponse
    );
    containerMock.item.mockReturnValue({ read: readMock });
    const model = new MyModel(container);

    const result = await model.find([testId])();

    expect(E.isLeft(result));
    if (E.isLeft(result)) {
      expect(result.left.kind).toBe("COSMOS_ERROR_RESPONSE");
      if (result.left.kind === "COSMOS_ERROR_RESPONSE") {
        expect(result.left.error.code).toBe(500);
      }
    }
  });
});

const anotherTest = "another-test";
describe("patch", () => {
  it("GIVEN an existing document WHEN patch a value THEN return a task either containing the updated document", async () => {
    containerMock.item.mockReturnValueOnce({ patch: patchMock });
    patchMock.mockImplementationOnce(() =>
      Promise.resolve({
        resource: {
          ...aDocument,
          ...someMetadata,
          test: anotherTest
        }
      })
    );
    const model = new MyModel(container);
    const result = await model.patch([testId], { test: anotherTest })();

    expect(patchMock).toBeCalledWith(
      {
        condition: undefined,
        operations: [{ op: "add", path: "/test", value: anotherTest }]
      },
      undefined
    );
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN an existing document WHEN patch a value with condition THEN return a task either containing the updated document", async () => {
    containerMock.item.mockReturnValueOnce({ patch: patchMock });
    patchMock.mockImplementationOnce(() =>
      Promise.resolve({
        resource: {
          ...aDocument,
          ...someMetadata,
          test: anotherTest
        }
      })
    );
    const model = new MyModel(container);
    const result = await model.patch(
      [testId],
      { test: anotherTest },
      "WHERE condition"
    )();

    expect(patchMock).toBeCalledWith(
      {
        condition: "WHERE condition",
        operations: [{ op: "add", path: "/test", value: anotherTest }]
      },
      undefined
    );
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a not working cosmos WHEN patch a value THEN return a task either containing a 404 error", async () => {
    containerMock.item.mockReturnValueOnce({ patch: patchMock });
    patchMock.mockImplementationOnce(() =>
      Promise.resolve({ resource: undefined })
    );
    const model = new MyModel(container);
    const result = await model.patch([testId], { test: anotherTest })();

    expect(patchMock).toBeCalledTimes(1);
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 404 })
        })
      );
    }
  });

  it("GIVEN an not existing document WHEN patch a value THEN return a task either containing a 404 error", async () => {
    containerMock.item.mockReturnValueOnce({ patch: patchMock });
    patchMock.mockImplementationOnce(() => Promise.reject(errorResponse));
    const model = new MyModel(container);
    const result = await model.patch([testId], { test: anotherTest })();

    expect(patchMock).toBeCalledTimes(1);
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 500 })
        })
      );
    }
  });
});
