import { CreatedMessageWithContent } from "../../generated/definitions/CreatedMessageWithContent";
import { CreatedMessageWithoutContent } from "../../generated/definitions/CreatedMessageWithoutContent";
import { HiddenServicePayload } from "../../generated/definitions/HiddenServicePayload";
import { ServicePayload } from "../../generated/definitions/ServicePayload";
import { VisibleServicePayload } from "../../generated/definitions/VisibleServicePayload";

import { toString } from "fp-ts/lib/function";
import { FiscalCode } from "../../generated/definitions/FiscalCode";
import { PaymentData } from "../../generated/definitions/PaymentData";
import { OrganizationFiscalCode } from "../../generated/definitions/OrganizationFiscalCode";
import { PaymentAmount } from "../../generated/definitions/PaymentAmount";
import { PaymentNoticeNumber } from "../../generated/definitions/PaymentNoticeNumber";
import { Payee } from "../../generated/definitions/Payee";
import { PaymentDataWithPayee } from "../../generated/definitions/PaymentDataWithPayee";
import { MessageContent } from "../../generated/definitions/MessageContent";

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

describe("NewMessage definition", () => {
  const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
  const anOrganizationFiscalCode = "FRLFRC74E04B157I" as OrganizationFiscalCode;
  const aDate = new Date();
  const aMessageWithoutContent = {
    id: "A_MESSAGE_ID",
    fiscal_code: aFiscalCode,
    created_at: aDate,
    sender_service_id: "test"
  };

  const aCountentWithoutPaymentData = {
    subject:
      "A Subject of more than 80 characters. Try to reach this value with stupid words, but it's too hard!!! Very hard!!!!!!",
    markdown:
      "A markdown of more than 80 characters. Try to reach this value with stupid words, but it's too hard!!! Very hard!!!!!!!"
  };

  const aPaymentDataWithoutPayee: PaymentData = {
    amount: 10.0 as PaymentAmount,
    notice_number: "1001242" as PaymentNoticeNumber
  };

  const aPayee: Payee = { fiscal_code: anOrganizationFiscalCode };

  it("should decode message without content", () => {
    const messageWithoutContent = CreatedMessageWithoutContent.decode(
      aMessageWithoutContent
    );

    expect(messageWithoutContent.isRight()).toBe(true);
  });

  it("should decode message with content but without payment data", () => {
    const aMessageWithContent = {
      ...aMessageWithoutContent,
      content: aCountentWithoutPaymentData
    };

    const messageWithContent = CreatedMessageWithContent.decode(
      aMessageWithContent
    );

    expect(messageWithContent.isRight()).toBe(true);
  });

  it("should not decode message with content and payment data but without payee", () => {
    const aMessageWithContentWithPaymentDataWithoutPayee  = {
      ...aMessageWithoutContent,
      content: {
        ...aCountentWithoutPaymentData,
        payment_data: aPaymentDataWithoutPayee
      }
    };

    const messageWithContent = MessageContent.decode(
      {
        ...aCountentWithoutPaymentData,
        payment_data: aPaymentDataWithoutPayee
      }
    );

    
    
    expect(messageWithContent.isLeft()).toBe(true);
  });
});
