import { RetrievedActivation } from "../models/activation";
import { Activation } from "../../generated/definitions/v2/Activation";

export const toApiServiceActivation = (
  activation: RetrievedActivation
): Activation => ({
  fiscal_code: activation.fiscalCode,
  service_id: activation.serviceId,
  status: activation.status,
  version: activation.version
});
