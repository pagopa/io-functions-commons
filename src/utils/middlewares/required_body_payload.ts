import * as t from "io-ts";

import {
  IResponse,
  ResponseErrorFromValidationErrors
} from "@pagopa/ts-commons/lib/responses";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import { IRequestMiddleware } from "../request_middleware";

/**
 * Returns a request middleware that validates the presence of a required
 * payload in the request.body object.
 *
 * @param name  The name of the parameter
 * @param type  The io-ts Type for validating the parameter
 */
export const RequiredBodyPayloadMiddleware = <S, A>(
  type: t.Type<A, S>
): IRequestMiddleware<"IResponseErrorValidation", A> => async (
  request
): Promise<E.Either<IResponse<"IResponseErrorValidation">, A>> =>
  pipe(
    type.decode(request.body),
    E.mapLeft(ResponseErrorFromValidationErrors(type))
  );
