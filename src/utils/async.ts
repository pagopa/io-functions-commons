/**
 * Maps over an AsyncIterator
 */
export function mapAsyncIterator<T, V>(
  iter: AsyncIterator<T>,
  f: (t: T) => V
): AsyncIterator<V> {
  return {
    next: () =>
      iter.next().then(({ done, value }) => ({
        done,
        value: f(value)
      }))
  };
}

/**
 * Maps over an AsyncIterable
 */
export function mapAsyncIterable<T, V>(
  source: AsyncIterable<T>,
  f: (t: T) => V
): AsyncIterable<V> {
  const iter = source[Symbol.asyncIterator]();
  const iterMapped = mapAsyncIterator(iter, f);
  return {
    [Symbol.asyncIterator]: () => iterMapped
  };
}

export async function asyncIteratorToArray<T>(
  iter: AsyncIterator<T>
): Promise<ReadonlyArray<T>> {
  const acc = Array<T>();

  while (true) {
    const next = await iter.next();
    if (next.done === true) {
      return acc;
    }
    acc.push(next.value);
  }
}

export async function asyncIterableToArray<T>(
  source: AsyncIterable<T>
): Promise<ReadonlyArray<T>> {
  const iter = source[Symbol.asyncIterator]();
  return asyncIteratorToArray(iter);
}

/**
 * Create a new AsyncIterator providing only the values that satisfy the predicate function.
 * The predicate function is also an optional Type Guard function if types T and K are different.
 *
 * Example:
 * ```
 * const i: AsyncIterator<Either<E, A>> = {} as AsyncIterator<Either<E, A>>;
 * const newI: AsyncIterator<Right<E, A>> = filterAsyncIterator<Either<E, A>, Right<E, A>>(i, isRight);
 * ```
 * @param iter Original AsyncIterator
 * @param predicate Predicate function
 */
export function filterAsyncIterator<T, K = T>(
  iter: AsyncIterator<T | K>,
  predicate: (value: T | K) => value is K
  // tslint:disable-next-line: no-any
): AsyncIterator<K, any> {
  // tslint:disable-next-line: no-any
  async function* getValues(): AsyncGenerator<K, any, unknown> {
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
    next: async () => {
      return await getValues().next();
    }
  };
}

/**
 * Create a new AsyncIterable providing only the values that satisfy the predicate function.
 * The predicate function is also an optional Type Guard function if types T and K are different.
 *
 * Example:
 * ```
 * const i: AsyncIterable<Either<E, A>> = {} as AsyncIterable<Either<E, A>>;
 * const f: AsyncIterable<Right<E, A>> = filterAsyncIterable<Either<E, A>, Right<E, A>>(i, isRight);
 * ```
 * @param iterable Original AsyncIterable
 * @param predicate Predicate function
 */
export const filterAsyncIterable = <T, K = T>(
  source: AsyncIterable<T | K>,
  predicate: (value: T | K) => value is K
): AsyncIterable<K> => {
  const iter = source[Symbol.asyncIterator]();
  return {
    [Symbol.asyncIterator]: () => filterAsyncIterator(iter, predicate)
  };
};

/**
 * Create a new AsyncIterator which provide one by one the values ​​contained into the input AsyncIterator
 *
 * @param iter Original AsyncIterator
 */
export function flattenAsyncIterator<T>(
  iter: AsyncIterator<ReadonlyArray<T>>
  // tslint:disable-next-line: no-any
): AsyncIterator<T, any> {
  // tslint:disable-next-line: no-let readonly-array
  let array: T[] = [];
  // tslint:disable-next-line: no-any
  async function* getValues(): AsyncGenerator<T, any, unknown> {
    while (array.length === 0) {
      const { done, value } = await iter.next();
      if (done) {
        return value;
      }
      array = Array.from(value);
    }
    yield array.shift() as T;
  }
  return {
    next: async () => {
      return await getValues().next();
    }
  };
}

/**
 * Create a new AsyncIterable which provide one by one the values ​​contained into the input AsyncIterable
 *
 * @param source Original AsyncIterable
 */
export const flattenAsyncIterable = <T>(
  source: AsyncIterable<ReadonlyArray<T>>
): AsyncIterable<T> => {
  const iter = source[Symbol.asyncIterator]();
  return {
    [Symbol.asyncIterator]: () => flattenAsyncIterator(iter)
  };
};
