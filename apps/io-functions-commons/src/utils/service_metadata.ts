import { pipe } from "fp-ts/lib/function";

import { ServiceMetadata as ApiServiceMetadata } from "../../generated/definitions/ServiceMetadata";
import { SpecialServiceMetadata as ApiSpecialServiceMetadata } from "../../generated/definitions/SpecialServiceMetadata";
import { StandardServiceMetadata } from "../../generated/definitions/StandardServiceMetadata";
import { ServiceMetadata, SpecialServiceMetadata } from "../models/service";

export const toApiServiceMetadata = (
  serviceMetadata: ServiceMetadata,
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
      web_url: serviceMetadata.webUrl,
    },
    (apiCommonService) =>
      SpecialServiceMetadata.is(serviceMetadata)
        ? ({
            ...apiCommonService,
            custom_special_flow: serviceMetadata.customSpecialFlow,
          } as ApiSpecialServiceMetadata)
        : (apiCommonService as StandardServiceMetadata),
  );
