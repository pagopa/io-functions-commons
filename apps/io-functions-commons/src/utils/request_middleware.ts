/**
 * This module is a wrapper of @pagopa/ts-commons/lib/request_middleware
 * It is needed in order to add custom logging for express request handler
 */

import {
  IResponse,
  ResponseErrorInternal,
} from "@pagopa/ts-commons/lib/responses";
import * as express from "express";
import * as winston from "winston";

export type RequestHandler<R> = (
  request: express.Request,
) => Promise<IResponse<R>>;

/**
 * Transforms a typesafe RequestHandler into an Express Request Handler.
 *
 * Failed promises will be mapped to 500 errors handled by ResponseErrorGeneric.
 */
export const wrapRequestHandler =
  <R>(handler: RequestHandler<R>): express.RequestHandler =>
  (request, response, _): Promise<void> =>
    handler(request).then(
      (r) => {
        winston.log(
          "debug",
          `wrapRequestHandler|SUCCESS|${request.url}|${r.kind}`,
        );
        r.apply(response);
      },
      (e) => {
        winston.log("debug", `wrapRequestHandler|ERROR|${request.url}|${e}`);
        ResponseErrorInternal(e).apply(response);
      },
    );

export {
  IRequestMiddleware,
  withRequestMiddlewares,
} from "@pagopa/ts-commons/lib/request_middleware";
