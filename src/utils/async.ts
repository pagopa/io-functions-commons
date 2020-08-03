/**
 * Maps results from an iterator and returns an iterator with new values
 * @param iter the provided iterator
 * @param f the functor
 * @param mapReturn true if the return value must be mapped. Default: false
 *
 * @returns an aync iterator which values are mapped
 */
export function mapAsyncIterator<T, V>(
  iter: AsyncIterator<T>,
  f: (t: T) => V,
  mapReturn?: false
): AsyncIterator<V>;
// tslint:disable-next-line: no-any
export function mapAsyncIterator<T, V, TReturn = any>(
  iter: AsyncIterator<T>,
  f: (t: T | TReturn) => V,
  mapReturn: true
): AsyncIterator<V>;
// tslint:disable-next-line: no-any
export function mapAsyncIterator<T, V, TReturn = any>(
  iter: AsyncIterator<T>,
  f: (t: T | TReturn) => V,
  // tslint:disable-next-line: bool-param-default
  mapReturn: boolean | undefined
): AsyncIterator<V> {
  return {
    next: () =>
      iter.next().then((result: IteratorResult<T, TReturn>) =>
        // IteratorResult defines that when done=true, then value is of a different kind (TReturn instead of T)
        // In some cases it is not desiderable to have the return value to be mapped
        !result.done
          ? { done: false, value: f(result.value) }
          : mapReturn
          ? { done: true, value: f(result.value) }
          : result
      )
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
export function filterAsyncIterator<T, K extends T>(
  iter: AsyncIterator<T>,
  predicate: (value: T) => value is K
): AsyncIterator<K>;
export function filterAsyncIterator<T>(
  iter: AsyncIterator<T>,
  predicate: (value: T) => boolean
): AsyncIterator<T>;
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
    next: async () => {
      return await getValues().next();
    }
  };
}

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
