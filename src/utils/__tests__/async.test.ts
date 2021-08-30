import { Either, isRight, left, right, Right } from "fp-ts/lib/Either";
import * as t from "io-ts";
import {
  filterAsyncIterator,
  flattenAsyncIterator,
  mapAsyncIterator
} from "../async";

const mockNext = jest.fn();
const mockAsyncIterator = {
  next: mockNext
};

// eslint-disable-next-line @typescript-eslint/typedef, @typescript-eslint/no-explicit-any
const createMockIterator = <T, TReturn = any>(
  items: readonly T[],
  lastValue?: TReturn
): AsyncIterator<T> => {
  // eslint-disable-next-line functional/prefer-readonly-type
  const data: T[] = [...items];
  const result = (value: T): IteratorYieldResult<T> => ({
    done: false,
    value
  });
  const finish = (): IteratorReturnResult<typeof lastValue> => ({
    done: true,
    value: lastValue
  });
  return {
    next: jest.fn(async () => {
      const item = data.shift();
      return data.length + 1 && item ? result(item) : finish();
    })
  };
};

describe("flattenAsyncIterator utils", () => {
  const firstArray: ReadonlyArray<number> = [1, 2, 3, 4];
  const secondArray: ReadonlyArray<number> = [5, 6];

  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should iterate on flatten array", async () => {
    const inputIterator = createMockIterator([firstArray, secondArray]);

    const outputIterator = flattenAsyncIterator<number>(inputIterator);

    for (const item of [...firstArray, ...secondArray]) {
      expect(await outputIterator.next()).toEqual({ done: false, value: item });
    }
    expect(await outputIterator.next()).toEqual({
      done: true,
      value: undefined
    });
    expect(inputIterator.next).toBeCalledTimes(3);
  });

  it("should iterate on empty iterator", async () => {
    const inputIterator = createMockIterator([]);

    const outputIterator = flattenAsyncIterator<number>(inputIterator);

    expect(await outputIterator.next()).toEqual({
      done: true,
      value: undefined
    });
    expect(inputIterator.next).toBeCalledTimes(1);
  });

  it("should skip empty arrays", async () => {
    const inputIterator = createMockIterator([firstArray, []]);

    const outputIterator = flattenAsyncIterator<number>(inputIterator);
    for (const item of firstArray) {
      expect(await outputIterator.next()).toEqual({ done: false, value: item });
    }
    expect(await outputIterator.next()).toEqual({
      done: true,
      value: undefined
    });
    expect(inputIterator.next).toBeCalledTimes(3);
  });
});

describe("filterAsyncIterator utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should filter values that match the predicate", async () => {
    const expectedRightValue = right<Error, number>(1);
    const expectedReturnValue = "truw";

    const inputIterator = createMockIterator<Either<Error, number>>(
      [left(new Error("Left value error")), expectedRightValue],
      expectedReturnValue
    );

    const outputIterator: AsyncIterator<Right<number>> = filterAsyncIterator(
      inputIterator,
      isRight
    );

    expect(await outputIterator.next()).toEqual({
      done: false,
      value: expectedRightValue
    });
    expect(await outputIterator.next()).toEqual({
      done: true,
      value: expectedReturnValue
    });
    expect(inputIterator.next).toBeCalledTimes(3);
  });

  it("should skip all values if do not match the predicate", async () => {
    const leftValue = left(new Error("Left value error"));
    const expectedReturnValue = right(true);

    const inputIterator = createMockIterator([
      leftValue,
      leftValue,
      expectedReturnValue
    ]);

    const outputIterator = filterAsyncIterator(inputIterator, isRight);
    expect(await outputIterator.next()).toEqual({
      done: false,
      value: expectedReturnValue
    });
    expect(await outputIterator.next()).toEqual({
      done: true
    });
    expect(inputIterator.next).toBeCalledTimes(4);
  });

  it("should work using a guard as a predicate", async () => {
    interface IGeneric {
      foo: string | number;
    }
    interface ISpecialized {
      foo: string;
    }

    const iterator = createMockIterator([
      { foo: 123 },
      {
        foo: "abc"
      }
    ]);

    const guard = (value: IGeneric): value is ISpecialized =>
      typeof value.foo === "string";

    // it's important to note that it's a AsyncIterator<ISpecialized>
    const filteredIterator: AsyncIterator<ISpecialized> = filterAsyncIterator(
      iterator,
      guard
    );

    await filteredIterator.next();
    const { done } = await filteredIterator.next();

    expect(done).toBe(true);
  });

  it("should work using a a function to boolean as a predicate", async () => {
    interface IGeneric {
      foo: string | number;
    }
    interface ISpecialized {
      foo: string;
    }

    const iterator = createMockIterator([
      {
        foo: 123
      },
      {
        foo: "abc"
      }
    ]);

    // it's important to note that it cannot be a AsyncIterator<ISpecialized>
    const filteredIterator: AsyncIterator<IGeneric> = filterAsyncIterator(
      iterator,
      value => value.foo === "abc"
    );

    await filteredIterator.next();
    const { done } = await filteredIterator.next();

    expect(done).toBe(true);
  });
});

describe("Scenarios", () => {
  type ModelType = t.TypeOf<typeof ModelType>;
  // eslint-disable-next-line sonar/no-dead-store
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
      ModelType
    >> = filterAsyncIterator(flattenIterator, isRight);
    const mappedIterator: AsyncIterator<ModelType> = mapAsyncIterator(
      fiteredIterator,
      e => e.right
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

describe("Scenarios", () => {
  type ModelType = t.TypeOf<typeof ModelType>;
  // eslint-disable-next-line sonar/no-dead-store
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
      ModelType
    >> = filterAsyncIterator(flattenIterator, isRight);
    const mappedIterator: AsyncIterator<ModelType> = mapAsyncIterator(
      fiteredIterator,
      e => e.right
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
