import { HiddenServicePayload } from "../../generated/definitions/HiddenServicePayload";
import { ServicePayload } from "../../generated/definitions/ServicePayload";
import { VisibleServicePayload } from "../../generated/definitions/VisibleServicePayload";

describe("ServicePayload definition", () => {
  const commonServicePayload = {
    authorized_cidrs: [],
    department_name: "Department Name",
    organization_fiscal_code: "12345678901",
    organization_name: "Organization Name",
    require_secure_channels: true,
    service_name: "Service Name",
    version: 0
  };

  const visibleService = {
    ...commonServicePayload,
    is_visible: true,
    service_metadata: {
      address: "address",
      app_android: "app",
      app_ios: "app",
      cta: "cta",
      description: "Description",
      email: "test@mail.it",
      pec: "pec@mail.it",
      phone: "333",
      privacy_url: "http://privateurl.it",
      scope: "LOCAL",
      support_url: "http://supporturl.it",
      token_name: "token",
      tos_url: "http://weburlk.it",
      web_url: "http://weburl.it"
    }
  };

  const hiddenService = {
    ...commonServicePayload,
    is_visible: false
  };

  const hiddenServiceWithoutIsVisible = {
    ...commonServicePayload
  };

  const invalidService = {
    is_visible: true,
    service_metadata: {
      address: "address",
      app_android: "app",
      app_ios: "app",
      cta: "cta",
      description: "Description",
      email: "test@mail.it",
      pec: "pec@mail.it",
      phone: "333",
      privacy_url: "http://privateurl.it",
      scope: "LOCAL",
      support_url: "http://supporturl.it",
      token_name: "token",
      tos_url: "http://weburlk.it",
      web_url: "http://weburl.it"
    }
  };

  it("should decode visibleService with VisibleService and ServicePayload", () => {
    const servicePayloadTest = ServicePayload.decode(visibleService);
    const visibleServiceTest = VisibleServicePayload.decode(visibleService);
    const hiddenServiceTest = HiddenServicePayload.decode(visibleService);

    expect(servicePayloadTest.isRight()).toBe(true);
    expect(visibleServiceTest.isRight()).toBe(true);
    expect(hiddenServiceTest.isLeft()).toBe(true);
  });

  it("should decode hiddenService with HiddenService and ServicePayload", () => {
    const servicePayloadTest = ServicePayload.decode(hiddenService);
    const visibleServiceTest = VisibleServicePayload.decode(hiddenService);
    const hiddenServiceTest = HiddenServicePayload.decode(hiddenService);

    expect(servicePayloadTest.isRight()).toBe(true);
    expect(visibleServiceTest.isLeft()).toBe(true);
    expect(hiddenServiceTest.isRight()).toBe(true);
  });

  it("should not decode invalidService with HiddenService, ServicePayload and VisibleServicePayload", () => {
    const servicePayloadTest = ServicePayload.decode(invalidService);
    const visibleServiceTest = VisibleServicePayload.decode(invalidService);
    const hiddenServiceTest = HiddenServicePayload.decode(invalidService);

    expect(servicePayloadTest.isLeft()).toBe(true);
    expect(visibleServiceTest.isLeft()).toBe(true);
    expect(hiddenServiceTest.isLeft()).toBe(true);
  });

  it("should decode hiddenServiceWithoutIsVisible with HiddenService and ServicePayload", () => {
    const servicePayloadTest = ServicePayload.decode(
      hiddenServiceWithoutIsVisible
    );
    const visibleServiceTest = VisibleServicePayload.decode(
      hiddenServiceWithoutIsVisible
    );
    const hiddenServiceTest = HiddenServicePayload.decode(
      hiddenServiceWithoutIsVisible
    );

    expect(servicePayloadTest.isRight()).toBe(true);
    expect(visibleServiceTest.isLeft()).toBe(true);
    expect(hiddenServiceTest.isRight()).toBe(true);
  });
});
