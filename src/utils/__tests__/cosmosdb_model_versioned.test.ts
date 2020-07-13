import * as t from "io-ts";

import { isRight, left, right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";

import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";

import { Container, ResourceResponse, FeedResponse } from "@azure/cosmos";

import { ResourceT, BaseModel } from "../cosmosdb_model";
import {
  CosmosdbModelVersioned,
  ModelId,
  VersionedModel
} from "../cosmosdb_model_versioned";

beforeEach(() => {
  jest.resetAllMocks();
});

const aModelIdField = "aModelIdField" as const;
const aModelIdValue = "aModelIdValue";
const aPartitionKeyField = "aPartitionKeyField";
const aPartitionKeyValue = "aPartitionKeyValue";

const MyDocument = t.interface({
  [aModelIdField]: t.string,
  test: t.string
});
type MyDocument = t.TypeOf<typeof MyDocument>;

const NewMyDocument = t.intersection([
  MyDocument,
  t.partial({
    version: NonNegativeNumber
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

const aCreatedMyDocument = {
  id: aMyDocumentId + "1",
  [aModelIdField]: aModelIdValue,
  test: "aNewMyDocument",
  version: 1
};

const anExistingDocument = {
  id: aMyDocumentId + "1",
  [aModelIdField]: aModelIdValue,
  test: "anExistingDocument",
  version: 1
};

const someMetadata = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};

const readMock = jest.fn();
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

  /*
  it("should update an existing document", async () => {
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.queryOneDocument as any).mockReturnValueOnce(
      Promise.resolve(right(some(anExistingDocument)))
    );
    (DocumentDbUtils.createDocument as any).mockReturnValueOnce(
      Promise.resolve(
        right({
          ...anExistingDocument,
          id: aMyDocumentId + "2",
          version: 2
        })
      )
    );
    const documentUri = DocumentDbUtils.getDocumentUri(
      aCollectionUri,
      "test-id-1"
    );
    const result = await model.upsert(
      anExistingDocument,
      aModelIdField,
      aModelIdValue,
      aPartitionKeyField,
      aPartitionKeyValue
    );
    expect(DocumentDbUtils.createDocument).toHaveBeenCalledWith(
      aDbClient,
      documentUri,
      {
        ...anExistingDocument,
        id: aMyDocumentId + "2",
        kind: undefined,
        version: 2
      },
      aPartitionKeyValue
    );
    expect(isRight(result));
    if (isRight(result)) {
      expect(result.value).toEqual({
        ...anExistingDocument,
        id: aMyDocumentId + "2",
        kind: "IRetrievedMyDocument",
        version: 2
      });
    }
  });

  it("should return on error", async () => {
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.queryOneDocument as any).mockReturnValueOnce(
      Promise.resolve(left(new Error()))
    );
    await model.upsert(
      aNewMyDocument,
      aModelIdField,
      aModelIdValue,
      aPartitionKeyField,
      aPartitionKeyValue
    );
    expect(DocumentDbUtils.createDocument).not.toHaveBeenCalledWith();
  });
  */
});

/*
describe("update", () => {
  it("should return on error", async () => {
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.readDocument as any).mockReturnValueOnce(
      Promise.resolve(left(new Error()))
    );
    await model.update(aModelIdValue, aPartitionKeyValue, curr => curr);
    expect(DocumentDbUtils.createDocument).not.toHaveBeenCalledWith();
  });
});

describe("findLastVersionByModelId", () => {
  it("should return none when the document is not found", async () => {
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.queryOneDocument as any).mockReturnValueOnce(
      Promise.resolve(right(none))
    );
    // @ts-ignore (ignore "protected" modifier)
    await model.findLastVersionByModelId(aModelIdField, aModelIdValue);
    expect(DocumentDbUtils.createDocument).not.toHaveBeenCalledWith();
  });
});

*/
