import { SandboxFiscalCode } from "../../../generated/definitions/SandboxFiscalCode";

import { RequiredParamMiddleware } from "./required_param";

/**
 * A request middleware that validates the presence of a valid `SandboxFiscalCode` parameter
 * in the request. In case the parameter is missing or is not valid, the middleware
 * returns an `IResponseErrorValidation`.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const SandboxFiscalCodeMiddleware = RequiredParamMiddleware(
  "fiscalcode",
  SandboxFiscalCode
);
