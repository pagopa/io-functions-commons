import * as t from "io-ts";

import * as E from "fp-ts/lib/Either";
import { none, Option, some } from "fp-ts/lib/Option";

import {
  IResponse,
  ResponseErrorFromValidationErrors
} from "@pagopa/ts-commons/lib/responses";
import { pipe } from "fp-ts/lib/function";
import { IRequestMiddleware } from "../request_middleware";

/**
 * Returns a request middleware that extract an optional
 * parameter in the request.params object.
 *
 * @param name  The name of the parameter
 * @param type  The io-ts Type for validating the parameter
 */
export const OptionalQueryParamMiddleware = <S, A>(
  name: string,
  type: t.Type<A, S>
): IRequestMiddleware<"IResponseErrorValidation", Option<A>> => (
  request
): Promise<E.Either<IResponse<"IResponseErrorValidation">, Option<A>>> =>
  new Promise(resolve => {
    // If the parameter is not found return None
    if (request.query[name] === undefined) {
      resolve(E.right(none));
    }

    const validation = type.decode(request.query[name]);
    const result = pipe(
      validation,
      E.bimap(ResponseErrorFromValidationErrors(type), some)
    );

    resolve(result);
  });
