import { pipe } from "fp-ts/lib/function";
import { ServiceMetadata as ApiServiceMetadata } from "../../generated/definitions/v2/ServiceMetadata";
import { SpecialServiceMetadata as ApiSpecialServiceMetadata } from "../../generated/definitions/v2/SpecialServiceMetadata";
import { StandardServiceMetadata } from "../../generated/definitions/v2/StandardServiceMetadata";
import { ServiceMetadata, SpecialServiceMetadata } from "../models/service";

/* eslint-disable @typescript-eslint/naming-convention */
export const toApiServiceMetadata = (
  serviceMetadata: ServiceMetadata
): ApiServiceMetadata =>
  pipe(
    {
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
    },
    apiCommonService =>
      SpecialServiceMetadata.is(serviceMetadata)
        ? ({
            ...apiCommonService,
            custom_special_flow: serviceMetadata.customSpecialFlow
          } as ApiSpecialServiceMetadata)
        : (apiCommonService as StandardServiceMetadata)
  );
/* eslint-enable @typescript-eslint/naming-convention */
