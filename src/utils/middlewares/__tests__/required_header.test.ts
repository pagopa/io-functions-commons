import * as t from "io-ts";
import * as E from "fp-ts/lib/Either";

import { RequiredHeaderMiddleware } from "../required_header";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

describe("RequiredHeaderMiddleware", () => {
  it("should return the decoded value if the header is valid", async () => {
    const middleware = RequiredHeaderMiddleware(
      "x-required-header",
      NonEmptyString
    );
    const request = { headers: { "x-required-header": "valid-value" } };

    const result = await middleware(request as any);

    expect(result._tag).toBe("Right");
    if (result._tag === "Right") {
      expect(result.right).toBe("valid-value");
    }
  });

  it("should return a validation error if the header is missing", async () => {
    const middleware = RequiredHeaderMiddleware(
      "x-required-header",
      NonEmptyString
    );
    const request = { headers: {} };

    const result = await middleware(request as any);

    expect(result).toMatchObject(
      E.left({
        kind: "IResponseErrorValidation",
        detail: expect.stringContaining("Invalid non empty string:")
      })
    );
  });

  it("should return a validation error if the header value is invalid", async () => {
    const middleware = RequiredHeaderMiddleware(
      "x-required-header",
      NonEmptyString
    );
    const request = { headers: { "x-required-header": "" } };

    const result = await middleware(request as any);

    expect(result).toMatchObject(
      E.left({
        kind: "IResponseErrorValidation",
        detail: expect.stringContaining("Invalid non empty string:")
      })
    );
  });
});
