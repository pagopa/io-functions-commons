import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";

interface IEntry {
  readonly key: string;
  readonly value: unknown;
}

export const isObject = (i: unknown): i is Record<string, unknown> =>
  typeof i === "object" &&
  i !== null &&
  !Object.keys(i).some(property => typeof property !== "string");

export const propertiesToArray = (input: unknown): ReadonlyArray<IEntry> => {
  const addDelimiter = (a: string, b: string): string => (a ? `${a}.${b}` : b);

  const paths = (obj: unknown, head = ""): ReadonlyArray<IEntry> =>
    isObject(obj)
      ? pipe(
          obj,
          Object.entries,
          RA.reduce(
            [] as ReadonlyArray<IEntry>, // cast required in order to avoid never[] automatic assigned type to empty array
            (output, [key, value]) =>
              pipe(addDelimiter(head, key), fullPath =>
                isObject(value)
                  ? output.concat(paths(value, fullPath))
                  : output.concat([{ key: fullPath, value }])
              )
          )
        )
      : [];

  return paths(input);
};

export const toArray: () => (
  input: unknown
) => // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
ReadonlyArray<IEntry> = () => input => propertiesToArray(input);
