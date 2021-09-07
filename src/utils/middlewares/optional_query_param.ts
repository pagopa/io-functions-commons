import * as t from "io-ts";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";

import {
  IResponse,
  ResponseErrorFromValidationErrors
} from "@pagopa/ts-commons/lib/responses";
import { flow, pipe } from "fp-ts/lib/function";
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
): IRequestMiddleware<"IResponseErrorValidation", O.Option<A>> => (
  request
): Promise<E.Either<IResponse<"IResponseErrorValidation">, O.Option<A>>> =>
  new Promise(resolve =>
    // If the parameter is not found return None
    pipe(
      request.query[name],
      O.fromNullable,
      O.fold(
        () => E.right(O.none),
        flow(
          type.decode,
          E.bimap(ResponseErrorFromValidationErrors(type), O.some)
        )
      ),
      resolve
    )
  );
