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

import { CosmosdbModelVersioned, RetrievedVersionedModel } from "../../src/utils/cosmosdb_model_versioned";
import { createContext } from "../models/cosmos_utils";

const MyDocument = t.intersection([t.interface({
  pk: t.string,
  id: t.string,
  test: t.string,
}), t.partial({messageId: t.string})]);
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

const RetrievedMyVersionedDocument = t.intersection([MyDocument, RetrievedVersionedModel]);
type RetrievedMyVersionedDocument = t.TypeOf<typeof RetrievedMyVersionedDocument>;

class MyVersionedModel extends CosmosdbModelVersioned<
  MyDocument,
  NewMyDocument,
  RetrievedMyVersionedDocument,
  "id",
  "pk"
>{
  constructor(c: Container){
    super(c, NewMyDocument, RetrievedMyVersionedDocument, "id", "pk");
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
const anotherTestId = "test-id-2" as NonEmptyString;

const aDocument = {
  id: testId,
  pk: testPartition,
  test: "test"
};

const aDocumentWithTtl = {
  ...aDocument,
  ttl: 300
}

const errorResponse: ErrorResponse = new Error();
// eslint-disable-next-line functional/immutable-data
errorResponse.code = 500;

jest.setTimeout(60000);

const context = createContext("id");

beforeEach(async () => await context.init())

describe("create", () => {

  it("should create a document", async () => {
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
  });

  it("should create a document with ttl", async () => {
    const model = new MyModel(context.container);
    const result = await model.create(aDocumentWithTtl)();
    expect(E.isRight(result));
    if (E.isRight(result)) {
      expect(result.right).toEqual(
        expect.objectContaining({
          ...aDocumentWithTtl
        })
      );
    }
  });

});

describe("upsert", () => {

  it("should create a document", async () => {
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
  });

  it("should create a document with ttl", async () => {
    const model = new MyModel(context.container);
    const result = await model.upsert(aDocumentWithTtl)();
    expect(E.isRight(result));
    if (E.isRight(result)) {
      expect(result.right).toEqual(
        expect.objectContaining({
          ...aDocumentWithTtl
        })
      );
    }
  });

});

describe("find", () => {

  it("should retrieve an existing document with ttl", async () => {
    const model = new MyModel(context.container);
    await model.create(aDocumentWithTtl)();
    const result = await model.find([testId])();
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBeTruthy();
      expect(O.toUndefined(result.right)).toEqual(
        expect.objectContaining({
          ...aDocumentWithTtl
        })
      );
    }
  });

  it("should retrieve an existing document", async () => {
    const model = new MyModel(context.container);
    await model.create(aDocument)();
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
  });

  it("should retrieve an existing document for a model with a partition", async () => {
    const contextPk = createContext("pk");
    await contextPk.init();
    const model = new MyPartitionedModel(contextPk.container);
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
    contextPk.dispose();
  });

  it("should return an empty option if the document does not exist", async () => {
    const model = new MyModel(context.container);
    await model.create(aDocument)();
    const result = await model.find([anotherTestId])();
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isNone(result.right)).toBeTruthy();
    }
  });

  it("should return 3 documents", async () => {
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

    const result = await model.findAllVersionsByPartitionKey([testId, testPartition])();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      // expect(O.isNone(result.right)).toBeTruthy();
      expect(result.right).toHaveLength(2)
    }
  });

});

afterEach(() => context.dispose())

/**************** @zeit/cosmosdb-server do not support "patch" yet *****************/
// const anotherTest = "another-test";
// describe("patch", () => {
//   it("GIVEN an existing document WHEN patch a value THEN return a task either containing the updated document", async () => {
//     const context = await createContext("id");
//     await context.init();
//     const model = new MyModel(context.container);
//     await model.upsert(aDocument)();
//     const result = await model.patch([testId], { test: anotherTest })();
//     console.log(JSON.stringify(result));
//     expect(E.isRight(result)).toBeTruthy();
//     if (E.isRight(result)) {
//       expect(result.right.test).toEqual(anotherTest);
//     }
//     context.dispose();
//   });

//   it("GIVEN an not existing document WHEN patch a value THEN return a task either containing a 404 error", async () => {
//     const context = await createContext("id");
//     await context.init();
//     const model = new MyModel(context.container);
//     const result = await model.patch([testId], { test: anotherTest })();
//     expect(E.isLeft(result)).toBeTruthy();
//     if (E.isLeft(result)) {
//       expect(result.left).toEqual(
//         expect.objectContaining({
//           error: expect.objectContaining({ code: 404 })
//         })
//       );
//     }
//   });
// });
// cannot run this test cause of patch support missing, this test was a success with a cosmos db inside io-d-comos-free
// describe("Update ttl", () => {
//   it("should find all version of a message", async () => {
//     const model = new MyVersionedModel(context.container);
//     await model.upsert({
//       id: testId,
//       pk: "asd",
//       messageId: testId,
//       test: "test"
//     })();
//     await model.upsert({
//       id: testId,
//       pk: "asd",
//       messageId: testId,
//       test: "test"
//     })();
//     await pipe(
//       model.updateTTLForAllVersion([testId, testPartition], 200 as NonNegativeNumber),
//       TE.map((documents) => documents.map(d => expect(d.ttl).toBe(200))),
//     )()
//   })
// })

