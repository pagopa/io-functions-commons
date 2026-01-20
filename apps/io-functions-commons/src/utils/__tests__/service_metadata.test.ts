import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import { success } from "io-ts";

import { ServiceMetadata as ApiServiceMetadata } from "../../../generated/definitions/ServiceMetadata";
import { ServiceScopeEnum } from "../../../generated/definitions/ServiceScope";
import { StandardServiceCategoryEnum } from "../../../generated/definitions/StandardServiceCategory";
import { ServiceMetadata } from "../../models/service";
import { toApiServiceMetadata } from "../service_metadata";

describe("toApiServiceMetadata", () => {
  it("should create a valid ServiceMetadata for the api definitions", () => {
    const aModelServiceMetadata: ServiceMetadata = {
      category: StandardServiceCategoryEnum.STANDARD,
      customSpecialFlow: undefined,
      scope: ServiceScopeEnum.LOCAL,
    };

    const result = toApiServiceMetadata(aModelServiceMetadata);
    pipe(
      ApiServiceMetadata.decode(result),
      E.fold((_) => fail("Unexpected ServiceMetadata decode"), success),
    );
  });
});
