import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { isLeft } from "fp-ts/lib/Either";
const breakBuild: number = "not a number";

/**
 * Helper function that validates an environment variable and return its value
 * if it's a `NonEmptyString`.
 * Throws an Error otherwise.
 */
export const getRequiredStringEnv = (k: string): NonEmptyString => {
  const maybeValue = NonEmptyString.decode(process.env[k]);

  if (isLeft(maybeValue)) {
    throw new Error(`${k} must be defined and non-empty`);
  }

  return maybeValue.right;
};
