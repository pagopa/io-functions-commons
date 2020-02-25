// tslint:disable:no-any

import * as t from "io-ts";

import { isLeft, isRight } from "fp-ts/lib/Either";
import { RequiredBodyPayloadMiddleware } from "../required_body_payload";

const PayloadT = t.interface({
  foo: t.string
});

describe("RequiredBodyPayloadMiddleware", () => {
  const middleware = RequiredBodyPayloadMiddleware(PayloadT);

  it("should extract the required parameter from the request", async () => {
    const result = await middleware({
      body: {
        foo: "hello"
      }
    } as any);

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect<any>(result.value).toEqual({
        foo: "hello"
      });
    }
  });

  it("should respond with a validation error if the body payload does not validate", async () => {
    const result = await middleware({
      body: { foo: 1 }
    } as any);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toBe("IResponseErrorValidation");
    }
  });
});
