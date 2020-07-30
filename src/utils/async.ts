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

export function filterAsyncIterator<T, K = T>(
  iter: AsyncIterator<T | K>,
  predicate: (value: T | K) => value is K
): AsyncIterator<K> {
  const iterable = {
    [Symbol.asyncIterator]: () => iter
  };
  return filterAsyncIterable(iterable, predicate)[Symbol.asyncIterator]();
}

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

export function flattenAsyncIterator<T>(
  iter: AsyncIterator<ReadonlyArray<T>>
): AsyncIterator<T> {
  const iterable = {
    [Symbol.asyncIterator]: () => iter
  };
  return flattenAsyncIterable(iterable)[Symbol.asyncIterator]();
}
