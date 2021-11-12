import { CreatedMessageWithContent } from "../../generated/definitions/CreatedMessageWithContent";

import { HiddenServicePayload } from "../../generated/definitions/HiddenServicePayload";
import { ServicePayload } from "../../generated/definitions/ServicePayload";
import { VisibleServicePayload } from "../../generated/definitions/VisibleServicePayload";
import * as E from "fp-ts/lib/Either";
import * as t from "io-ts";

import { FiscalCode } from "../../generated/definitions/FiscalCode";
import { PaymentData } from "../../generated/definitions/PaymentData";
import { OrganizationFiscalCode } from "../../generated/definitions/OrganizationFiscalCode";
import { PaymentAmount } from "../../generated/definitions/PaymentAmount";
import { PaymentNoticeNumber } from "../../generated/definitions/PaymentNoticeNumber";
import { Payee } from "../../generated/definitions/Payee";
import { MessageContent } from "../../generated/definitions/MessageContent";
import { NewMessage } from "../../generated/definitions/NewMessage";
import { identity, pipe } from "fp-ts/lib/function";
import { StandardServiceCategoryEnum } from "../../generated/definitions/StandardServiceCategory";

import { ServiceMetadata as ApiServiceMetadata } from "../../generated/definitions/ServiceMetadata";
import { CommonServiceMetadata as ApiCommonServiceMetadata } from "../../generated/definitions/CommonServiceMetadata";
import { StandardServiceMetadata as ApiStandardServiceMetadata } from "../../generated/definitions/StandardServiceMetadata";
import { ServiceScopeEnum } from "../../generated/definitions/ServiceScope";
import { SpecialServiceCategoryEnum } from "../../generated/definitions/SpecialServiceCategory";

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

  const serviceMetadata = {
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
  };

  const visibleService = {
    ...commonServicePayload,
    is_visible: true,
    service_metadata: serviceMetadata
  };

  const hiddenService = {
    ...commonServicePayload,
    is_visible: false
  };

  const hiddenServiceWithMetadata = {
    ...hiddenService,
    service_metadata: serviceMetadata
  }

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

    expect(E.isRight(servicePayloadTest)).toBeTruthy();
    expect(E.isRight(visibleServiceTest)).toBeTruthy();
    expect(E.isLeft(hiddenServiceTest)).toBeTruthy();
  });

  it("should decode hiddenService with HiddenService and ServicePayload", () => {
    const servicePayloadTest = ServicePayload.decode(hiddenService);
    const visibleServiceTest = VisibleServicePayload.decode(hiddenService);
    const hiddenServiceTest = HiddenServicePayload.decode(hiddenService);

    expect(E.isRight(servicePayloadTest)).toBeTruthy();
    expect(E.isLeft(visibleServiceTest)).toBeTruthy();
    expect(E.isRight(hiddenServiceTest)).toBeTruthy();
  });

  it("should not decode invalidService with HiddenService, ServicePayload and VisibleServicePayload", () => {
    const servicePayloadTest = ServicePayload.decode(invalidService);
    const visibleServiceTest = VisibleServicePayload.decode(invalidService);
    const hiddenServiceTest = HiddenServicePayload.decode(invalidService);

    expect(E.isLeft(servicePayloadTest)).toBeTruthy();
    expect(E.isLeft(visibleServiceTest)).toBeTruthy();
    expect(E.isLeft(hiddenServiceTest)).toBeTruthy();
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

    expect(E.isRight(servicePayloadTest)).toBeTruthy();
    expect(E.isLeft(visibleServiceTest)).toBeTruthy();
    expect(E.isRight(hiddenServiceTest)).toBeTruthy();
  });

  it("should ignore category in ServicePayload", () => {
    // Only Admins can set service category, ServicePayload is the inferface exposed to PA
    pipe(
      ServicePayload.decode({...visibleService, service_metadata: {
        ...visibleService.service_metadata,
        category: SpecialServiceCategoryEnum.SPECIAL
      }}),
      E.map(_ => {
        expect(_.service_metadata).not.toHaveProperty("category");
        return _;
      }),
      E.chain(_ => ServicePayload.decode({...hiddenServiceWithMetadata, service_metadata: {
        ...hiddenServiceWithMetadata.service_metadata,
        category: SpecialServiceCategoryEnum.SPECIAL
      }})),
      E.map(_ => {
        expect(_.service_metadata).not.toHaveProperty("category");
        return _;
      }),
      E.fold(_ => fail("Unexpected decoding error"), identity)
    )
  });
});

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const anOrganizationFiscalCode = "12345678901" as OrganizationFiscalCode;
const aDate = new Date();
const aNewMessageWithoutContent = {
  fiscal_code: aFiscalCode
};
const aMessageWithoutContent = {
  id: "A_MESSAGE_ID",
  fiscal_code: aFiscalCode,
  created_at: aDate,
  sender_service_id: "test"
};

const aContentWithoutPaymentData = {
  subject:
    "A Subject of more than 80 characters. Try to reach this value with stupid words, and I will leave here because I like it",
  markdown:
    "A markdown of more than 80 characters. Try to reach this value with stupid words, and I will leave here because I like it"
};

const aPaymentDataWithoutPayee: PaymentData = {
  amount: 1000 as PaymentAmount,
  notice_number: "177777777777777777" as PaymentNoticeNumber
};

const aPayee: Payee = { fiscal_code: anOrganizationFiscalCode };

describe("NewMessage definition", () => {
  it("should decode NewMessage with content but without payment data", () => {
    const aMessageWithContentWithoutPaymentData = {
      ...aNewMessageWithoutContent,
      content: aContentWithoutPaymentData
    };

    expect(E.isRight(MessageContent.decode(aContentWithoutPaymentData))).toBeTruthy();

    const messageWithContent = NewMessage.decode(
      aMessageWithContentWithoutPaymentData
    );

    pipe(
      messageWithContent,
      E.fold(
        () => fail(),
        value => expect(value).toEqual({
          ...aMessageWithContentWithoutPaymentData,
          time_to_live: 3600
        })
      )
    );
  });

  it("should decode NewMessage with content and payment data but without payee", () => {
    const aMessageWithContentWithPaymentDataWithoutPayee = {
      ...aNewMessageWithoutContent,
      content: {
        ...aContentWithoutPaymentData,
        payment_data: aPaymentDataWithoutPayee
      }
    };

    const messageWithContent = NewMessage.decode(
      aMessageWithContentWithPaymentDataWithoutPayee
    );

    pipe(
      messageWithContent,
      E.fold(
        () => fail(),
        _ => expect(_).toEqual({
          ...aMessageWithContentWithPaymentDataWithoutPayee,
          content: {
            ...aMessageWithContentWithPaymentDataWithoutPayee.content,
            payment_data: {
              ...aMessageWithContentWithPaymentDataWithoutPayee.content.payment_data,
              invalid_after_due_date: false
            }
          },
          time_to_live: 3600
        })
      )
    );
  });

  it("should decode PaymentData with payment data with payee", () => {
    const aPaymentDataWithPayee = { ...aPaymentDataWithoutPayee, payee: aPayee };

    const messageWithContent = PaymentData.decode(
      aPaymentDataWithPayee
    );
    pipe(
      messageWithContent,
      E.fold(
        () => fail(),
        value => expect(value).toEqual({
          ...aPaymentDataWithPayee,
          invalid_after_due_date: false
        })
      )
    );
  });

  it("should decode NewMessage with content and payment data with payee", () => {
    const aMessageWithContentWithPaymentDataWithPayee = {
      ...aMessageWithoutContent,
      content: {
        ...aContentWithoutPaymentData,
        payment_data: { ...aPaymentDataWithoutPayee, payee: aPayee }
      }
    };

    expect(
      E.isRight(PaymentData.decode(
        aMessageWithContentWithPaymentDataWithPayee.content.payment_data
      ))
    ).toBeTruthy();

    const messageWithContent = NewMessage.decode(
      aMessageWithContentWithPaymentDataWithPayee
    );

    expect(E.isRight(messageWithContent)).toBeTruthy();
  });
});

describe("CreatedMessageWithContent definition", () => {
  it("should decode CreatedMessageWithContent with content and payment data with payee", () => {
    const aMessageWithContentWithPaymentDataWithoutPayee = {
      ...aMessageWithoutContent,
      content: {
        ...aContentWithoutPaymentData,
        payment_data: { ...aPaymentDataWithoutPayee, payee: aPayee }
      }
    };

    expect(
      E.isRight(Payee.decode(
        aMessageWithContentWithPaymentDataWithoutPayee.content.payment_data
          .payee
      ))
    ).toBeTruthy();

    const messageWithContent = CreatedMessageWithContent.decode(
      aMessageWithContentWithPaymentDataWithoutPayee
    );

    expect(E.isRight(messageWithContent)).toBeTruthy();
  });

  it("should NOT decode CreatedMessageWithContent with content and payment data without payee", () => {
    const aMessageWithContentWithPaymentDataWithoutPayee = {
      ...aMessageWithoutContent,
      content: {
        ...aContentWithoutPaymentData,
        payment_data: { ...aPaymentDataWithoutPayee }
      }
    };

    const messageWithContent = CreatedMessageWithContent.decode(
      aMessageWithContentWithPaymentDataWithoutPayee
    );

    expect(E.isLeft(messageWithContent)).toBeTruthy();
  });
});

describe("Type definition", () => {
  it("should decode MessageContent with content without payment data", () => {
    const decodedMessageContent = MessageContent.decode(
      aContentWithoutPaymentData
    );

    pipe(
      decodedMessageContent,
      E.fold(
        () => fail(),
        value => 
          expect(value).toEqual(aContentWithoutPaymentData)
      )
    );
  });

  it("should decode PaymentData without payee", () => {
    const decodedPaymentData = PaymentData.decode(aPaymentDataWithoutPayee);

    pipe(
      decodedPaymentData,
      E.fold(
        () => fail(),
        value => expect(value).toEqual({
          ...aPaymentDataWithoutPayee,
          invalid_after_due_date: false
        })
      )
    );
  });
});

describe("ServiceMetadata", () => {
  it("should API decode unsupported service metadata as common service metadata", () => {

    // Create a Fake service category unsupported by the App
    const UnsupportedServiceMetadata = t.intersection([
      ApiCommonServiceMetadata,
      t.interface({
        category: t.literal("UNSUPPORTED"),
        other_property: t.number
      })
    ]);
    type UnsupportedServiceMetadata = t.TypeOf<typeof UnsupportedServiceMetadata>;

    pipe(
      {
        scope: ServiceScopeEnum.LOCAL,
        category: "UNSUPPORTED",
        other_property: 1
      } as UnsupportedServiceMetadata,
      ApiServiceMetadata.decode,
      E.mapLeft(_ => fail("Unexpected decoding error")),
      E.map(_ => {
        expect(ApiCommonServiceMetadata.is(_)).toBeTruthy();
        expect(_).not.toHaveProperty("category");
        expect(_).not.toHaveProperty("other_property");
      })
    );

    pipe({
      scope: ServiceScopeEnum.LOCAL,
      category: StandardServiceCategoryEnum.STANDARD
    } as ApiStandardServiceMetadata,
      ApiServiceMetadata.decode,
      E.mapLeft(_ => fail("Unexpected decoding error")),
      E.map(_ => {
        expect(ApiStandardServiceMetadata.is(_)).toBeTruthy();
        expect(_).toHaveProperty("category", StandardServiceCategoryEnum.STANDARD);
      })
    );
  });
})
