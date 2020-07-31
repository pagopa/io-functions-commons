import { Either, isRight, left, right, Right } from "fp-ts/lib/Either";
import * as t from "io-ts";
import {
  filterAsyncIterator,
  flattenAsyncIterator,
  mapAsyncIterator,
  reduceAsyncIterator
} from "../async";

const mockNext = jest.fn();
const mockAsyncIterator = {
  next: mockNext
};

// tslint:disable-next-line: typedef
const createMockIterator = <T>(items: readonly T[]): AsyncIterator<T> => {
  // tslint:disable-next-line: readonly-array
  const data: T[] = [...items];
  const result = (value: T): IteratorYieldResult<T> => ({
    done: false,
    value
  });
  const finish = (): IteratorReturnResult<undefined> => ({
    done: true,
    value: undefined
  });
  return {
    next: async () => {
      const item = data.shift();
      return data.length + 1 && item ? result(item) : finish();
    }
  };
};

describe("flattenAsyncIterator utils", () => {
  const firstArray: ReadonlyArray<number> = [1, 2, 3, 4];
  const secondArray: ReadonlyArray<number> = [5, 6];

  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should iterate on flatten array", async () => {
    mockNext.mockImplementationOnce(async () => ({
      done: false,
      value: firstArray
    }));
    mockNext.mockImplementationOnce(async () => ({
      done: false,
      value: secondArray
    }));
    mockNext.mockImplementationOnce(async () => ({
      done: true,
      value: undefined
    }));
    const iter = flattenAsyncIterator<number>(mockAsyncIterator);
    for (const item of [...firstArray, ...secondArray]) {
      expect(await iter.next()).toEqual({ done: false, value: item });
    }
    expect(await iter.next()).toEqual({ done: true, value: undefined });
    expect(mockNext).toBeCalledTimes(3);
  });
  it("should iterate on empty iterator", async () => {
    mockNext.mockImplementationOnce(async () => ({
      done: true,
      value: undefined
    }));
    const iter = flattenAsyncIterator<number>(mockAsyncIterator);
    expect(await iter.next()).toEqual({ done: true, value: undefined });
    expect(mockNext).toBeCalledTimes(1);
  });
  it("should skip empty arrays", async () => {
    mockNext.mockImplementationOnce(async () => ({
      done: false,
      value: firstArray
    }));
    mockNext.mockImplementationOnce(async () => ({
      done: false,
      value: []
    }));
    mockNext.mockImplementationOnce(async () => ({
      done: true,
      value: undefined
    }));
    const iter = flattenAsyncIterator<number>(mockAsyncIterator);
    for (const item of firstArray) {
      expect(await iter.next()).toEqual({ done: false, value: item });
    }
    expect(await iter.next()).toEqual({ done: true, value: undefined });
    expect(mockNext).toBeCalledTimes(3);
  });
});

describe("filterAsyncIterator utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should filter values that match the predicate", async () => {
    const expectedRightValue = right(1);
    mockNext.mockImplementationOnce(async () => ({
      done: false,
      value: left(new Error("Left value error"))
    }));
    mockNext.mockImplementationOnce(async () => ({
      done: false,
      value: expectedRightValue
    }));
    mockNext.mockImplementationOnce(async () => ({
      done: true,
      value: undefined
    }));
    const iter: AsyncIterator<Right<Error, number>> = filterAsyncIterator(
      mockAsyncIterator as AsyncIterator<Either<Error, number>>,
      isRight
    );
    expect(await iter.next()).toEqual({
      done: false,
      value: expectedRightValue
    });
    expect(await iter.next()).toEqual({ done: true, value: undefined });
    expect(mockNext).toBeCalledTimes(3);
  });

  it("should skip all values if don't match the predicate", async () => {
    const leftValue = left(new Error("Left value error"));
    mockNext.mockImplementationOnce(async () => ({
      done: false,
      value: leftValue
    }));
    mockNext.mockImplementationOnce(async () => ({
      done: false,
      value: leftValue
    }));
    mockNext.mockImplementationOnce(async () => ({
      done: true,
      value: undefined
    }));
    const iter: AsyncIterator<Right<Error, number>> = filterAsyncIterator(
      mockAsyncIterator as AsyncIterator<Either<Error, number>>,
      isRight
    );
    expect(await iter.next()).toEqual({ done: true, value: undefined });
    expect(mockNext).toBeCalledTimes(3);
  });
});

describe("reduceAsyncIterator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should reduce the documents of the wrapped iterator", async () => {
    mockNext.mockImplementationOnce(async () => ({
      done: false,
      value: ["1", "2"]
    }));
    mockNext.mockImplementationOnce(async () => ({
      done: false,
      value: ["3", "4"]
    }));
    mockNext.mockImplementationOnce(async () => ({
      done: true,
      value: undefined
    }));

    const iter = reduceAsyncIterator(
      mockAsyncIterator,
      (prev: string, cur: string) => prev + cur,
      ""
    );

    const result1 = await iter.next();
    expect(result1).toEqual({ done: false, value: "12" });
    const result2 = await iter.next();
    expect(result2).toEqual({ done: false, value: "34" });
    expect(await iter.next()).toEqual({ done: true, value: undefined });
  });
});

describe("Scenarios", () => {
  type ModelType = t.TypeOf<typeof ModelType>;
  // tslint:disable-next-line: no-dead-store
  const ModelType = t.interface({
    fieldA: t.string,
    fieldB: t.number
  });

  const aModel: ModelType = {
    fieldA: "foo",
    fieldB: 123
  };
  const anotherModel: ModelType = {
    fieldA: "bar",
    fieldB: 789
  };
  it("should filter Right on Either", async () => {
    const iterator: AsyncIterator<Either<
      string,
      ModelType
    >> = createMockIterator([
      right(aModel),
      left("error"),
      right(anotherModel)
    ]);

    const filteredIterator: AsyncIterator<Right<
      string,
      ModelType
    >> = filterAsyncIterator(iterator, isRight);

    const result1 = await filteredIterator.next();
    const result2 = await filteredIterator.next();
    const result3 = await filteredIterator.next();

    expect(result1).toEqual({
      done: false,
      value: right(aModel)
    });
    expect(result2).toEqual({
      done: false,
      value: right(anotherModel)
    });
    expect(result3).toEqual({
      done: true,
      value: undefined
    });
  });

  it("should extract right values from array of either", async () => {
    const iterator: AsyncIterator<ReadonlyArray<
      Either<string, ModelType>
    >> = createMockIterator([
      [right(aModel), right(aModel)],
      [left("error")],
      [],
      [right(anotherModel), left("error")]
    ]);

    const flattenIterator: AsyncIterator<Either<
      string,
      ModelType
    >> = flattenAsyncIterator(iterator);
    const fiteredIterator: AsyncIterator<Right<
      string,
      ModelType
    >> = filterAsyncIterator(flattenIterator, isRight);
    const mappedIterator: AsyncIterator<ModelType> = mapAsyncIterator(
      fiteredIterator,
      e => e.value
    );

    const result1 = await mappedIterator.next();
    const result2 = await mappedIterator.next();
    const result3 = await mappedIterator.next();
    const result4 = await mappedIterator.next();

    expect(result1).toEqual({
      done: false,
      value: aModel
    });
    expect(result2).toEqual({
      done: false,
      value: aModel
    });
    expect(result3).toEqual({
      done: false,
      value: anotherModel
    });
    expect(result4).toEqual({
      done: true,
      value: undefined
    });
  });
});
