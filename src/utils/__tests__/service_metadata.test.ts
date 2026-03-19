import { ServiceMetadata } from "../../models/service";
import { ServiceMetadata as ApiServiceMetadata } from "../../../generated/definitions/v2/ServiceMetadata";
import { toApiServiceMetadata } from "../service_metadata";
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import { success } from "io-ts";
import { StandardServiceCategoryEnum } from "../../../generated/definitions/v2/StandardServiceCategory";
import { ServiceScopeEnum } from "../../../generated/definitions/v2/ServiceScope";

describe("toApiServiceMetadata", () => {
  it("should create a valid ServiceMetadata for the api definitions", () => {
    const aModelServiceMetadata: ServiceMetadata = {
      category: StandardServiceCategoryEnum.STANDARD,
      scope: ServiceScopeEnum.LOCAL,
      customSpecialFlow: undefined
    };

    const result = toApiServiceMetadata(aModelServiceMetadata);
    pipe(
      ApiServiceMetadata.decode(result),
      E.fold(_ => fail("Unexpected ServiceMetadata decode"), success)
    );
  });
});
