import * as t from "io-ts";

import {
  IResponse,
  ResponseErrorFromValidationErrors
} from "@pagopa/ts-commons/lib/responses";
import { Either } from "fp-ts/lib/Either";
import { IRequestMiddleware } from "../request_middleware";

/**
 * Returns a request middleware that validates the presence of a required
 * parameter in the request.params object.
 *
 * @param name  The name of the parameter
 * @param type  The io-ts Type for validating the parameter
 */
export const RequiredParamMiddleware = <S, A>(
  name: string,
  type: t.Type<A, S>
): IRequestMiddleware<"IResponseErrorValidation", A> => (
  request
): Promise<Either<IResponse<"IResponseErrorValidation">, A>> =>
  new Promise(resolve => {
    const validation = type.decode(request.params[name]);
    const result = validation.mapLeft(ResponseErrorFromValidationErrors(type));
    resolve(result);
  });
