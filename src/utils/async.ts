/**
 * Maps over an AsyncIterable
 */
export function mapAsyncIterable<T, V>(
  source: AsyncIterable<T>,
  f: (t: T) => V
): AsyncIterable<V> {
  const iter = source[Symbol.asyncIterator]();
  return {
    [Symbol.asyncIterator]: () => ({
      next: () =>
        iter.next().then(({ done, value }) => ({
          done,
          value: f(value)
        }))
    })
  };
}
