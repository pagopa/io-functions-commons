import * as express from "express";

import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";

import {
  IResponse,
  IResponseErrorInternal,
  ResponseErrorInternal
} from "@pagopa/ts-commons/lib/responses";

import { Context } from "@azure/functions";
import { pipe } from "fp-ts/lib/function";
import { IRequestMiddleware } from "../request_middleware";

const CONTEXT_IDENTIFIER = "context";

export const setAppContext = (app: express.Express, context: Context): void => {
  app.set(CONTEXT_IDENTIFIER, context);
};

export const getAppContext = (request: express.Request): O.Option<Context> =>
  O.fromNullable(request.app.get(CONTEXT_IDENTIFIER));

/**
 * Returns a request middleware that extracts the Azure request context
 * from the request.
 *
 * @param T The type of the bindings found in the context.
 */
export const ContextMiddleware = (): IRequestMiddleware<
  "IResponseErrorInternal",
  Context
> => (
  request
): Promise<E.Either<IResponse<"IResponseErrorInternal">, Context>> =>
  new Promise(resolve => {
    pipe(
      getAppContext(request),
      O.fold(
        () =>
          resolve(
            E.left<IResponseErrorInternal, Context>(
              ResponseErrorInternal("Cannot get context from request")
            )
          ),
        context => resolve(E.right<IResponseErrorInternal, Context>(context))
      )
    );
  });
