import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as t from "io-ts";

export const PageResults = t.intersection([
  t.interface({
    items: t.readonlyArray(t.interface({ id: t.string })),
  }),
  t.partial({
    next: t.string,
    prev: t.string,
  }),
]);

export type PageResults = t.TypeOf<typeof PageResults>;

export const toPageResults = <T extends { readonly id: string }>(
  items: readonly T[],
  hasMoreResults: boolean,
): PageResults => {
  const next = hasMoreResults
    ? pipe(
        O.fromNullable(items[items.length - 1]),
        O.map((e) => e.id),
        O.toUndefined,
      )
    : undefined;
  const prev = pipe(
    O.fromNullable(items[0]),
    O.map((e) => e.id),
    O.toUndefined,
  );
  return {
    items,
    next,
    prev,
  };
};
