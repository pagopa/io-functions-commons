import * as express from "express";

import { left, right } from "fp-ts/lib/Either";
import { fromNullable, Option } from "fp-ts/lib/Option";

import { IRequestMiddleware } from "../request_middleware";

import {
  IResponseErrorInternal,
  ResponseErrorInternal
} from "italia-ts-commons/lib/responses";

import { Context } from "@azure/functions";

const CONTEXT_IDENTIFIER = "context";

export function setAppContext(app: express.Express, context: Context): void {
  app.set(CONTEXT_IDENTIFIER, context);
}

export function getAppContext(request: express.Request): Option<Context> {
  return fromNullable(request.app.get(CONTEXT_IDENTIFIER));
}

/**
 * Returns a request middleware that extracts the Azure request context
 * from the request.
 *
 * @param T The type of the bindings found in the context.
 */
export function ContextMiddleware(): IRequestMiddleware<
  "IResponseErrorInternal",
  Context
> {
  return request =>
    new Promise(resolve => {
      getAppContext(request).foldL(
        () =>
          resolve(
            left<IResponseErrorInternal, Context>(
              ResponseErrorInternal("Cannot get context from request")
            )
          ),
        context => resolve(right<IResponseErrorInternal, Context>(context))
      );
    });
}
