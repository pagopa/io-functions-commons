import * as E from "fp-ts/lib/Either";
import { identity, pipe } from "fp-ts/lib/function";

import * as AI from "../async_iterable_task";
import { flattenAsyncIterable } from "../async";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";

async function* yieldValues<T>(elements: T[]): AsyncIterable<T> {
  for (const e of elements) {
    yield e;
  }
}

async function* yieldThrowError<T>(
  elements: T[],
  throwAtIndex: number
): AsyncIterable<T> {
  for (let i = 0; i <= elements.length; i++) {
    if (i < throwAtIndex) yield elements[i];
    else throw Error("an Error");
  }
}

const originalValues = [1, 2, 3];

describe("fold", () => {
  it("should read all values", async () => {
    const expectedValues = originalValues;
    const asyncIterable = yieldValues(originalValues);

    const res = await pipe(asyncIterable, AI.fromAsyncIterable, AI.fold)();

    expect(res).toEqual(expectedValues);
  });
});

describe("foldTaskEither", () => {
  it("should process all values", async () => {
    const expectedValues = originalValues;
    const asyncIterable = yieldValues(originalValues);

    let elements = 0;

    const res = await pipe(
      asyncIterable,
      AI.fromAsyncIterable,
      AI.map(v => {
        elements++;
        return v;
      }),
      AI.foldTaskEither(identity)
    )();

    expect(elements).toEqual(3);

    pipe(
      res,
      E.map(val => expect(val).toEqual(expectedValues)),
      E.mapLeft(_ => fail("Error retrieving values"))
    );
  });

  it("should handle Errors", async () => {
    const mapfn = (v: number) => v + 2;
    const asyncIterable = yieldThrowError(originalValues, 2);

    let elements = 0;

    const res = await pipe(
      asyncIterable,
      AI.fromAsyncIterable,
      AI.map(v => {
        elements++;
        return mapfn(v);
      }),
      AI.foldTaskEither(identity)
    )();

    expect(elements).toEqual(2);

    pipe(
      res,
      E.map(val => fail("Exception not handled")),
      E.mapLeft(err => expect(err).toEqual(Error("an Error")))
    );
  });
});

describe("map", () => {
  it("should map all values with the provided function", async () => {
    const mapfn = (v: number) => v + 1;
    const expectedValues = originalValues.map(mapfn);
    const asyncIterable = yieldValues(originalValues);

    const res = await pipe(
      asyncIterable,
      AI.fromAsyncIterable,
      AI.map(mapfn),
      AI.fold
    )();

    expect(res).toEqual(expectedValues);
  });
});

describe("mapIterable", () => {
  it("should map all values with the provided function", async () => {
    const originalValues = [[3, 2], [1], [41, 42]];
    const expectedValues = originalValues.flat();
    const asyncIterable = yieldValues(originalValues);

    const res = await pipe(
      asyncIterable,
      AI.fromAsyncIterable,
      AI.mapIterable(flattenAsyncIterable),
      AI.fold
    )();

    expect(res).toEqual(expectedValues);
  });
});

describe("reduceTaskEither", () => {
  it("should return E.Right with the reduced value", async () => {
    const expectedValue = originalValues.reduce((p, c) => p + c, 0);
    const asyncIterable = yieldValues(originalValues);

    const res = await pipe(
      asyncIterable,
      AI.fromAsyncIterable,
      AI.reduceTaskEither(E.toError, 0, (p, c) => p + c)
    )();

    expect(res).toEqual(E.right(expectedValue));
  });

  it("should return E.Left if an error occurred retrieving the values", async () => {
    const asyncIterable = yieldThrowError(originalValues, 2);

    const res = await pipe(
      asyncIterable,
      AI.fromAsyncIterable,
      AI.reduceTaskEither(E.toError, 0, (p, c) => p + c)
    )();

    expect(res).toEqual(E.left(E.toError(Error("an Error"))));
  });
});

describe("run", () => {
  it("should process all values", async () => {
    const asyncIterable = yieldValues(originalValues);

    let elements = 0;

    const res = await pipe(
      asyncIterable,
      AI.fromAsyncIterable,
      AI.map(v => {
        elements++;
        return v;
      }),
      AI.run
    )();

    expect(elements).toEqual(3);
  });
});

describe("toPageArray", () => {
  const originalValues = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  it("should return a page", async () => {
    const asyncIterable = yieldValues(originalValues);

    let elements = 0;

    const res = await pipe(
      asyncIterable,
      AI.fromAsyncIterable,
      AI.map(v => {
        elements++;
        return v;
      }),
      AI.toPageArray(E.toError, 2 as NonNegativeInteger)
    )();

    //Takes a page a check if more data are available: 2 + 1 = 3
    expect(elements).toEqual(3);
    expect(res).toEqual(E.right({ hasMoreResults: true, results: [1, 2] }));
  });

  it("should return E.Left if an error occurred retrieving the values", async () => {
    const asyncIterable = yieldThrowError(originalValues, 2);

    const res = await pipe(
      asyncIterable,
      AI.fromAsyncIterable,
      AI.toPageArray(E.toError, 2 as NonNegativeInteger)
    )();

    expect(res).toEqual(E.left(E.toError(Error("an Error"))));
  });
});
