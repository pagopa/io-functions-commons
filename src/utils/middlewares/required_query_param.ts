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
// eslint-disable-next-line @typescript-eslint/naming-convention
export const RequiredQueryParamMiddleware = <S, A>(
  name: string,
  type: t.Type<A, S>
): IRequestMiddleware<"IResponseErrorValidation", A> => async (
  request
): Promise<Either<IResponse<"IResponseErrorValidation">, A>> =>
  type
    .decode(request.query[name])
    .mapLeft(ResponseErrorFromValidationErrors(type));
