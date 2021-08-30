import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { fromNullable } from "fp-ts/lib/Option";
import * as t from "io-ts";

export const PageResults = t.intersection([
  t.interface({
    values: t.readonlyArray(t.interface({ id: NonEmptyString }))
  }),
  t.partial({
    done: t.boolean
  })
]);

export type PageResults = t.TypeOf<typeof PageResults>;

export const fillPage = async <T extends { readonly id: NonEmptyString }>(
  iter: AsyncIterator<T, T>,
  expectedPageSize: NonNegativeInteger,
  acc: ReadonlyArray<{ readonly id: NonEmptyString }> = []
): Promise<PageResults> => {
  const { value, done } = await iter.next();
  const results = [
    ...acc,
    ...fromNullable(value)
      .map(v => [v])
      .getOrElse([])
  ];
  return results.length === expectedPageSize || done === true
    ? { done, values: results }
    : fillPage(iter, expectedPageSize, results);
};
