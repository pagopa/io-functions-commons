import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as t from "io-ts";

export const PageResults = t.intersection([
  t.interface({
    hasMoreResults: t.boolean,
    items: t.readonlyArray(t.interface({ id: NonEmptyString }))
  }),
  t.partial({
    next: NonEmptyString,
    prev: NonEmptyString
  })
]);

export type PageResults = t.TypeOf<typeof PageResults>;

export const fillPage = async <T extends { readonly id: NonEmptyString }>(
  iter: AsyncIterator<T, T>,
  expectedPageSize: NonNegativeInteger
): Promise<PageResults> => {
  // eslint-disable-next-line functional/prefer-readonly-type
  const items: T[] = [];
  // eslint-disable-next-line functional/no-let
  let hasMoreResults: boolean = true;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await iter.next();
    if (done) {
      hasMoreResults = false;
      break;
    }
    if (items.length === expectedPageSize) {
      break;
    }
    // eslint-disable-next-line functional/immutable-data
    items.push(value);
  }

  const next = hasMoreResults
    ? pipe(
        O.fromNullable(items[items.length - 1]),
        O.map(e => e.id),
        O.toUndefined
      )
    : undefined;
  const prev = pipe(
    O.fromNullable(items[0]),
    O.map(e => e.id),
    O.toUndefined
  );
  return { hasMoreResults, items, next, prev };
};
