import { ServiceCategoryEnum } from "../../../generated/definitions/ServiceCategory";
import { ServiceId } from "../../../generated/definitions/ServiceId";
import { ServiceScopeEnum } from "../../../generated/definitions/ServiceScope";
import { aVisibleService } from "../../../__mocks__/mocks";
import {
  toServicesTuple,
  VisibleService
} from "../visible_service";

const withScopeAndCategory = (scope: ServiceScopeEnum, category: ServiceCategoryEnum) => (
  s: VisibleService
): VisibleService => ({
  ...s,
  serviceMetadata: { ...s.serviceMetadata, scope, category }
});

const withId = (serviceId: ServiceId) => (
  s: VisibleService
): VisibleService => ({
  ...s,
  serviceId
});

const aVisibleServiceWithoutMetadata = aVisibleService;
const aVisibleNationalService = withScopeAndCategory(ServiceScopeEnum.NATIONAL, ServiceCategoryEnum.STANDARD)(
  aVisibleService
);
const aVisibleLocalService = withScopeAndCategory(ServiceScopeEnum.LOCAL, ServiceCategoryEnum.STANDARD)(aVisibleService);

// this to check our assumptions on mock values
expect(aVisibleServiceWithoutMetadata.serviceMetadata).not.toBeDefined();

const anUnsortedMap = new Map()
  .set("bbbb", withId("service1" as ServiceId)(aVisibleLocalService))
  .set("cccc", withId("service2" as ServiceId)(aVisibleLocalService))
  .set("aaaa", withId("service3" as ServiceId)(aVisibleLocalService));

describe("toServicesTuple", () => {
  it.each`
    title                                                      | value                                                       | expected
    ${"empty array on empty map"}                              | ${new Map()}                                                | ${[]}
    ${"a national service from a service with no scope"}       | ${new Map().set("any-key", aVisibleServiceWithoutMetadata)} | ${[{ scope: ServiceScopeEnum.NATIONAL, service_id: aVisibleNationalService.serviceId, version: 1 }]}
    ${"a national service from a service with national scope"} | ${new Map().set("any-key", aVisibleNationalService)}        | ${[{ scope: ServiceScopeEnum.NATIONAL, service_id: aVisibleNationalService.serviceId, version: 1 }]}
    ${"a tuple sorted by key ascending"}                       | ${anUnsortedMap}                                            | ${[expect.objectContaining({ service_id: "service3" }), expect.objectContaining({ service_id: "service1" }), expect.objectContaining({ service_id: "service2" })]}
  `("should return $title", ({ value, expected }) => {
    const result = toServicesTuple(value);

    expect(result).toEqual(expected);
  });
});

describe("toServicesPublic", () => {
  it.each`
    title                                | value            | expected
    ${"empty array on empty map"}        | ${new Map()}     | ${[]}
    ${"a tuple sorted by key ascending"} | ${anUnsortedMap} | ${[expect.objectContaining({ service_id: "service3" }), expect.objectContaining({ service_id: "service1" }), expect.objectContaining({ service_id: "service2" })]}
  `("should return $title", ({ value, expected }) => {
    const result = toServicesTuple(value);

    expect(result).toEqual(expected);
  });
});
