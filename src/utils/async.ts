import { Either, isRight } from "fp-ts/lib/Either";

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

export function mapEitherAsyncIterator<E, T, V>(
  iter: AsyncIterator<Either<E, T>, Either<E, T>>,
  f: (t: T) => V
): AsyncIterator<V> {
  return {
    next: async () => {
      while (true) {
        const { done, value } = await iter.next();
        if (done) {
          return { done, value: undefined };
        }
        if (isRight(value)) {
          return { done, value: f(value.value) };
        }
      }
    }
  };
}

export async function flattenAsyncIterator<T>(
  iter: AsyncIterator<ReadonlyArray<T>>
): Promise<AsyncIterator<T>> {
  const array = await asyncIteratorToArray(iter);
  const flattenArray = array.reduce((acc, item) => {
    return acc.concat(item);
  }, []);
  // tslint:disable-next-line: no-let
  let index = 0;
  return {
    next: async () => {
      if (flattenArray.length !== index) {
        return { done: false, value: flattenArray[index++] };
      } else {
        return { done: true, value: undefined };
      }
    }
  };
}
