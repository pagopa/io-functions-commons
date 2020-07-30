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
  iterable: AsyncIterable<T | K>,
  predicate: (value: T | K) => value is K
): AsyncIterable<K> => ({
  async *[Symbol.asyncIterator](): AsyncIterator<K> {
    // tslint:disable-next-line: await-promise
    for await (const value of iterable) {
      if (predicate(value)) {
        yield value;
      }
    }
  }
});

/**
 * Create a new AsyncIterator providing only the values that satisfy the predicate function.
 * The predicate function is also an optional Type Guard function if types T and K are different.
 *
 * Example:
 * ```
 * const i: AsyncIterator<Either<E, A>> = {} as AsyncIterator<Either<E, A>>;
 * const newI: AsyncIterator<Right<E, A>> = filterAsyncIterator<Either<E, A>, Right<E, A>>(iterable, isRight);
 * ```
 * @param iter Original AsyncIterator
 * @param predicate Predicate function
 */
export function filterAsyncIterator<T, K = T>(
  iter: AsyncIterator<T | K>,
  predicate: (value: T | K) => value is K
): AsyncIterator<K> {
  const iterable = {
    [Symbol.asyncIterator]: () => iter
  };
  return filterAsyncIterable(iterable, predicate)[Symbol.asyncIterator]();
}

/**
 * Create a new AsyncIterable which provide one by one the values ​​contained into the input AsyncIterable
 *
 * @param iterable Original AsyncIterable
 */
export const flattenAsyncIterable = <T>(
  iterable: AsyncIterable<ReadonlyArray<T>>
): AsyncIterable<T> => ({
  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    // tslint:disable-next-line: await-promise
    for await (const value of iterable) {
      for (const item of value) {
        yield item;
      }
    }
  }
});

/**
 * Create a new AsyncIterator which provide one by one the values ​​contained into the input AsyncIterator
 *
 * @param iter Original AsyncIterator
 */
export function flattenAsyncIterator<T>(
  iter: AsyncIterator<ReadonlyArray<T>>
): AsyncIterator<T> {
  const iterable = {
    [Symbol.asyncIterator]: () => iter
  };
  return flattenAsyncIterable(iterable)[Symbol.asyncIterator]();
}

export function reduceAsyncIterable<A, B>(
  iterable: AsyncIterable<ReadonlyArray<A>>,
  reducer: (previousValue: B, currentValue: A) => B,
  init: B
): AsyncIterable<B> {
  return {
    async *[Symbol.asyncIterator](): AsyncIterator<B> {
      // tslint:disable-next-line: await-promise
      for await (const value of iterable) {
        yield value.reduce<B>(reducer, init);
      }
    }
  };
}

export function reduceAsyncIterator<A, B>(
  i: AsyncIterator<ReadonlyArray<A>>,
  reducer: (previousValue: B, currentValue: A) => B,
  init: B
): AsyncIterator<B> {
  const iterable = {
    [Symbol.asyncIterator]: () => i
  };
  return reduceAsyncIterable(iterable, reducer, init)[Symbol.asyncIterator]();
}
