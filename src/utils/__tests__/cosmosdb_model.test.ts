import * as t from "io-ts";

import { isLeft, isRight } from "fp-ts/lib/Either";

import { Container, ResourceResponse } from "@azure/cosmos";

import { BaseModel, CosmosdbModel, ResourceT } from "../cosmosdb_model";

const MyDocument = t.interface({
  test: t.string
});
type MyDocument = t.TypeOf<typeof MyDocument>;

const NewMyDocument = t.intersection([MyDocument, BaseModel]);
type NewMyDocument = t.TypeOf<typeof NewMyDocument>;

const RetrievedMyDocument = t.intersection([MyDocument, ResourceT]);
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

const readMock = jest.fn();
const containerMock = {
  item: jest.fn(),
  items: {
    create: jest.fn(),
    upsert: jest.fn()
  }
};
const container = (containerMock as unknown) as Container;

describe("create", () => {
  it("should create a document", async () => {
    containerMock.items.create.mockResolvedValueOnce({});
    const model = new MyModel(container);
    await model
      .create({
        id: "test-id-1",
        test: "test"
      })
      .run();
    expect(containerMock.items.create).toHaveBeenCalledWith(
      {
        id: "test-id-1",
        test: "test"
      },
      { disableAutomaticIdGeneration: true }
    );
  });

  it("should fail on query error", async () => {
    containerMock.items.create.mockRejectedValueOnce({ code: 500 });
    const model = new MyModel(container);

    const result = await model
      .create({
        id: "test-id-1",
        test: "test"
      })
      .run();
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

    const result = await model
      .create({
        id: "test-id-1",
        test: "test"
      })
      .run();
    expect(isLeft(result));
    if (isLeft(result)) {
      expect(result.value).toEqual({ kind: "COSMOS_EMPTY_RESPONSE" });
    }
  });

  it("should return the created document as retrieved type", async () => {
    containerMock.items.create.mockResolvedValueOnce(
      new ResourceResponse(
        {
          _etag: "_etag",
          _rid: "_rid",
          _self: "_self",
          _ts: 1,
          id: "test-id-1",
          test: "test"
        },
        {},
        200,
        200
      )
    );
    const model = new MyModel(container);

    const doc = {
      id: "test-id-1",
      test: "test"
    };
    const result = await model.create(doc).run();
    expect(isRight(result));
    if (isRight(result)) {
      expect(result.value).toEqual({
        ...doc,
        _etag: "_etag",
        _rid: "_rid",
        _self: "_self",
        _ts: 1
      });
    }
  });
});

describe("upsert", () => {
  it("should create a document", async () => {
    containerMock.items.upsert.mockResolvedValueOnce({});
    const model = new MyModel(container);
    await model
      .upsert({
        id: "test-id-1",
        test: "test"
      })
      .run();
    expect(containerMock.items.upsert).toHaveBeenCalledWith(
      {
        id: "test-id-1",
        test: "test"
      },
      { disableAutomaticIdGeneration: true }
    );
  });

  it("should fail on query error", async () => {
    containerMock.items.upsert.mockRejectedValueOnce({ code: 500 });
    const model = new MyModel(container);

    const result = await model
      .upsert({
        id: "test-id-1",
        test: "test"
      })
      .run();
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

    const result = await model
      .upsert({
        id: "test-id-1",
        test: "test"
      })
      .run();
    expect(isLeft(result));
    if (isLeft(result)) {
      expect(result.value).toEqual({ kind: "COSMOS_EMPTY_RESPONSE" });
    }
  });

  it("should return the created document as retrieved type", async () => {
    containerMock.items.upsert.mockResolvedValueOnce(
      new ResourceResponse(
        {
          _etag: "_etag",
          _rid: "_rid",
          _self: "_self",
          _ts: 1,
          id: "test-id-1",
          test: "test"
        },
        {},
        200,
        200
      )
    );
    const model = new MyModel(container);

    const doc = {
      id: "test-id-1",
      test: "test"
    };
    const result = await model.upsert(doc).run();
    expect(isRight(result));
    if (isRight(result)) {
      expect(result.value).toEqual({
        ...doc,
        _etag: "_etag",
        _rid: "_rid",
        _self: "_self",
        _ts: 1
      });
    }
  });
});

describe("find", () => {
  it("should retrieve an existing document", async () => {
    readMock.mockResolvedValueOnce(
      new ResourceResponse(
        {
          _etag: "_etag",
          _rid: "_rid",
          _self: "_self",
          _ts: 1,
          id: "test-id-1",
          test: "test"
        },
        {},
        200,
        200
      )
    );
    containerMock.item.mockReturnValue({ read: readMock });
    const model = new MyModel(container);
    const result = await model.find("test-id-1", "test-partition").run();
    expect(containerMock.item).toHaveBeenCalledWith(
      "test-id-1",
      "test-partition"
    );
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual({
        _etag: "_etag",
        _rid: "_rid",
        _self: "_self",
        _ts: 1,
        id: "test-id-1",
        test: "test"
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
    const result = await model.find("test-id-1", "test-partition").run();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isNone()).toBeTruthy();
    }
  });

  it("should return the query error", async () => {
    readMock.mockRejectedValueOnce(
      // TODO: check whether this is what the client actually returns
      { code: 500 }
    );
    containerMock.item.mockReturnValue({ read: readMock });
    const model = new MyModel(container);
    const result = await model.find("test-id-1", "test-partition").run();
    expect(isLeft(result));
    if (isLeft(result)) {
      expect(result.value.kind).toBe("COSMOS_ERROR_RESPONSE");
      if (result.value.kind === "COSMOS_ERROR_RESPONSE") {
        expect(result.value.error.code).toBe(500);
      }
    }
  });
});
