import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";

/**
 * Maps over an AsyncIterator
 */
export const mapAsyncIterator = <T, V>(
  iter: AsyncIterator<T>,
  f: (t: T) => V | Promise<V>
): AsyncIterator<V> => ({
  next: (): Promise<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    IteratorReturnResult<any> | { readonly done: boolean; readonly value: V }
  > =>
    iter.next().then(async (result: IteratorResult<T>) =>
      // IteratorResult defines that when done=true, then value=undefined
      // that is, when the iterator is done there is no value to be procesed
      result.done ? result : { done: false, value: await f(result.value) }
    )
});

/**
 * Maps over an AsyncIterable
 */
export const mapAsyncIterable = <T, V>(
  source: AsyncIterable<T>,
  f: (t: T) => V
): AsyncIterable<V> => {
  const iter = source[Symbol.asyncIterator]();
  const iterMapped = mapAsyncIterator(iter, f);
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [Symbol.asyncIterator]: (): AsyncIterator<V, any, undefined> => iterMapped
  };
};

export const asyncIteratorToArray = async <T>(
  iter: AsyncIterator<T>
): Promise<ReadonlyArray<T>> => {
  const acc = Array<T>();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const next = await iter.next();
    if (next.done === true) {
      return acc;
    }
    // eslint-disable-next-line functional/immutable-data
    acc.push(next.value);
  }
};

export const asyncIterableToArray = async <T>(
  source: AsyncIterable<T>
): Promise<ReadonlyArray<T>> => {
  const iter = source[Symbol.asyncIterator]();
  return asyncIteratorToArray(iter);
};

/**
 * Create a new AsyncIterator providing only the values that satisfy the predicate function.
 * The predicate function is also an optional Type Guard function if types T and K are different.
 *
 * Example:
 * ```
 * const i: AsyncIterator<Either<E, A>> = {} as AsyncIterator<Either<E, A>>;
 * const newI: AsyncIterator<Right<E, A>> = filterAsyncIterator<Either<E, A>, Right<E, A>>(i, isRight);
 * ```
 *
 * @param iter Original AsyncIterator
 * @param predicate Predicate function
 */
export function filterAsyncIterator<T, K extends T>(
  iter: AsyncIterator<T>,
  predicate: (value: T) => value is K
): AsyncIterator<K>;

export function filterAsyncIterator<T>(
  iter: AsyncIterator<T>,
  predicate: (value: T) => boolean
): AsyncIterator<T>;

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function filterAsyncIterator<T, K extends T = T>(
  iter: AsyncIterator<T>,
  predicate: (value: T) => boolean
): AsyncIterator<K> {
  async function* getValues(): AsyncGenerator<K> {
    while (true) {
      const { done, value } = await iter.next();
      if (done) {
        return value;
      }
      if (predicate(value)) {
        yield value;
      }
    }
  }
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    next: async (): Promise<IteratorResult<K, any>> => await getValues().next()
  };
}

/**
 * Create a new AsyncIterator which provide one by one the values contained into the input AsyncIterator
 *
 * @param iter Original AsyncIterator
 */
export const flattenAsyncIterator = <T>(
  iter: AsyncIterator<ReadonlyArray<T>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): AsyncIterator<T, any> => {
  // eslint-disable-next-line functional/no-let, functional/prefer-readonly-type
  let array: T[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function* getValues(): AsyncGenerator<T, any, unknown> {
    while (array.length === 0) {
      const { done, value } = await iter.next();
      if (done) {
        return value;
      }
      array = Array.from(value);
    }
    // eslint-disable-next-line functional/immutable-data
    yield array.shift() as T;
  }
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    next: async (): Promise<IteratorResult<T, any>> => await getValues().next()
  };
};

/**
 * Create a new AsyncIterable which provide one by one the values contained into the input AsyncIterable
 *
 * @param source Original AsyncIterable
 */
export const flattenAsyncIterable = <T>(
  source: AsyncIterable<ReadonlyArray<T>>
): AsyncIterable<T> => {
  const iter = source[Symbol.asyncIterator]();
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [Symbol.asyncIterator]: (): AsyncIterator<T, any, undefined> =>
      flattenAsyncIterator(iter)
  };
};

/**
 * Reduces over an AsyncIterator
 *
 * @param iter The iterator we want to reduce
 * @param f The reducer function
 * @param a It is used as the initial value to start the accumulation.
 */
export const reduceAsyncIterator = async <T, V>(
  iter: AsyncIterator<ReadonlyArray<T>>,
  f: (p: V, t: T) => V,
  a: V
): Promise<V> => {
  // eslint-disable-next-line functional/no-let
  let acc = a;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const {
      done,
      value
    }: {
      readonly done?: boolean;
      readonly value: ReadonlyArray<T>;
    } = await iter.next();
    if (done) {
      return value ? value.reduce(f, acc) : acc;
    }
    // eslint-disable-next-line functional/immutable-data
    acc = value.reduce(f, acc);
  }
};

export interface IPage<T> {
  readonly results: ReadonlyArray<T>;
  readonly hasMoreResults: boolean;
}

/**
 * Maps over an async iterator to get a page of desired size
 *
 * @param iter The iterator we want to reduce
 * @param pageSize The desired page size
 * @returns an IPage result { results: ReadonlyArray<T>; hasMoreResults: boolean; }
 */
export const asyncIteratorToPageArray = async <T>(
  iter: AsyncIterator<T | Promise<T>>,
  pageSize: NonNegativeInteger
): Promise<IPage<T>> => {
  const acc = Array<T>();
  // eslint-disable-next-line functional/no-let
  let hasMoreResults: boolean = true;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const next = await iter.next();
    if (next.done === true) {
      hasMoreResults = false;
      break;
    }
    if (acc.length === pageSize) {
      break;
    }
    // eslint-disable-next-line functional/immutable-data
    acc.push(await next.value);
  }

  return { hasMoreResults, results: acc };
};

export const asyncIterableToPageArray = async <T>(
  source: AsyncIterable<T | Promise<T>>,
  pageSize: NonNegativeInteger
): Promise<IPage<T>> => {
  const iter = source[Symbol.asyncIterator]();
  return asyncIteratorToPageArray(iter, pageSize);
};
