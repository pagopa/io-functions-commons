// tslint:disable:no-any

import { ContextMiddleware } from "../context_middleware";

describe("ContextMiddleware", () => {
  it("should extract the context from the request", async () => {
    const middleware = ContextMiddleware();

    const context = {
      log: () => true
    };

    const request = {
      app: {
        get: (_: any) => context
      }
    };

    const response = await middleware(request as any);

    response.map(c => expect(c).toEqual(context));
  });
});
