import * as t from "io-ts";

import {
  IResponse,
  ResponseErrorFromValidationErrors
} from "@pagopa/ts-commons/lib/responses";
import { Either } from "fp-ts/lib/Either";
import { IRequestMiddleware } from "../request_middleware";

/**
 * Returns a request middleware that validates the presence of a required
 * payload in the request.body object.
 *
 * @param name  The name of the parameter
 * @param type  The io-ts Type for validating the parameter
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const RequiredBodyPayloadMiddleware = <S, A>(
  type: t.Type<A, S>
): IRequestMiddleware<"IResponseErrorValidation", A> => async (
  request
): Promise<Either<IResponse<"IResponseErrorValidation">, A>> =>
  type.decode(request.body).mapLeft(ResponseErrorFromValidationErrors(type));
