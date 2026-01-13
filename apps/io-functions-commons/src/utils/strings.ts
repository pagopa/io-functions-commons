import { NonEmptyString, Ulid } from "@pagopa/ts-commons/lib/strings";
import { ulid } from "ulid";

// a generator of identifiers
export type ObjectIdGenerator = () => NonEmptyString;

export const ulidGenerator: ObjectIdGenerator = () => ulid() as NonEmptyString;

export const ulidGeneratorAsUlid = (): Ulid => ulid() as Ulid;
