import { NonEmptyString, Semver } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import { identity, pipe } from "fp-ts/lib/function";
import * as t from "io-ts";

import { aService } from "../../__mocks__/mocks";
import { AppVersion } from "../../generated/definitions/AppVersion";
import { CommonServiceMetadata as ApiCommonServiceMetadata } from "../../generated/definitions/CommonServiceMetadata";
import { CreatedMessageWithContent } from "../../generated/definitions/CreatedMessageWithContent";
import { EnrichedMessage } from "../../generated/definitions/EnrichedMessage";
import { ExternalCreatedMessageWithContent } from "../../generated/definitions/ExternalCreatedMessageWithContent";
import { FeatureLevelTypeEnum } from "../../generated/definitions/FeatureLevelType";
import { FiscalCode } from "../../generated/definitions/FiscalCode";
import { HiddenServicePayload } from "../../generated/definitions/HiddenServicePayload";
import { MessageContent } from "../../generated/definitions/MessageContent";
import { MessageStatus } from "../../generated/definitions/MessageStatus";
import { Change_typeEnum as ArchinvingChangeType } from "../../generated/definitions/MessageStatusArchivingChange";
import { MessageStatusAttributes } from "../../generated/definitions/MessageStatusAttributes";
import { Change_typeEnum as BulkChangeType } from "../../generated/definitions/MessageStatusBulkChange";
import { MessageStatusChange } from "../../generated/definitions/MessageStatusChange";
import { Change_typeEnum as ReadingChangeType } from "../../generated/definitions/MessageStatusReadingChange";
import { MessageStatusWithAttributes } from "../../generated/definitions/MessageStatusWithAttributes";
import { NewMessage } from "../../generated/definitions/NewMessage";
import { NotRejectedMessageStatusValueEnum as MessageStatusValueEnum } from "../../generated/definitions/NotRejectedMessageStatusValue";
import { OrganizationFiscalCode } from "../../generated/definitions/OrganizationFiscalCode";
import { Payee } from "../../generated/definitions/Payee";
import { PaymentAmount } from "../../generated/definitions/PaymentAmount";
import { PaymentData } from "../../generated/definitions/PaymentData";
import { PaymentNoticeNumber } from "../../generated/definitions/PaymentNoticeNumber";
import { ServiceMetadata as ApiServiceMetadata } from "../../generated/definitions/ServiceMetadata";
import { ServicePayload } from "../../generated/definitions/ServicePayload";
import { ServiceScopeEnum } from "../../generated/definitions/ServiceScope";
import { SpecialServiceCategoryEnum } from "../../generated/definitions/SpecialServiceCategory";
import { StandardServiceCategoryEnum } from "../../generated/definitions/StandardServiceCategory";
import { StandardServiceMetadata as ApiStandardServiceMetadata } from "../../generated/definitions/StandardServiceMetadata";
import { ThirdPartyData } from "../../generated/definitions/ThirdPartyData";
import { ThirdPartyMessage } from "../../generated/definitions/ThirdPartyMessage";
import { VisibleServicePayload } from "../../generated/definitions/VisibleServicePayload";

describe("ServicePayload definition", () => {
  const commonServicePayload = {
    authorized_cidrs: [],
    department_name: "Department Name",
    organization_fiscal_code: "12345678901",
    organization_name: "Organization Name",
    require_secure_channels: true,
    service_name: "Service Name",
    version: 0,
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
    privacy_url: "https://privateurl.it",
    scope: "LOCAL",
    support_url: "https://supporturl.it",
    token_name: "token",
    tos_url: "https://weburlk.it",
    web_url: "https://weburl.it",
  };

  const visibleService = {
    ...commonServicePayload,
    is_visible: true,
    service_metadata: serviceMetadata,
  };

  const hiddenService = {
    ...commonServicePayload,
    is_visible: false,
  };

  const hiddenServiceWithMetadata = {
    ...hiddenService,
    service_metadata: serviceMetadata,
  };

  const hiddenServiceWithoutIsVisible = {
    ...commonServicePayload,
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
      privacy_url: "https://privateurl.it",
      scope: "LOCAL",
      support_url: "https://supporturl.it",
      token_name: "token",
      tos_url: "https://weburlk.it",
      web_url: "https://weburl.it",
    },
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
      hiddenServiceWithoutIsVisible,
    );
    const visibleServiceTest = VisibleServicePayload.decode(
      hiddenServiceWithoutIsVisible,
    );
    const hiddenServiceTest = HiddenServicePayload.decode(
      hiddenServiceWithoutIsVisible,
    );

    expect(E.isRight(servicePayloadTest)).toBeTruthy();
    expect(E.isLeft(visibleServiceTest)).toBeTruthy();
    expect(E.isRight(hiddenServiceTest)).toBeTruthy();
  });

  it("should ignore category in ServicePayload", () => {
    // Only Admins can set service category, ServicePayload is the inferface exposed to PA
    pipe(
      ServicePayload.decode({
        ...visibleService,
        service_metadata: {
          ...visibleService.service_metadata,
          category: SpecialServiceCategoryEnum.SPECIAL,
        },
      }),
      E.map((_) => {
        expect(_.service_metadata).not.toHaveProperty("category");
        return _;
      }),
      E.chain((_) =>
        ServicePayload.decode({
          ...hiddenServiceWithMetadata,
          service_metadata: {
            ...hiddenServiceWithMetadata.service_metadata,
            category: SpecialServiceCategoryEnum.SPECIAL,
          },
        }),
      ),
      E.map((_) => {
        expect(_.service_metadata).not.toHaveProperty("category");
        return _;
      }),
      E.fold((_) => fail("Unexpected decoding error"), identity),
    );
  });
});

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const anOrganizationFiscalCode = "12345678901" as OrganizationFiscalCode;
const aDate = new Date();
const aNewMessageWithoutContent = {
  fiscal_code: aFiscalCode,
};
const aMessageWithoutContent = {
  created_at: aDate,
  fiscal_code: aFiscalCode,
  id: "A_MESSAGE_ID",
  sender_service_id: "test",
};

const aContentWithoutPaymentData = {
  markdown:
    "A markdown of more than 80 characters. Try to reach this value with stupid words, and I will leave here because I like it",
  subject:
    "A Subject of more than 80 characters. Try to reach this value with stupid words, and I will leave here because I like it",
};

const aPaymentDataWithoutPayee: PaymentData = {
  amount: 1000 as PaymentAmount,
  notice_number: "177777777777777777" as PaymentNoticeNumber,
};

const aContentWithLegalData = {
  ...aContentWithoutPaymentData,
  legal_data: {
    has_attachment: true,

    message_unique_id: "000001",

    sender_mail_from: "test@test.it",
  },
};

const aContentWithThirdPartyData = {
  ...aContentWithoutPaymentData,
  third_party_data: {
    id: "aThirdPartyId",
    original_sender: "Comune di Mêlée",
  },
};

const aPayee: Payee = { fiscal_code: anOrganizationFiscalCode };

const aThirdPartyId = "aThirdPartyId" as NonEmptyString;

describe("EnrichedMessage", () => {
  const aValidEnrichedMessage: EnrichedMessage = {
    created_at: aDate,
    fiscal_code: aFiscalCode,
    id: "A_MESSAGE_ID",
    is_archived: false,
    is_read: false,
    message_title: "aTitle",
    organization_fiscal_code: aService.organizationFiscalCode,
    organization_name: aService.organizationName,
    sender_service_id:
      aMessageWithoutContent.sender_service_id as NonEmptyString,
    service_name: "aService",
  };

  it("should correctly decode a valid EnrichedMessage", () => {
    expect(E.isRight(EnrichedMessage.decode(aValidEnrichedMessage))).toBe(true);
  });

  it("should fail decoding an EnrichedMessage without organization fiscal code", () => {
    expect(
      E.isLeft(
        EnrichedMessage.decode({
          ...aValidEnrichedMessage,
          organization_fiscal_code: undefined,
        }),
      ),
    ).toBe(true);
  });
});

describe("NewMessage definition", () => {
  it("should decode STANDARD NewMessage with content but without payment data", () => {
    const aMessageWithContentWithoutPaymentData = {
      ...aNewMessageWithoutContent,
      content: aContentWithoutPaymentData,
    };

    expect(
      E.isRight(MessageContent.decode(aContentWithoutPaymentData)),
    ).toBeTruthy();

    const messageWithContent = NewMessage.decode(
      aMessageWithContentWithoutPaymentData,
    );

    pipe(
      messageWithContent,
      E.fold(
        () => fail(),
        (value) =>
          expect(value).toEqual({
            ...aMessageWithContentWithoutPaymentData,
            feature_level_type: FeatureLevelTypeEnum.STANDARD,
            time_to_live: 3600,
          }),
      ),
    );
  });

  it("should decode ADVANCED NewMessage with content but without payment data", () => {
    const aMessageWithContentWithoutPaymentData = {
      ...aNewMessageWithoutContent,
      content: aContentWithoutPaymentData,
      feature_level_type: FeatureLevelTypeEnum.ADVANCED,
    };

    expect(
      E.isRight(MessageContent.decode(aContentWithoutPaymentData)),
    ).toBeTruthy();

    const messageWithContent = NewMessage.decode(
      aMessageWithContentWithoutPaymentData,
    );

    pipe(
      messageWithContent,
      E.fold(
        () => fail(),
        (value) =>
          expect(value).toEqual({
            ...aMessageWithContentWithoutPaymentData,
            feature_level_type: FeatureLevelTypeEnum.ADVANCED,
            time_to_live: 3600,
          }),
      ),
    );
  });

  it("should decode NewMessage with content and payment data but without payee", () => {
    const aMessageWithContentWithPaymentDataWithoutPayee = {
      ...aNewMessageWithoutContent,
      content: {
        ...aContentWithoutPaymentData,
        payment_data: aPaymentDataWithoutPayee,
      },
    };

    const messageWithContent = NewMessage.decode(
      aMessageWithContentWithPaymentDataWithoutPayee,
    );

    pipe(
      messageWithContent,
      E.fold(
        () => fail(),
        (_) =>
          expect(_).toEqual({
            ...aMessageWithContentWithPaymentDataWithoutPayee,
            content: {
              ...aMessageWithContentWithPaymentDataWithoutPayee.content,
              payment_data: {
                ...aMessageWithContentWithPaymentDataWithoutPayee.content
                  .payment_data,
                invalid_after_due_date: false,
              },
            },
            feature_level_type: FeatureLevelTypeEnum.STANDARD,
            time_to_live: 3600,
          }),
      ),
    );
  });

  it("should decode PaymentData with payment data with payee", () => {
    const aPaymentDataWithPayee = {
      ...aPaymentDataWithoutPayee,
      payee: aPayee,
    };

    const messageWithContent = PaymentData.decode(aPaymentDataWithPayee);
    pipe(
      messageWithContent,
      E.fold(
        () => fail(),
        (value) =>
          expect(value).toEqual({
            ...aPaymentDataWithPayee,
            invalid_after_due_date: false,
          }),
      ),
    );
  });

  it("should decode NewMessage with content and payment data with payee", () => {
    const aMessageWithContentWithPaymentDataWithPayee = {
      ...aMessageWithoutContent,
      content: {
        ...aContentWithoutPaymentData,
        payment_data: { ...aPaymentDataWithoutPayee, payee: aPayee },
      },
    };

    expect(
      E.isRight(
        PaymentData.decode(
          aMessageWithContentWithPaymentDataWithPayee.content.payment_data,
        ),
      ),
    ).toBeTruthy();

    const messageWithContent = NewMessage.decode(
      aMessageWithContentWithPaymentDataWithPayee,
    );

    expect(E.isRight(messageWithContent)).toBeTruthy();
  });
});

describe("CreatedMessageWithContent definition", () => {
  it("should decode STANDARD CreatedMessageWithContent with content and payment data with payee", () => {
    const aMessageWithContentWithPaymentDataWithoutPayee = {
      ...aMessageWithoutContent,
      content: {
        ...aContentWithoutPaymentData,
        payment_data: { ...aPaymentDataWithoutPayee, payee: aPayee },
      },
    };

    expect(
      E.isRight(
        Payee.decode(
          aMessageWithContentWithPaymentDataWithoutPayee.content.payment_data
            .payee,
        ),
      ),
    ).toBeTruthy();

    const messageWithContent = CreatedMessageWithContent.decode(
      aMessageWithContentWithPaymentDataWithoutPayee,
    );

    expect(E.isRight(messageWithContent)).toBeTruthy();
  });

  it("should NOT decode CreatedMessageWithContent with content and payment data without payee", () => {
    const aMessageWithContentWithPaymentDataWithoutPayee = {
      ...aMessageWithoutContent,
      content: {
        ...aContentWithoutPaymentData,
        payment_data: { ...aPaymentDataWithoutPayee },
      },
    };

    const messageWithContent = CreatedMessageWithContent.decode(
      aMessageWithContentWithPaymentDataWithoutPayee,
    );

    expect(E.isLeft(messageWithContent)).toBeTruthy();
  });

  it("should decode ADVANCED CreatedMessageWithContent with content and payment data with payee", () => {
    const aMessageWithContentWithPaymentDataWithPayee = {
      ...aMessageWithoutContent,
      content: {
        ...aContentWithoutPaymentData,
        payment_data: { ...aPaymentDataWithoutPayee, payee: aPayee },
      },
      feature_level_type: FeatureLevelTypeEnum.ADVANCED,
    };

    expect(
      E.isRight(
        Payee.decode(
          aMessageWithContentWithPaymentDataWithPayee.content.payment_data
            .payee,
        ),
      ),
    ).toBeTruthy();

    const messageWithContent = CreatedMessageWithContent.decode(
      aMessageWithContentWithPaymentDataWithPayee,
    );

    expect(E.isRight(messageWithContent)).toBeTruthy();
  });
});

describe("ExternalCreatedMessageWithContent definition", () => {
  it("should decode STANDARD CreatedMessageWithContent with content and payment data with payee", () => {
    const aMessageWithContentWithPaymentDataWithoutPayee = {
      ...aMessageWithoutContent,
      content: {
        ...aContentWithoutPaymentData,
        payment_data: { ...aPaymentDataWithoutPayee, payee: aPayee },
      },
    };

    expect(
      E.isRight(
        Payee.decode(
          aMessageWithContentWithPaymentDataWithoutPayee.content.payment_data
            .payee,
        ),
      ),
    ).toBeTruthy();

    const messageWithContent = ExternalCreatedMessageWithContent.decode(
      aMessageWithContentWithPaymentDataWithoutPayee,
    );

    expect(E.isRight(messageWithContent)).toBeTruthy();
  });

  it("should NOT decode ExternalCreatedMessageWithContent with content and payment data without payee", () => {
    const aMessageWithContentWithPaymentDataWithoutPayee = {
      ...aMessageWithoutContent,
      content: {
        ...aContentWithoutPaymentData,
        payment_data: { ...aPaymentDataWithoutPayee },
      },
    };

    const messageWithContent = ExternalCreatedMessageWithContent.decode(
      aMessageWithContentWithPaymentDataWithoutPayee,
    );

    expect(E.isLeft(messageWithContent)).toBeTruthy();
  });

  it("should decode ADVANCED ExternalCreatedMessageWithContent with content and payment data with payee", () => {
    const aMessageWithContentWithPaymentDataWithPayee = {
      ...aMessageWithoutContent,
      content: {
        ...aContentWithoutPaymentData,
        payment_data: { ...aPaymentDataWithoutPayee, payee: aPayee },
      },
      feature_level_type: FeatureLevelTypeEnum.ADVANCED,
    };

    expect(
      E.isRight(
        Payee.decode(
          aMessageWithContentWithPaymentDataWithPayee.content.payment_data
            .payee,
        ),
      ),
    ).toBeTruthy();

    const messageWithContent = ExternalCreatedMessageWithContent.decode(
      aMessageWithContentWithPaymentDataWithPayee,
    );

    expect(E.isRight(messageWithContent)).toBeTruthy();

    pipe(
      messageWithContent,
      E.fold(
        () => fail(),
        (value) =>
          expect(value).toMatchObject(
            expect.objectContaining({
              feature_level_type: FeatureLevelTypeEnum.ADVANCED,
            }),
          ),
      ),
    );
  });
});

describe("Type definition", () => {
  it("should decode MessageContent with content without payment data", () => {
    const decodedMessageContent = MessageContent.decode(
      aContentWithoutPaymentData,
    );

    pipe(
      decodedMessageContent,
      E.fold(
        () => fail(),
        (value) => expect(value).toEqual(aContentWithoutPaymentData),
      ),
    );
  });

  it("should decode PaymentData without payee", () => {
    const decodedPaymentData = PaymentData.decode(aPaymentDataWithoutPayee);

    pipe(
      decodedPaymentData,
      E.fold(
        () => fail(),
        (value) =>
          expect(value).toEqual({
            ...aPaymentDataWithoutPayee,
            invalid_after_due_date: false,
          }),
      ),
    );
  });

  it("should decode MessageContent with content with legal data", () => {
    const decodedMessageContent = MessageContent.decode(aContentWithLegalData);

    pipe(
      decodedMessageContent,
      E.fold(
        () => fail(),
        (value) => expect(value).toEqual(aContentWithLegalData),
      ),
    );
  });

  it("should decode MessageContent with content with Third Party data", () => {
    const decodedMessageContent = MessageContent.decode(
      aContentWithThirdPartyData,
    );

    pipe(
      decodedMessageContent,
      E.fold(
        () => fail(),
        (value) =>
          expect(value).toEqual({
            ...aContentWithThirdPartyData,
            third_party_data: {
              ...aContentWithThirdPartyData.third_party_data,
              has_attachments: false,
              has_remote_content: false,
            },
          }),
      ),
    );
  });

  it("should fail decoding a MessageContent with Third Party data without id", () => {
    const aContentWithThirdPartyDataWithoutId = {
      ...aContentWithoutPaymentData,
      third_party_data: {
        original_sender: "Comune di Mêlée",
      },
    };

    const decodedMessageContent = MessageContent.decode(
      aContentWithThirdPartyDataWithoutId,
    );

    pipe(
      decodedMessageContent,
      E.fold(
        () => expect(1).toBe(1),
        (_) => fail(),
      ),
    );
  });

  it("should fail decoding a MessageContent with Third Party data with empty id", () => {
    const aContentWithThirdPartyDataWithoutId = {
      ...aContentWithoutPaymentData,
      third_party_data: {
        id: "",
        original_sender: "Comune di Mêlée",
      },
    };

    const decodedMessageContent = MessageContent.decode(
      aContentWithThirdPartyDataWithoutId,
    );

    pipe(
      decodedMessageContent,
      E.fold(
        () => expect(1).toBe(1),
        (_) => fail(),
      ),
    );
  });

  it("should fail decoding a MessageContent with Third Party data without with empty summary", () => {
    const aContentWithThirdPartyDataWithoutSummary = {
      ...aContentWithThirdPartyData,
      third_party_data: {
        ...aContentWithThirdPartyData.third_party_data,
        summary: "",
      },
    };

    const decodedMessageContent = MessageContent.decode(
      aContentWithThirdPartyDataWithoutSummary,
    );

    pipe(
      decodedMessageContent,
      E.fold(
        () => expect(1).toBe(1),
        (_) => fail(),
      ),
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
        other_property: t.number,
      }),
    ]);
    type UnsupportedServiceMetadata = t.TypeOf<
      typeof UnsupportedServiceMetadata
    >;

    pipe(
      {
        category: "UNSUPPORTED",
        other_property: 1,
        scope: ServiceScopeEnum.LOCAL,
      } as UnsupportedServiceMetadata,
      ApiServiceMetadata.decode,
      E.mapLeft((_) => fail("Unexpected decoding error")),
      E.map((_) => {
        expect(ApiCommonServiceMetadata.is(_)).toBeTruthy();
        expect(_).not.toHaveProperty("category");
        expect(_).not.toHaveProperty("other_property");
      }),
    );

    pipe(
      {
        category: StandardServiceCategoryEnum.STANDARD,
        scope: ServiceScopeEnum.LOCAL,
      } as ApiStandardServiceMetadata,
      ApiServiceMetadata.decode,
      E.mapLeft((_) => fail("Unexpected decoding error")),
      E.map((_) => {
        expect(ApiStandardServiceMetadata.is(_)).toBeTruthy();
        expect(_).toHaveProperty(
          "category",
          StandardServiceCategoryEnum.STANDARD,
        );
      }),
    );
  });
});

describe("MessageStatus", () => {
  const aRightMessageStatus: MessageStatus = {
    status: MessageStatusValueEnum.PROCESSED,
    updated_at: new Date(),
    version: 0,
  };

  const aWrongMessageStatus = {
    ...aRightMessageStatus,
    status: "AAAA",
  };

  const aRightMessageStatusAttributes: MessageStatusAttributes = {
    is_archived: false,
    is_read: false,
  };

  const aDefaultMessageWriteWithAttributes: MessageStatusWithAttributes = {
    ...aRightMessageStatus,
    ...aRightMessageStatusAttributes,
  };

  it("should fail decoding an empty MessageStatus", () => {
    const result = MessageStatus.decode({});
    expect(E.isLeft(result)).toBeTruthy();
  });

  it("should fail decoding a wrong MessageStatus", () => {
    const result = MessageStatus.decode(aWrongMessageStatus);
    expect(E.isLeft(result)).toBeTruthy();
  });

  it("should succeed decoding a correct MessageStatus", () => {
    const result = MessageStatus.decode(aRightMessageStatus);
    expect(E.isRight(result)).toBeTruthy();
    pipe(
      result,
      E.fold(
        () => fail(),
        (value) => expect(value).toEqual(aRightMessageStatus),
      ),
    );
  });

  it("should succeed decoding MessageStatus with attributes", () => {
    const result = MessageStatus.decode({
      ...aRightMessageStatus,
      ...aRightMessageStatusAttributes,
    });
    expect(E.isRight(result)).toBeTruthy();
    pipe(
      result,
      E.fold(
        () => fail(),
        (value) => expect(value).toEqual(aRightMessageStatus),
      ),
    );
  });

  it("should succeed decoding MessageStatusWithAttributes from a MessageStatus with default", () => {
    const result = MessageStatusWithAttributes.decode({
      ...aRightMessageStatus,
    });
    expect(E.isRight(result)).toBeTruthy();
    pipe(
      result,
      E.fold(
        () => fail(),
        (value) => expect(value).toEqual(aDefaultMessageWriteWithAttributes),
      ),
    );
  });

  it("should succeed decoding a right MessageStatusWithAttributes", () => {
    const result = MessageStatusWithAttributes.decode({
      ...aRightMessageStatus,
      ...aRightMessageStatusAttributes,
    });
    expect(E.isRight(result)).toBeTruthy();
    pipe(
      result,
      E.fold(
        () => fail(),
        (value) => expect(value).toEqual(aDefaultMessageWriteWithAttributes),
      ),
    );
  });

  it("should fail decoding a wrong MessageStatusWithAttributes", () => {
    const result = MessageStatusWithAttributes.decode({
      ...aRightMessageStatus,
      is_read: "false",
    });
    expect(E.isLeft(result)).toBeTruthy();
  });
});

describe("MessageStatusChange", () => {
  const aRightReadChange = {
    change_type: ReadingChangeType.reading,
    is_read: true,
  };

  const aWrongReadChange = {
    change_type: ReadingChangeType.reading,
    is_read: false,
  };

  const anArchiveChange = {
    change_type: ArchinvingChangeType.archiving,
    is_archived: true,
  };

  const anUnarchiveChange = {
    change_type: ArchinvingChangeType.archiving,
    is_archived: false,
  };

  const aWrongChange = {
    change_type: ReadingChangeType.reading,
    is_archived: false,
  };

  const aRightBulkChange = {
    change_type: BulkChangeType.bulk,
    is_archived: true,
    is_read: true,
  };

  const aWrongBulkChange = {
    change_type: BulkChangeType.bulk,
    is_archived: true,
    is_read: false,
  };

  it("should fail decoding an empty change", () => {
    const result = MessageStatusChange.decode({});
    expect(E.isLeft(result)).toBeTruthy();
  });

  it("should fail decoding a wrong read change", () => {
    const result = MessageStatusChange.decode(aWrongReadChange);
    expect(E.isLeft(result)).toBeTruthy();
  });

  it("should fail decoding a wrong bulk change", () => {
    const result = MessageStatusChange.decode(aWrongBulkChange);
    expect(E.isLeft(result)).toBeTruthy();
  });

  it("should fail decoding a wrong change", () => {
    const result = MessageStatusChange.decode(aWrongChange);
    expect(E.isLeft(result)).toBeTruthy();
  });

  it("should succeed decoding a correct read change", () => {
    const result = MessageStatusChange.decode(aRightReadChange);
    expect(E.isRight(result)).toBeTruthy();
    pipe(
      result,
      E.fold(
        () => fail(),
        (value) => expect(value).toEqual(aRightReadChange),
      ),
    );
  });

  it("should succeed decoding an unarchive change", () => {
    const result = MessageStatusChange.decode(anUnarchiveChange);
    expect(E.isRight(result)).toBeTruthy();
    pipe(
      result,
      E.fold(
        () => fail(),
        (value) => expect(value).toEqual(anUnarchiveChange),
      ),
    );
  });

  it("should succeed decoding an archive change", () => {
    const result = MessageStatusChange.decode(anArchiveChange);
    expect(E.isRight(result)).toBeTruthy();
    pipe(
      result,
      E.fold(
        () => fail(),
        (value) => expect(value).toEqual(anArchiveChange),
      ),
    );
  });

  it("should succeed decoding a right bulk change", () => {
    const result = MessageStatusChange.decode(aRightBulkChange);
    expect(E.isRight(result)).toBeTruthy();
    pipe(
      result,
      E.fold(
        () => fail(),
        (value) => expect(value).toEqual(aRightBulkChange),
      ),
    );
  });
});

describe("ThirdPartyMessage", () => {
  it("should decode a ThirdPartyMessage with empty attachment list", async () => {
    const aThirdPartyMessage = {
      attachments: [],
    };

    const decoded = ThirdPartyMessage.decode(aThirdPartyMessage);

    pipe(
      decoded,
      E.map((d) => expect(d).toEqual(aThirdPartyMessage)),
      E.mapLeft((_) => fail()),
    );
  });

  it("should decode a ThirdPartyMessage without attachment list", async () => {
    const aThirdPartyMessage = {};

    const decoded = ThirdPartyMessage.decode(aThirdPartyMessage);

    pipe(
      decoded,
      E.map((d) => expect(d).toEqual(aThirdPartyMessage)),
      E.mapLeft((_) => fail()),
    );
  });

  it("should decode a ThirdPartyMessage with details", async () => {
    const aThirdPartyMessage = {
      attachments: [],
      details: {
        extra_data_1: {
          extra_data_1: 42,
          extra_data_2: "42",
        },
        extra_data_2: ["42", "43"],
      },
    };

    const decoded = ThirdPartyMessage.decode(aThirdPartyMessage);

    pipe(
      decoded,
      E.map((d) => expect(d).toEqual(aThirdPartyMessage)),
      E.mapLeft((_) => fail()),
    );
  });

  it("should decode a ThirdPartyMessage with attachments", async () => {
    const aThirdPartyMessage = {
      attachments: [
        { category: "DOCUMENT", id: "anId", url: "an/Url" },
        {
          category: "DOCUMENT",
          id: "anotherId",
          name: "anotherName",
          url: "another/Url",
        },
      ],
    };

    const decoded = ThirdPartyMessage.decode(aThirdPartyMessage);

    pipe(
      decoded,
      E.map((d) => expect(d).toEqual(aThirdPartyMessage)),
      E.mapLeft((_) => fail()),
    );
  });
});

describe("ThirdPartyData", () => {
  it("should decode a ThirdPartyData adding has_attachments and has_remote_content to false if not provided", () => {
    const aThirdPartyData = { id: aThirdPartyId };

    const decoded = ThirdPartyData.decode(aThirdPartyData);

    expect(decoded).toMatchObject(
      expect.objectContaining({
        _tag: "Right",
        right: {
          has_attachments: false,
          has_remote_content: false,
          id: aThirdPartyId,
        },
      }),
    );
  });

  it("should decode a ThirdPartyData with has_remote_content true if provided with true", () => {
    const aThirdPartyData = { has_remote_content: true, id: aThirdPartyId };

    const decoded = ThirdPartyData.decode(aThirdPartyData);

    expect(decoded).toMatchObject(
      expect.objectContaining({
        _tag: "Right",
        right: {
          has_attachments: false,
          has_remote_content: true,
          id: aThirdPartyId,
        },
      }),
    );
  });

  it("should decode a ThirdPartyData with the right configurationId if provided", () => {
    const aThirdPartyData = {
      configuration_id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      id: aThirdPartyId,
    };

    const decoded = ThirdPartyData.decode(aThirdPartyData);

    expect(decoded).toMatchObject(
      expect.objectContaining({
        _tag: "Right",
        right: {
          configuration_id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
          has_attachments: false,
          has_remote_content: false,
          id: aThirdPartyId,
        },
      }),
    );
  });

  it("should fail to decode a ThirdPartyData if a wrong ulid is provided as configuration_id", () => {
    const aThirdPartyData = {
      configuration_id: "notAnUlid",
      id: aThirdPartyId,
    };
    const decoded = ThirdPartyData.decode(aThirdPartyData);
    expect(E.isLeft(decoded)).toBeTruthy();
  });
});

/**
 * Semver type and AppVersion definition compatibility tests
 */

type IfEquals<T, U, Y = unknown, N = never> = (<G>() => G extends T
  ? 1
  : 2) extends <G>() => G extends U ? 1 : 2
  ? Y
  : N;
const exactType: <T, U>(
  draft: IfEquals<T, U> & T,
  expected: IfEquals<T, U> & U,
) => IfEquals<T, U> = (_, __) => _;
let semver: Semver;
let appVersion: AppVersion;

describe("Semver and AppVersion compatibility", () => {
  it("Should decode successfully a valid semver string", () => {
    const semver = "1.10.1" as Semver;
    const decoded = AppVersion.decode(semver);
    expect(E.isRight(decoded)).toBeTruthy();
  });
  it("Should fail the decode of a invalid semver string", () => {
    const semver = "1.10.01" as Semver;
    const decoded = AppVersion.decode(semver);
    expect(E.isLeft(decoded)).toBeTruthy();
  });
  it("Typescript type are compatible and interchangeable", () => {
    exactType(semver, appVersion);
    exactType(appVersion, semver);
  });
});
