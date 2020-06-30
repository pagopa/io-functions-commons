import * as t from "io-ts";

import { isRight, left, right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";

import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";

import { Container } from "@azure/cosmos";

import { ResourceT, BaseModel } from "../cosmosdb_model";
import {
  CosmosdbModelVersioned,
  ModelId,
  VersionedModel
} from "../cosmosdb_model_versioned";

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
  constructor(container: Container) {
    super(container, NewMyDocument, RetrievedMyDocument, aModelIdField);
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

describe("upsert", () => {
  it("should create a new document with implicit version", async () => {
    const model = new MyModel(aDbClient, aCollectionUri);
    (DocumentDbUtils.queryOneDocument as any).mockReturnValueOnce(
      Promise.resolve(right(none))
    );
    (DocumentDbUtils.createDocument as any).mockReturnValueOnce(
      Promise.resolve(right(aCreatedMyDocument))
    );
    const documentUri = DocumentDbUtils.getDocumentUri(
      aCollectionUri,
      "test-id-1"
    );
    const result = await model.upsert(
      aNewMyDocument,
      aModelIdField,
      aModelIdValue,
      aPartitionKeyField,
      aPartitionKeyValue
    );
    expect(DocumentDbUtils.createDocument).toHaveBeenCalledWith(
      aDbClient,
      documentUri,
      {
        ...aNewMyDocument,
        id: aMyDocumentId + "0",
        kind: undefined,
        version: 0
      },
      aPartitionKeyValue
    );
    expect(isRight(result));
    if (isRight(result)) {
      expect(result.value).toEqual({
        ...aNewMyDocument,
        id: aMyDocumentId + "1",
        kind: "IRetrievedMyDocument",
        version: 1
      });
    }
  });

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
});

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
