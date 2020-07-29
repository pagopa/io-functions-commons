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

export function filterAsyncIterator<T>(
  iter: AsyncIterator<T>,
  predicate: (t: T) => boolean
): AsyncIterator<T> {
  return {
    next: async () => {
      while (true) {
        const { done, value } = await iter.next();
        if (done) {
          return { done, value: undefined };
        }
        if (predicate(value)) {
          return { done, value };
        }
      }
    }
  };
}

export function flattenAsyncIterator<T>(
  iter: AsyncIterator<ReadonlyArray<T>>
): AsyncIterator<T> {
  // tslint:disable-next-line: no-let
  let index = 0;
  // tslint:disable-next-line: no-let
  let flattenArray: ReadonlyArray<T> = [];
  return {
    next: async () => {
      while (true) {
        if (flattenArray.length === index) {
          const { done, value } = await iter.next();
          if (done) {
            return { done, value: undefined };
          }
          flattenArray = value;
          index = 0;
          continue;
        }
        return { done: false, value: flattenArray[index++] };
      }
    }
  };
}
