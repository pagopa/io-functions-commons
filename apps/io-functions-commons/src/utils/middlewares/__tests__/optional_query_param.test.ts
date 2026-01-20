// eslint-disable @typescript-eslint/no-explicit-any

import { isLeft, isRight } from "fp-ts/lib/Either";
import { isNone, isSome } from "fp-ts/lib/Option";
import * as t from "io-ts";

import { OptionalQueryParamMiddleware } from "../optional_query_param";

const middleware = OptionalQueryParamMiddleware("param", t.string);

describe("OptionalQueryParamMiddleware", () => {
  it("should respond with none if the query parameter is missing", async () => {
    const result = await middleware({
      query: {},
    } as any);

    expect(isRight(result)).toBeTruthy();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      const maybeValue = result.right;
      expect(isNone(maybeValue)).toBeTruthy();
    }
  });

  it("should respond with a validation error if the query parameter is present but is NOT valid", async () => {
    const result = await middleware({
      query: {
        param: 5,
      },
    } as any);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.left.kind).toBe("IResponseErrorValidation");
    }
  });

  it("should extract the query parameter if is present and valid", async () => {
    const result = await middleware({
      query: {
        param: "hello",
      },
    } as any);

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      const maybeValue = result.right;
      expect(isSome(maybeValue)).toBeTruthy();
      if (isSome(maybeValue)) {
        const value = maybeValue.value;
        expect(value).toBe("hello");
      }
    }
  });
});
