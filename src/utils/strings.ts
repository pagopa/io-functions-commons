import { NonEmptyString, Ulid } from "@pagopa/ts-commons/lib/strings";
import { ulid } from "ulid";

// a generator of identifiers
export type ObjectIdGenerator = () => NonEmptyString;

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
export const ulidGenerator: ObjectIdGenerator = () => ulid() as NonEmptyString;

export const ulidGeneratorAsUlid = () => ulid() as Ulid;
