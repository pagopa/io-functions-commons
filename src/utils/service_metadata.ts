import { ServiceMetadata as ApiServiceMetadata } from "../../generated/definitions/ServiceMetadata";
import { ServiceMetadata } from "../models/service";

/* eslint-disable @typescript-eslint/naming-convention */
export const toApiServiceMetadata = (
  serviceMetadata: ServiceMetadata
): ApiServiceMetadata => ({
  address: serviceMetadata.address,
  app_android: serviceMetadata.appAndroid,
  app_ios: serviceMetadata.appIos,
  category: serviceMetadata.category,
  cta: serviceMetadata.cta,
  description: serviceMetadata.description,
  email: serviceMetadata.email,
  pec: serviceMetadata.pec,
  phone: serviceMetadata.phone,
  privacy_url: serviceMetadata.privacyUrl,
  scope: serviceMetadata.scope,
  support_url: serviceMetadata.supportUrl,
  token_name: serviceMetadata.tokenName,
  tos_url: serviceMetadata.tosUrl,
  web_url: serviceMetadata.webUrl
});
/* eslint-enable @typescript-eslint/naming-convention */
