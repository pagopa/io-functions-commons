import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as t from "io-ts";

export const UNSET = t.literal("UNSET");
export type UNSET = t.TypeOf<typeof UNSET>;
export const UNSET_VALUE: UNSET = "UNSET";

export function isDefined<T>(o: null | T | undefined): o is T {
  return o !== undefined && o !== null;
}

/**
 * Refines an io-ts codec by making it add the `kind` attribute on
 * decode and remove it on encode.
 * The type guard (`T.is`) also checks that the `kind` attribute has
 * the correct value.
 *
 * @param codec The io-ts codec to be wrapped
 * @param kind The value of the `kind` attribute, note that it must be a literal string type
 */
export const wrapWithKind = <C extends t.Any, K extends string>(
  codec: C,
  kind: K,
): t.RefinementType<
  C,
  t.TypeOf<C> & { readonly kind: K },
  t.OutputOf<C>,
  t.InputOf<C>
> =>
  new t.RefinementType(
    kind,
    (a: unknown): a is t.TypeOf<C> => codec.is(a) && a.kind === kind,
    (i: t.InputOf<C>, context: t.Context) =>
      pipe(
        codec.validate(i, context),
        E.map((_) => ({
          ..._,
          kind,
        })),
      ),
    (a: t.TypeOf<C>) => {
      const { kind: _, ...o } = codec.encode(a) as t.OutputOf<C>;
      return o;
    },
    codec,
    (_) => true,
  );
