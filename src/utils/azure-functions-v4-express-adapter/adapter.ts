/**
 * Simple wrapper to convert IResponse handlers to Azure Functions.
 * Replaces express-azure-functions with a minimal implementation.
 *
 * Automatically adds security headers to all responses.
 */

import {
  InvocationContext,
  HttpRequest,
  HttpResponseInit
} from "@azure/functions";
import * as E from "fp-ts/lib/Either";

import {
  IRequestMiddleware,
  MiddlewareResults
} from "@pagopa/ts-commons/lib/request_middleware";
import { ResponseErrorInternal } from "@pagopa/ts-commons/lib/responses";

import {
  functionRequestToExpressRequest,
  iResponseToHttpResponse
} from "./mappers";

/**
 * Executes the provided request middlewares sequentially and returns either * - an IResponse (when a middleware fails validation), or
 * - an array of extracted arguments (middleware successful values)
 * @internal - exported only for testing purposes
 */
export const extractArgsFromMiddlewares = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...middlewares: ReadonlyArray<IRequestMiddleware<any, any>>
) =>
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async (req: HttpRequest, context: InvocationContext) => {
    // eslint-disable-next-line functional/prefer-readonly-type
    const args: unknown[] = [];

    // Convert Azure Functions request to Express-like request once
    // to avoid reading the body stream multiple times
    const expressReq = await functionRequestToExpressRequest(req, context);

    for (const mw of middlewares) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await mw(expressReq as any);

      if (E.isLeft(result)) {
        return E.left(result.left);
      }
      // eslint-disable-next-line functional/immutable-data
      args.push(result.right);
    }

    return E.right(args);
  };

/**
 * Adds security headers to the HTTP response
 * @internal
 */
const addSecurityHeaders = (response: HttpResponseInit): HttpResponseInit => ({
  ...response,
  headers: {
    "Content-Security-Policy": "default-src 'none'; upgrade-insecure-requests",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Origin-Agent-Cluster": "?1",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=15552000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-DNS-Prefetch-Control": "off",
    "X-Download-Options": "noopen",
    "X-Frame-Options": "DENY",
    "X-Permitted-Cross-Domain-Policies": "none",
    "X-XSS-Protection": "0",
    ...response.headers
  }
});

interface IResponse<T> {
  readonly kind: T;
  readonly apply: (response: any) => void;
}

/**
 * Wraps a handler function for Azure Functions v4 programming model.
 * Compatible with app.http() registration.
 *
 * @example
 * import { app } from '@azure/functions';
 * import { wrapHandlerV4 } from "@pagopa/io-functions-commons/dist/src/utils/azure-functions-v4-express-adapter";
 *
 * export const GetProfile = wrapHandlerV4(
 *   [FiscalCodeMiddleware] as const,
 *   async (fiscalCode) => {
 *     // your handler logic returning IResponse
 *     return ResponseSuccessJson({ id: fiscalCode });
 *   }
 * );
 *
 * app.http('GetProfile', {
 *   methods: ['GET'],
 *   authLevel: 'anonymous',
 *   route: 'profiles/{fiscalcode}',
 *   handler: GetProfile
 * });
 */
export const wrapHandlerV4 = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TMiddlewares extends ReadonlyArray<IRequestMiddleware<any, any>>,
  T
>(
  middlewares: TMiddlewares,
  handler: (...args: MiddlewareResults<TMiddlewares>) => Promise<IResponse<T>>
): ((
  req: HttpRequest,
  context: InvocationContext
) => Promise<HttpResponseInit>) => async (
  req,
  context
): Promise<HttpResponseInit> => {
  try {
    const extractArgs = extractArgsFromMiddlewares(...middlewares);
    const maybe = await extractArgs(req, context);

    if (E.isLeft(maybe)) {
      context.error("Middleware Error:", maybe.left.kind, maybe.left.detail);
      return addSecurityHeaders(iResponseToHttpResponse(maybe.left));
    }

    const args = maybe.right;
    const iresponse = await handler(
      ...((args as unknown) as MiddlewareResults<TMiddlewares>)
    );

    return addSecurityHeaders(iResponseToHttpResponse(iresponse));
  } catch (error) {
    context.error("Unexpected Internal Server Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return addSecurityHeaders(
      iResponseToHttpResponse(ResponseErrorInternal(errorMessage))
    );
  }
};
