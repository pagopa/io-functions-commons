import * as t from "io-ts";

import { ResponseErrorFromValidationErrors } from "italia-ts-commons/lib/responses";
import { IRequestMiddleware } from "../request_middleware";

/**
 * Returns a request middleware that validates the presence of a required
 * payload in the request.body object.
 *
 * @param name  The name of the parameter
 * @param type  The io-ts Type for validating the parameter
 */
export function RequiredBodyPayloadMiddleware<S, A>(
  type: t.Type<A, S>
): IRequestMiddleware<"IResponseErrorValidation", A> {
  return async request =>
    type.decode(request.body).mapLeft(ResponseErrorFromValidationErrors(type));
}
