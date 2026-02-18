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
 * header in the request.headers object.
 *
 * @param name  The name of the header
 * @param type  The io-ts Type for validating the header
 */
export const RequiredHeaderMiddleware = <S, A>(
  name: string,
  type: t.Type<A, S>
): IRequestMiddleware<"IResponseErrorValidation", A> => async (
  request
): Promise<E.Either<IResponse<"IResponseErrorValidation">, A>> =>
  pipe(
    request.headers[name],
    type.decode,
    E.mapLeft(ResponseErrorFromValidationErrors(type))
  );
