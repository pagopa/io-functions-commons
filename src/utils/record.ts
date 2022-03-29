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

/**
 * Flatten all the input object properties in an array of {key,value}.
 * The nested object (if present) will be flattened using as key the leaf path name splitted by .
 * (eg {nested1: {nested11: 1, nested:12: 2}} will be flatten in [{key: "nested1.nested11", value: 1}, {key:"nested1.nested12", value: 2}])
 *
 * @param input an object
 * @returns an array of all the input object {key,value}
 */
export const propertiesToArray = (input: unknown): ReadonlyArray<IEntry> => {
  const addDelimiter = (a: string, b: string): string => (a ? `${a}/${b}` : b);

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
