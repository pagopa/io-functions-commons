import { left, right } from "fp-ts/lib/Either";
import { flattenAsyncIterator, mapEitherAsyncIterator } from "../async";

const mockNext = jest.fn();
const mockAsyncIterator = {
  next: mockNext
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
});

describe("mapEitherAsyncIterator utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should skip left values", async () => {
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
    const mockMap = jest.fn().mockImplementation(_ => _);
    const iter = mapEitherAsyncIterator(mockAsyncIterator, mockMap);
    expect(await iter.next()).toEqual({
      done: false,
      value: expectedRightValue.value
    });
    expect(await iter.next()).toEqual({ done: true, value: undefined });
    expect(mockNext).toBeCalledTimes(3);
    expect(mockMap).toBeCalledTimes(1);
    expect(mockMap).toBeCalledWith(expectedRightValue.value);
  });

  it("should skip all values if are all left", async () => {
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
    const mockMap = jest.fn().mockImplementation(_ => _);
    const iter = mapEitherAsyncIterator(mockAsyncIterator, mockMap);
    expect(await iter.next()).toEqual({ done: true, value: undefined });
    expect(mockNext).toBeCalledTimes(3);
    expect(mockMap).toBeCalledTimes(0);
  });
});
