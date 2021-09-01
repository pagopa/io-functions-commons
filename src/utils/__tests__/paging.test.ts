import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as P from "../paging";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import {
  flattenAsyncIterator} from "../async";

const anIdBasedModel = {
  id: "AAAAA" as NonEmptyString
};

const iteratorGenMock = async function*<T>(arr: T[]) {
  for (let a of arr) yield a;
};

describe("Paging", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should return a result page with the correct number of elements", async () => {
    const pageSize = 3 as NonNegativeInteger;

    const iteratorMock = iteratorGenMock([anIdBasedModel, anIdBasedModel, anIdBasedModel, {id: "BBBB" as NonEmptyString}]);
    const results = await P.fillPage(iteratorMock as any, pageSize)
    expect(results).toMatchObject(
      {
        hasMoreResults: true,
        items: [anIdBasedModel, anIdBasedModel, anIdBasedModel],
        next: anIdBasedModel.id,
        prev: anIdBasedModel.id
      }
    );
  });

  it("should return an empty page if requested pageSize is 0", async () => {
    const pageSize = 0 as NonNegativeInteger;

    const iteratorMock = iteratorGenMock([anIdBasedModel, anIdBasedModel, anIdBasedModel, {id: "BBBB" as NonEmptyString}]);
    const results = await P.fillPage(iteratorMock as any, pageSize)
    expect(results).toMatchObject(
      {
        hasMoreResults: true,
        items: [],
        next: undefined,
        prev: undefined
      }
    );
  });

  it("should return an empty page if there are no results", async () => {
    const pageSize = 5 as NonNegativeInteger;

    const iteratorMock = iteratorGenMock([]);
    const results = await P.fillPage(iteratorMock as any, pageSize)
    expect(results).toMatchObject(
      {
        hasMoreResults: false,
        items: [],
        next: undefined,
        prev: undefined
      }
    );
  });

  it("should fill result page with elements of different pages while pageSize is not reached", async () => {
    const pageSize = 3 as NonNegativeInteger;

    const iteratorMock = flattenAsyncIterator(iteratorGenMock([[anIdBasedModel], [anIdBasedModel, {id: "BBBB" as NonEmptyString}]]));
    const results = await P.fillPage(iteratorMock as any, pageSize)
    expect(results).toMatchObject(
      {
        hasMoreResults: false,
        items: [anIdBasedModel, anIdBasedModel, {id: "BBBB" as NonEmptyString}],
        next: undefined,
        prev: anIdBasedModel.id
      }
    );
  });

  it("should fill result page with all elements if pageSize is greater than result's size", async () => {
    const pageSize = 6 as NonNegativeInteger;

    const iteratorMock = flattenAsyncIterator(iteratorGenMock([[anIdBasedModel, anIdBasedModel]]));
    const results = await P.fillPage(iteratorMock as any, pageSize)
    expect(results).toMatchObject(
      {
        hasMoreResults: false,
        items: [anIdBasedModel, anIdBasedModel],
        next: undefined,
        prev: anIdBasedModel.id
      }
    );
  });
});
