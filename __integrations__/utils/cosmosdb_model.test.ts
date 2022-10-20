import * as t from "io-ts";

import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";

import { Container, ErrorResponse } from "@azure/cosmos";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  BaseModel,
  CosmosdbModel,
  CosmosResource
} from "../../src/utils/cosmosdb_model";
import { createContext } from "../models/cosmos_utils";
import {
  CosmosdbModelVersioned,
  RetrievedVersionedModel
} from "../../src/utils/cosmosdb_model_versioned";

import { CosmosdbModelVersionedTTL } from "../../src/utils/cosmosdb_model_versioned_ttl";

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

const testId = "test-id-1" as NonEmptyString;
const testPartition = "test-partition";

const aDocument = {
  id: testId,
  pk: testPartition,
  test: "test"
};

const errorResponse: ErrorResponse = new Error();
// eslint-disable-next-line functional/immutable-data
errorResponse.code = 500;

jest.setTimeout(60000);

describe("create", () => {
  it("should create a document", async () => {
    const context = await createContext("id");
    await context.init();
    const model = new MyModel(context.container);
    const result = await model.create(aDocument)();
    expect(E.isRight(result));
    if (E.isRight(result)) {
      expect(result.right).toEqual(
        expect.objectContaining({
          ...aDocument
        })
      );
    }
    context.dispose();
  });
});

describe("upsert", () => {
  it("should create a document", async () => {
    const context = await createContext("id");
    await context.init();
    const model = new MyModel(context.container);
    const result = await model.upsert(aDocument)();
    expect(E.isRight(result));
    if (E.isRight(result)) {
      expect(result.right).toEqual(
        expect.objectContaining({
          ...aDocument
        })
      );
    }
    context.dispose();
  });
});

describe("find", () => {
  it("should retrieve an existing document", async () => {
    const context = await createContext("id");
    await context.init();
    const model = new MyModel(context.container);
    await model.upsert(aDocument)();
    const result = await model.find([testId])();
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBeTruthy();
      expect(O.toUndefined(result.right)).toEqual(
        expect.objectContaining({
          ...aDocument
        })
      );
    }
    context.dispose();
  });

  it("should retrieve an existing document for a model with a partition", async () => {
    const context = await createContext("pk");
    await context.init();
    const model = new MyPartitionedModel(context.container);
    await model.upsert(aDocument)();
    const result = await model.find([testId, testPartition])();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBeTruthy();
      expect(O.toUndefined(result.right)).toEqual(
        expect.objectContaining({
          ...aDocument
        })
      );
    }
    context.dispose();
  });

  it("should return an empty option if the document does not exist", async () => {
    const context = await createContext("id");
    await context.init();
    const model = new MyModel(context.container);
    const result = await model.find([testId])();
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isNone(result.right)).toBeTruthy();
    }
    context.dispose();
  });
});

describe("findAllVersionsBySearchKey", () => {
  class MyVersionedModel extends CosmosdbModelVersionedTTL<
    MyDocument,
    NewMyDocument,
    RetrievedMyVersionedDocument,
    "pk"
  > {
    constructor(c: Container) {
      super(c, NewMyDocument, RetrievedMyVersionedDocument, "pk");
    }
  }

  const RetrievedMyVersionedDocument = t.intersection([
    MyDocument,
    RetrievedVersionedModel
  ]);

  type RetrievedMyVersionedDocument = t.TypeOf<
    typeof RetrievedMyVersionedDocument
  >;

  it("should return all documents belonging to the same partition key", async () => {
    const context = createContext("id");
    await context.init();
    const model = new MyVersionedModel(context.container);

    await model.upsert({
      id: testId,
      pk: testPartition,
      test: "test"
    })();

    await model.upsert({
      id: "2testId" as NonEmptyString,
      pk: testPartition,
      test: "test"
    })();

    await model.upsert({
      id: "3testId" as NonEmptyString,
      pk: "invalidPartition",
      test: "test"
    })();

    const result = await model.findAllVersionsBySearchKey([testPartition])();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toHaveLength(2);
    }
    context.dispose();
  });
});
