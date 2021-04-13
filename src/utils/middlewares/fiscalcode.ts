import { FiscalCode } from "../../../generated/definitions/FiscalCode";

import { OptionalParamMiddleware } from "./optional_param";
import { RequiredParamMiddleware } from "./required_param";

/**
 * A request middleware that validates the presence of a valid `fiscalcode` parameter
 * in the request. In case the parameter is missing or is not valid, the middleware
 * returns an `IResponseErrorValidation`.
 */
export const FiscalCodeMiddleware = RequiredParamMiddleware(
  "fiscalcode",
  FiscalCode
);

/**
 * A request middleware that validates the presence of a valid `fiscalcode` parameter
 * in the request.
 * The middleware returns:
 * - `none`: if the parameter is not present in the request
 * - `some(FiscalCode)`: if the parameter is present in the request and is valid
 * - `IResponseErrorValidation` it the parameter is present in the request but is NOT valid
 */
export const OptionalFiscalCodeMiddleware = OptionalParamMiddleware(
  "fiscalcode",
  FiscalCode
);
