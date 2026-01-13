// eslint-disable @typescript-eslint/no-explicit-any

import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";

import { ContextMiddleware } from "../context_middleware";

describe("ContextMiddleware", () => {
  it("should extract the context from the request", async () => {
    const middleware = ContextMiddleware();

    const context = {
      log: () => true,
    };

    const request = {
      app: {
        get: (_: any) => context,
      },
    };

    pipe(
      await middleware(request as any),
      E.map((c) => expect(c).toEqual(context)),
    );
  });
});
