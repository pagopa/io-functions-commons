import * as express from "express";

import { Either, left, right } from "fp-ts/lib/Either";
import { fromNullable, Option } from "fp-ts/lib/Option";

import {
  IResponse,
  IResponseErrorInternal,
  ResponseErrorInternal
} from "@pagopa/ts-commons/lib/responses";

import { Context } from "@azure/functions";
import { IRequestMiddleware } from "../request_middleware";

const CONTEXT_IDENTIFIER = "context";

export const setAppContext = (app: express.Express, context: Context): void => {
  app.set(CONTEXT_IDENTIFIER, context);
};

export const getAppContext = (request: express.Request): Option<Context> =>
  fromNullable(request.app.get(CONTEXT_IDENTIFIER));

/**
 * Returns a request middleware that extracts the Azure request context
 * from the request.
 *
 * @param T The type of the bindings found in the context.
 */
export const ContextMiddleware = (): IRequestMiddleware<
  "IResponseErrorInternal",
  Context
> => (request): Promise<Either<IResponse<"IResponseErrorInternal">, Context>> =>
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
