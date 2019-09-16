import * as t from "io-ts";

import { right } from "fp-ts/lib/Either";
import { none, Option, some } from "fp-ts/lib/Option";

import { ResponseErrorFromValidationErrors } from "italia-ts-commons/lib/responses";
import { IRequestMiddleware } from "../request_middleware";

/**
 * Returns a request middleware that extract an optional
 * parameter in the request.params object.
 *
 * @param name  The name of the parameter
 * @param type  The io-ts Type for validating the parameter
 */
export function OptionalParamMiddleware<S, A>(
  name: string,
  type: t.Type<A, S>
): IRequestMiddleware<"IResponseErrorValidation", Option<A>> {
  return request =>
    new Promise(resolve => {
      // If the parameter is not found return None
      if (request.params[name] === undefined) {
        resolve(right(none));
      }

      const validation = type.decode(request.params[name]);
      const result = validation.bimap(
        ResponseErrorFromValidationErrors(type),
        some
      );

      resolve(result);
    });
}
