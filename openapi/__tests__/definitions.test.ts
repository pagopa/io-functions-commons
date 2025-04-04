import { CreatedMessageWithContent } from "../../generated/definitions/v3/CreatedMessageWithContent";
import { ExternalCreatedMessageWithContent } from "../../generated/definitions/v3/ExternalCreatedMessageWithContent";

import * as E from "fp-ts/lib/Either";
import * as t from "io-ts";
import { HiddenServicePayload } from "../../generated/definitions/v3/HiddenServicePayload";
import { ServicePayload } from "../../generated/definitions/v3/ServicePayload";
import { VisibleServicePayload } from "../../generated/definitions/v3/VisibleServicePayload";

import { identity, pipe } from "fp-ts/lib/function";
import { FiscalCode } from "../../generated/definitions/v3/FiscalCode";
import { MessageContent } from "../../generated/definitions/v3/MessageContent";
import { NewMessage } from "../../generated/definitions/v3/NewMessage";
import { OrganizationFiscalCode } from "../../generated/definitions/v3/OrganizationFiscalCode";
import { Payee } from "../../generated/definitions/v3/Payee";
import { PaymentAmount } from "../../generated/definitions/v3/PaymentAmount";
import { PaymentData } from "../../generated/definitions/v3/PaymentData";
import { PaymentNoticeNumber } from "../../generated/definitions/v3/PaymentNoticeNumber";
import { StandardServiceCategoryEnum } from "../../generated/definitions/v3/StandardServiceCategory";

import { NonEmptyString, Semver } from "@pagopa/ts-commons/lib/strings";
import { CommonServiceMetadata as ApiCommonServiceMetadata } from "../../generated/definitions/v3/CommonServiceMetadata";
import { EnrichedMessage } from "../../generated/definitions/v3/EnrichedMessage";
import { FeatureLevelTypeEnum } from "../../generated/definitions/v3/FeatureLevelType";
import { MessageStatus } from "../../generated/definitions/v3/MessageStatus";
import { Change_typeEnum as ArchinvingChangeType } from "../../generated/definitions/v3/MessageStatusArchivingChange";
import { MessageStatusAttributes } from "../../generated/definitions/v3/MessageStatusAttributes";
import { Change_typeEnum as BulkChangeType } from "../../generated/definitions/v3/MessageStatusBulkChange";
import { MessageStatusChange } from "../../generated/definitions/v3/MessageStatusChange";
import { Change_typeEnum as ReadingChangeType } from "../../generated/definitions/v3/MessageStatusReadingChange";
import { MessageStatusWithAttributes } from "../../generated/definitions/v3/MessageStatusWithAttributes";
import { NotRejectedMessageStatusValueEnum as MessageStatusValueEnum } from "../../generated/definitions/v3/NotRejectedMessageStatusValue";
import { ServiceMetadata as ApiServiceMetadata } from "../../generated/definitions/v3/ServiceMetadata";
import { ServiceScopeEnum } from "../../generated/definitions/v3/ServiceScope";
import { SpecialServiceCategoryEnum } from "../../generated/definitions/v3/SpecialServiceCategory";
import { StandardServiceMetadata as ApiStandardServiceMetadata } from "../../generated/definitions/v3/StandardServiceMetadata";
import { ThirdPartyMessage } from "../../generated/definitions/v3/ThirdPartyMessage";

import { AppVersion } from "../../generated/definitions/v3/AppVersion";
import { HttpsUrl } from "../../generated/definitions/v3/HttpsUrl";
import { ThirdPartyData } from "../../generated/definitions/v3/ThirdPartyData";
import { UnlockCode } from "../../generated/definitions/v3/UnlockCode";
import { aService } from "../../__mocks__/mocks";

import { CreatedMessageWithContent as CreatedMessageWithContentV2 } from "../../generated/definitions/v2/CreatedMessageWithContent";
import { ExternalCreatedMessageWithContent as ExternalCreatedMessageWithContentV2 } from "../../generated/definitions/v2/ExternalCreatedMessageWithContent";
import { MessageContent as MessageContentV2 } from "../../generated/definitions/v2/MessageContent";
import { NewMessage as NewMessageV2 } from "../../generated/definitions/v2/NewMessage";
import { Payee as PayeeV2 } from "../../generated/definitions/v2/Payee";
import { PaymentData as PaymentDataV2 } from "../../generated/definitions/v2/PaymentData";
import { CommonServiceMetadata as ApiCommonServiceMetadataV2 } from "../../generated/definitions/v2/CommonServiceMetadata";
import { EnrichedMessage as EnrichedMessageV2 } from "../../generated/definitions/v2/EnrichedMessage";
import { MessageStatus as MessageStatusV2 } from "../../generated/definitions/v2/MessageStatus";
import { MessageStatusChange as MessageStatusChangeV2 } from "../../generated/definitions/v2/MessageStatusChange";
import { MessageStatusWithAttributes as MessageStatusWithAttributesV2 } from "../../generated/definitions/v2/MessageStatusWithAttributes";
import { StandardServiceMetadata as ApiStandardServiceMetadataV2 } from "../../generated/definitions/v2/StandardServiceMetadata";
import { ThirdPartyMessage as ThirdPartyMessageV2 } from "../../generated/definitions/v2/ThirdPartyMessage";
import { AppVersion as AppVersionV2 } from "../../generated/definitions/v2/AppVersion";
import { HttpsUrl as HttpsUrlV2 } from "../../generated/definitions/v2/HttpsUrl";
import { ThirdPartyData as ThirdPartyDataV2 } from "../../generated/definitions/v2/ThirdPartyData";
import { UnlockCode as UnlockCodeV2 } from "../../generated/definitions/v2/UnlockCode";

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
    privacy_url: "https://privateurl.it",
    scope: "LOCAL",
    support_url: "https://supporturl.it",
    token_name: "token",
    tos_url: "https://weburlk.it",
    web_url: "https://weburl.it"
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
      privacy_url: "https://privateurl.it",
      scope: "LOCAL",
      support_url: "https://supporturl.it",
      token_name: "token",
      tos_url: "https://weburlk.it",
      web_url: "https://weburl.it"
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
      ServicePayload.decode({
        ...visibleService,
        service_metadata: {
          ...visibleService.service_metadata,
          category: SpecialServiceCategoryEnum.SPECIAL
        }
      }),
      E.map(_ => {
        expect(_.service_metadata).not.toHaveProperty("category");
        return _;
      }),
      E.chain(_ =>
        ServicePayload.decode({
          ...hiddenServiceWithMetadata,
          service_metadata: {
            ...hiddenServiceWithMetadata.service_metadata,
            category: SpecialServiceCategoryEnum.SPECIAL
          }
        })
      ),
      E.map(_ => {
        expect(_.service_metadata).not.toHaveProperty("category");
        return _;
      }),
      E.fold(_ => fail("Unexpected decoding error"), identity)
    );
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

const aContentWithLegalData = {
  ...aContentWithoutPaymentData,
  legal_data: {
    sender_mail_from: "test@test.it",

    has_attachment: true,

    message_unique_id: "000001"
  }
};

const aContentWithThirdPartyData = {
  ...aContentWithoutPaymentData,
  third_party_data: {
    id: "aThirdPartyId",
    original_sender: "Comune di Mêlée"
  }
};

const aPayee: Payee = { fiscal_code: anOrganizationFiscalCode };

const aThirdPartyId = "aThirdPartyId" as NonEmptyString;

describe("EnrichedMessage", () => {
  const aValidEnrichedMessage: EnrichedMessage = {
    id: "A_MESSAGE_ID",
    fiscal_code: aFiscalCode,
    created_at: aDate,
    sender_service_id: aMessageWithoutContent.sender_service_id as NonEmptyString,
    service_name: "aService",
    organization_name: aService.organizationName,
    organization_fiscal_code: aService.organizationFiscalCode,
    message_title: "aTitle",
    is_read: false,
    is_archived: false
  };

  it("should correctly decode a valid EnrichedMessage", () => {
    expect(E.isRight(EnrichedMessage.decode(aValidEnrichedMessage))).toBe(true);
    expect(E.isRight(EnrichedMessageV2.decode(aValidEnrichedMessage))).toBe(
      true
    );
  });

  it("should fail decoding an EnrichedMessage without organization fiscal code", () => {
    expect(
      E.isLeft(
        EnrichedMessage.decode({
          ...aValidEnrichedMessage,
          organization_fiscal_code: undefined
        })
      )
    ).toBe(true);
    expect(
      E.isLeft(
        EnrichedMessageV2.decode({
          ...aValidEnrichedMessage,
          organization_fiscal_code: undefined
        })
      )
    ).toBe(true);
  });
});

describe("NewMessage definition", () => {
  it("should decode STANDARD NewMessage with content but without payment data", () => {
    const aMessageWithContentWithoutPaymentData = {
      ...aNewMessageWithoutContent,
      content: aContentWithoutPaymentData
    };

    expect(
      E.isRight(MessageContent.decode(aContentWithoutPaymentData))
    ).toBeTruthy();
    expect(
      E.isRight(MessageContentV2.decode(aContentWithoutPaymentData))
    ).toBeTruthy();

    const messageWithContent = NewMessage.decode(
      aMessageWithContentWithoutPaymentData
    );

    pipe(
      messageWithContent,
      E.fold(
        () => fail(),
        value =>
          expect(value).toEqual({
            ...aMessageWithContentWithoutPaymentData,
            time_to_live: 3600,
            feature_level_type: FeatureLevelTypeEnum.STANDARD
          })
      )
    );
    const messageWithContentV2 = NewMessageV2.decode(
      aMessageWithContentWithoutPaymentData
    );

    pipe(
      messageWithContentV2,
      E.fold(
        () => fail(),
        value =>
          expect(value).toEqual({
            ...aMessageWithContentWithoutPaymentData,
            time_to_live: 3600,
            feature_level_type: FeatureLevelTypeEnum.STANDARD
          })
      )
    );
  });

  it("should decode ADVANCED NewMessage with content but without payment data", () => {
    const aMessageWithContentWithoutPaymentData = {
      ...aNewMessageWithoutContent,
      feature_level_type: FeatureLevelTypeEnum.ADVANCED,
      content: aContentWithoutPaymentData
    };

    expect(
      E.isRight(MessageContent.decode(aContentWithoutPaymentData))
    ).toBeTruthy();
    expect(
      E.isRight(MessageContentV2.decode(aContentWithoutPaymentData))
    ).toBeTruthy();

    const messageWithContent = NewMessage.decode(
      aMessageWithContentWithoutPaymentData
    );

    pipe(
      messageWithContent,
      E.fold(
        () => fail(),
        value =>
          expect(value).toEqual({
            ...aMessageWithContentWithoutPaymentData,
            time_to_live: 3600,
            feature_level_type: FeatureLevelTypeEnum.ADVANCED
          })
      )
    );

    const messageWithContentV2 = NewMessageV2.decode(
      aMessageWithContentWithoutPaymentData
    );

    pipe(
      messageWithContentV2,
      E.fold(
        () => fail(),
        value =>
          expect(value).toEqual({
            ...aMessageWithContentWithoutPaymentData,
            time_to_live: 3600,
            feature_level_type: FeatureLevelTypeEnum.ADVANCED
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
        _ =>
          expect(_).toEqual({
            ...aMessageWithContentWithPaymentDataWithoutPayee,
            content: {
              ...aMessageWithContentWithPaymentDataWithoutPayee.content,
              payment_data: {
                ...aMessageWithContentWithPaymentDataWithoutPayee.content
                  .payment_data,
                invalid_after_due_date: false
              }
            },
            time_to_live: 3600,
            feature_level_type: FeatureLevelTypeEnum.STANDARD
          })
      )
    );
  });

  it("should decode PaymentData with payment data with payee", () => {
    const aPaymentDataWithPayee = {
      ...aPaymentDataWithoutPayee,
      payee: aPayee
    };

    const messageWithContent = PaymentData.decode(aPaymentDataWithPayee);
    pipe(
      messageWithContent,
      E.fold(
        () => fail(),
        value =>
          expect(value).toEqual({
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
      E.isRight(
        PaymentData.decode(
          aMessageWithContentWithPaymentDataWithPayee.content.payment_data
        )
      )
    ).toBeTruthy();

    const messageWithContent = NewMessage.decode(
      aMessageWithContentWithPaymentDataWithPayee
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
        payment_data: { ...aPaymentDataWithoutPayee, payee: aPayee }
      }
    };

    expect(
      E.isRight(
        Payee.decode(
          aMessageWithContentWithPaymentDataWithoutPayee.content.payment_data
            .payee
        )
      )
    ).toBeTruthy();

    const messageWithContent = CreatedMessageWithContent.decode(
      aMessageWithContentWithPaymentDataWithoutPayee
    );

    expect(E.isRight(messageWithContent)).toBeTruthy();
    expect(
      E.isRight(
        PayeeV2.decode(
          aMessageWithContentWithPaymentDataWithoutPayee.content.payment_data
            .payee
        )
      )
    ).toBeTruthy();

    const messageWithContentV2 = CreatedMessageWithContentV2.decode(
      aMessageWithContentWithPaymentDataWithoutPayee
    );

    expect(E.isRight(messageWithContentV2)).toBeTruthy();
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

    const messageWithContentV2 = CreatedMessageWithContentV2.decode(
      aMessageWithContentWithPaymentDataWithoutPayee
    );

    expect(E.isLeft(messageWithContentV2)).toBeTruthy();
  });

  it("should decode ADVANCED CreatedMessageWithContent with content and payment data with payee", () => {
    const aMessageWithContentWithPaymentDataWithPayee = {
      ...aMessageWithoutContent,
      feature_level_type: FeatureLevelTypeEnum.ADVANCED,
      content: {
        ...aContentWithoutPaymentData,
        payment_data: { ...aPaymentDataWithoutPayee, payee: aPayee }
      }
    };

    expect(
      E.isRight(
        Payee.decode(
          aMessageWithContentWithPaymentDataWithPayee.content.payment_data.payee
        )
      )
    ).toBeTruthy();

    const messageWithContent = CreatedMessageWithContent.decode(
      aMessageWithContentWithPaymentDataWithPayee
    );

    expect(E.isRight(messageWithContent)).toBeTruthy();

    expect(
      E.isRight(
        PayeeV2.decode(
          aMessageWithContentWithPaymentDataWithPayee.content.payment_data.payee
        )
      )
    ).toBeTruthy();

    const messageWithContentV2 = CreatedMessageWithContentV2.decode(
      aMessageWithContentWithPaymentDataWithPayee
    );

    expect(E.isRight(messageWithContentV2)).toBeTruthy();
  });
});

describe("ExternalCreatedMessageWithContent definition", () => {
  it("should decode STANDARD CreatedMessageWithContent with content and payment data with payee", () => {
    const aMessageWithContentWithPaymentDataWithoutPayee = {
      ...aMessageWithoutContent,
      content: {
        ...aContentWithoutPaymentData,
        payment_data: { ...aPaymentDataWithoutPayee, payee: aPayee }
      }
    };

    expect(
      E.isRight(
        Payee.decode(
          aMessageWithContentWithPaymentDataWithoutPayee.content.payment_data
            .payee
        )
      )
    ).toBeTruthy();

    const messageWithContent = ExternalCreatedMessageWithContent.decode(
      aMessageWithContentWithPaymentDataWithoutPayee
    );

    expect(E.isRight(messageWithContent)).toBeTruthy();

    expect(
      E.isRight(
        PayeeV2.decode(
          aMessageWithContentWithPaymentDataWithoutPayee.content.payment_data
            .payee
        )
      )
    ).toBeTruthy();

    const messageWithContentV2 = ExternalCreatedMessageWithContent.decode(
      aMessageWithContentWithPaymentDataWithoutPayee
    );

    expect(E.isRight(messageWithContentV2)).toBeTruthy();
  });

  it("should NOT decode ExternalCreatedMessageWithContent with content and payment data without payee", () => {
    const aMessageWithContentWithPaymentDataWithoutPayee = {
      ...aMessageWithoutContent,
      content: {
        ...aContentWithoutPaymentData,
        payment_data: { ...aPaymentDataWithoutPayee }
      }
    };

    const messageWithContent = ExternalCreatedMessageWithContent.decode(
      aMessageWithContentWithPaymentDataWithoutPayee
    );

    expect(E.isLeft(messageWithContent)).toBeTruthy();

    const messageWithContentV2 = ExternalCreatedMessageWithContentV2.decode(
      aMessageWithContentWithPaymentDataWithoutPayee
    );

    expect(E.isLeft(messageWithContentV2)).toBeTruthy();
  });

  it("should decode ADVANCED ExternalCreatedMessageWithContent with content and payment data with payee", () => {
    const aMessageWithContentWithPaymentDataWithPayee = {
      ...aMessageWithoutContent,
      feature_level_type: FeatureLevelTypeEnum.ADVANCED,
      content: {
        ...aContentWithoutPaymentData,
        payment_data: { ...aPaymentDataWithoutPayee, payee: aPayee }
      }
    };

    expect(
      E.isRight(
        Payee.decode(
          aMessageWithContentWithPaymentDataWithPayee.content.payment_data.payee
        )
      )
    ).toBeTruthy();

    const messageWithContent = ExternalCreatedMessageWithContent.decode(
      aMessageWithContentWithPaymentDataWithPayee
    );

    expect(E.isRight(messageWithContent)).toBeTruthy();

    pipe(
      messageWithContent,
      E.fold(
        () => fail(),
        value =>
          expect(value).toMatchObject(
            expect.objectContaining({
              feature_level_type: FeatureLevelTypeEnum.ADVANCED
            })
          )
      )
    );

    expect(
      E.isRight(
        PayeeV2.decode(
          aMessageWithContentWithPaymentDataWithPayee.content.payment_data.payee
        )
      )
    ).toBeTruthy();

    const messageWithContentV2 = ExternalCreatedMessageWithContentV2.decode(
      aMessageWithContentWithPaymentDataWithPayee
    );

    expect(E.isRight(messageWithContentV2)).toBeTruthy();

    pipe(
      messageWithContentV2,
      E.fold(
        () => fail(),
        value =>
          expect(value).toMatchObject(
            expect.objectContaining({
              feature_level_type: FeatureLevelTypeEnum.ADVANCED
            })
          )
      )
    );
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
        value => expect(value).toEqual(aContentWithoutPaymentData)
      )
    );

    const decodedMessageContentV2 = MessageContentV2.decode(
      aContentWithoutPaymentData
    );

    pipe(
      decodedMessageContentV2,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(aContentWithoutPaymentData)
      )
    );
  });

  it("should decode PaymentData without payee", () => {
    const decodedPaymentData = PaymentData.decode(aPaymentDataWithoutPayee);

    pipe(
      decodedPaymentData,
      E.fold(
        () => fail(),
        value =>
          expect(value).toEqual({
            ...aPaymentDataWithoutPayee,
            invalid_after_due_date: false
          })
      )
    );

    const decodedPaymentDataV2 = PaymentDataV2.decode(aPaymentDataWithoutPayee);

    pipe(
      decodedPaymentDataV2,
      E.fold(
        () => fail(),
        value =>
          expect(value).toEqual({
            ...aPaymentDataWithoutPayee,
            invalid_after_due_date: false
          })
      )
    );
  });

  it("should decode MessageContent with content with legal data", () => {
    const decodedMessageContent = MessageContent.decode(aContentWithLegalData);

    pipe(
      decodedMessageContent,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(aContentWithLegalData)
      )
    );

    const decodedMessageContentV2 = MessageContentV2.decode(
      aContentWithLegalData
    );

    pipe(
      decodedMessageContentV2,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(aContentWithLegalData)
      )
    );
  });

  it("should decode MessageContent with content with Third Party data", () => {
    const decodedMessageContent = MessageContent.decode(
      aContentWithThirdPartyData
    );

    pipe(
      decodedMessageContent,
      E.fold(
        () => fail(),
        value =>
          expect(value).toEqual({
            ...aContentWithThirdPartyData,
            third_party_data: {
              ...aContentWithThirdPartyData.third_party_data,
              has_attachments: false,
              has_remote_content: false
            }
          })
      )
    );

    const decodedMessageContentV2 = MessageContentV2.decode(
      aContentWithThirdPartyData
    );

    pipe(
      decodedMessageContentV2,
      E.fold(
        () => fail(),
        value =>
          expect(value).toEqual({
            ...aContentWithThirdPartyData,
            third_party_data: {
              ...aContentWithThirdPartyData.third_party_data,
              has_attachments: false,
              has_remote_content: false
            }
          })
      )
    );
  });

  it("should fail decoding a MessageContent with Third Party data without id", () => {
    const aContentWithThirdPartyDataWithoutId = {
      ...aContentWithoutPaymentData,
      third_party_data: {
        original_sender: "Comune di Mêlée"
      }
    };

    const decodedMessageContent = MessageContent.decode(
      aContentWithThirdPartyDataWithoutId
    );

    pipe(
      decodedMessageContent,
      E.fold(
        () => expect(1).toBe(1),
        _ => fail()
      )
    );

    const decodedMessageContentV2 = MessageContentV2.decode(
      aContentWithThirdPartyDataWithoutId
    );

    pipe(
      decodedMessageContentV2,
      E.fold(
        () => expect(1).toBe(1),
        _ => fail()
      )
    );
  });

  it("should fail decoding a MessageContent with Third Party data with empty id", () => {
    const aContentWithThirdPartyDataWithoutId = {
      ...aContentWithoutPaymentData,
      third_party_data: {
        id: "",
        original_sender: "Comune di Mêlée"
      }
    };

    const decodedMessageContent = MessageContent.decode(
      aContentWithThirdPartyDataWithoutId
    );

    pipe(
      decodedMessageContent,
      E.fold(
        () => expect(1).toBe(1),
        _ => fail()
      )
    );

    const decodedMessageContentV2 = MessageContentV2.decode(
      aContentWithThirdPartyDataWithoutId
    );

    pipe(
      decodedMessageContentV2,
      E.fold(
        () => expect(1).toBe(1),
        _ => fail()
      )
    );
  });

  it("should fail decoding a MessageContent with Third Party data without with empty summary", () => {
    const aContentWithThirdPartyDataWithoutSummary = {
      ...aContentWithThirdPartyData,
      third_party_data: {
        ...aContentWithThirdPartyData.third_party_data,
        summary: ""
      }
    };

    const decodedMessageContent = MessageContent.decode(
      aContentWithThirdPartyDataWithoutSummary
    );

    pipe(
      decodedMessageContent,
      E.fold(
        () => expect(1).toBe(1),
        _ => fail()
      )
    );

    const decodedMessageContentV2 = MessageContentV2.decode(
      aContentWithThirdPartyDataWithoutSummary
    );

    pipe(
      decodedMessageContentV2,
      E.fold(
        () => expect(1).toBe(1),
        _ => fail()
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
    type UnsupportedServiceMetadata = t.TypeOf<
      typeof UnsupportedServiceMetadata
    >;

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
        expect(ApiCommonServiceMetadataV2.is(_)).toBeTruthy();
        expect(_).not.toHaveProperty("category");
        expect(_).not.toHaveProperty("other_property");
      })
    );

    pipe(
      {
        scope: ServiceScopeEnum.LOCAL,
        category: StandardServiceCategoryEnum.STANDARD
      } as ApiStandardServiceMetadata,
      ApiServiceMetadata.decode,
      E.mapLeft(_ => fail("Unexpected decoding error")),
      E.map(_ => {
        expect(ApiStandardServiceMetadata.is(_)).toBeTruthy();
        expect(ApiStandardServiceMetadataV2.is(_)).toBeTruthy();
        expect(_).toHaveProperty(
          "category",
          StandardServiceCategoryEnum.STANDARD
        );
      })
    );
  });
});

describe("MessageStatus", () => {
  const aRightMessageStatus: MessageStatus = {
    status: MessageStatusValueEnum.PROCESSED,
    updated_at: new Date(),
    version: 0
  };

  const aWrongMessageStatus = {
    ...aRightMessageStatus,
    status: "AAAA"
  };

  const aRightMessageStatusAttributes: MessageStatusAttributes = {
    is_archived: false,
    is_read: false
  };

  const aDefaultMessageWriteWithAttributes: MessageStatusWithAttributes = {
    ...aRightMessageStatus,
    ...aRightMessageStatusAttributes
  };

  it("should fail decoding an empty MessageStatus", () => {
    const result = MessageStatus.decode({});
    expect(E.isLeft(result)).toBeTruthy();
    const resultV2 = MessageStatusV2.decode({});
    expect(E.isLeft(resultV2)).toBeTruthy();
  });

  it("should fail decoding a wrong MessageStatus", () => {
    const result = MessageStatus.decode(aWrongMessageStatus);
    expect(E.isLeft(result)).toBeTruthy();
    const resultV2 = MessageStatusV2.decode(aWrongMessageStatus);
    expect(E.isLeft(resultV2)).toBeTruthy();
  });

  it("should succeed decoding a correct MessageStatus", () => {
    const result = MessageStatus.decode(aRightMessageStatus);
    expect(E.isRight(result)).toBeTruthy();
    pipe(
      result,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(aRightMessageStatus)
      )
    );
    const resultV2 = MessageStatusV2.decode(aRightMessageStatus);
    expect(E.isRight(resultV2)).toBeTruthy();
    pipe(
      resultV2,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(aRightMessageStatus)
      )
    );
  });

  it("should succeed decoding MessageStatus with attributes", () => {
    const result = MessageStatus.decode({
      ...aRightMessageStatus,
      ...aRightMessageStatusAttributes
    });
    expect(E.isRight(result)).toBeTruthy();
    pipe(
      result,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(aRightMessageStatus)
      )
    );
    const resultV2 = MessageStatusV2.decode({
      ...aRightMessageStatus,
      ...aRightMessageStatusAttributes
    });
    expect(E.isRight(resultV2)).toBeTruthy();
    pipe(
      resultV2,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(aRightMessageStatus)
      )
    );
  });

  it("should succeed decoding MessageStatusWithAttributes from a MessageStatus with default", () => {
    const result = MessageStatusWithAttributes.decode({
      ...aRightMessageStatus
    });
    expect(E.isRight(result)).toBeTruthy();
    pipe(
      result,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(aDefaultMessageWriteWithAttributes)
      )
    );
    const resultV2 = MessageStatusWithAttributesV2.decode({
      ...aRightMessageStatus
    });
    expect(E.isRight(resultV2)).toBeTruthy();
    pipe(
      resultV2,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(aDefaultMessageWriteWithAttributes)
      )
    );
  });

  it("should succeed decoding a right MessageStatusWithAttributes", () => {
    const result = MessageStatusWithAttributes.decode({
      ...aRightMessageStatus,
      ...aRightMessageStatusAttributes
    });
    expect(E.isRight(result)).toBeTruthy();
    pipe(
      result,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(aDefaultMessageWriteWithAttributes)
      )
    );

    const resultV2 = MessageStatusWithAttributesV2.decode({
      ...aRightMessageStatus,
      ...aRightMessageStatusAttributes
    });
    expect(E.isRight(resultV2)).toBeTruthy();
    pipe(
      resultV2,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(aDefaultMessageWriteWithAttributes)
      )
    );
  });

  it("should fail decoding a wrong MessageStatusWithAttributes", () => {
    const result = MessageStatusWithAttributes.decode({
      ...aRightMessageStatus,
      is_read: "false"
    });
    expect(E.isLeft(result)).toBeTruthy();

    const resultV2 = MessageStatusWithAttributesV2.decode({
      ...aRightMessageStatus,
      is_read: "false"
    });
    expect(E.isLeft(resultV2)).toBeTruthy();
  });
});

describe("MessageStatusChange", () => {
  const aRightReadChange = {
    change_type: ReadingChangeType.reading,
    is_read: true
  };

  const aWrongReadChange = {
    change_type: ReadingChangeType.reading,
    is_read: false
  };

  const anArchiveChange = {
    change_type: ArchinvingChangeType.archiving,
    is_archived: true
  };

  const anUnarchiveChange = {
    change_type: ArchinvingChangeType.archiving,
    is_archived: false
  };

  const aWrongChange = {
    change_type: ReadingChangeType.reading,
    is_archived: false
  };

  const aRightBulkChange = {
    change_type: BulkChangeType.bulk,
    is_read: true,
    is_archived: true
  };

  const aWrongBulkChange = {
    change_type: BulkChangeType.bulk,
    is_read: false,
    is_archived: true
  };

  it("should fail decoding an empty change", () => {
    const result = MessageStatusChange.decode({});
    expect(E.isLeft(result)).toBeTruthy();
    const resultV2 = MessageStatusChangeV2.decode({});
    expect(E.isLeft(resultV2)).toBeTruthy();
  });

  it("should fail decoding a wrong read change", () => {
    const result = MessageStatusChange.decode(aWrongReadChange);
    expect(E.isLeft(result)).toBeTruthy();
    const resultV2 = MessageStatusChangeV2.decode(aWrongReadChange);
    expect(E.isLeft(resultV2)).toBeTruthy();
  });

  it("should fail decoding a wrong bulk change", () => {
    const result = MessageStatusChange.decode(aWrongBulkChange);
    expect(E.isLeft(result)).toBeTruthy();
    const resultV2 = MessageStatusChangeV2.decode(aWrongBulkChange);
    expect(E.isLeft(resultV2)).toBeTruthy();
  });

  it("should fail decoding a wrong change", () => {
    const result = MessageStatusChange.decode(aWrongChange);
    expect(E.isLeft(result)).toBeTruthy();
    const resultV2 = MessageStatusChangeV2.decode(aWrongChange);
    expect(E.isLeft(resultV2)).toBeTruthy();
  });

  it("should succeed decoding a correct read change", () => {
    const result = MessageStatusChange.decode(aRightReadChange);
    expect(E.isRight(result)).toBeTruthy();
    pipe(
      result,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(aRightReadChange)
      )
    );
    const resultV2 = MessageStatusChangeV2.decode(aRightReadChange);
    expect(E.isRight(resultV2)).toBeTruthy();
    pipe(
      resultV2,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(aRightReadChange)
      )
    );
  });

  it("should succeed decoding an unarchive change", () => {
    const result = MessageStatusChange.decode(anUnarchiveChange);
    expect(E.isRight(result)).toBeTruthy();
    pipe(
      result,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(anUnarchiveChange)
      )
    );
    const resultV2 = MessageStatusChangeV2.decode(anUnarchiveChange);
    expect(E.isRight(resultV2)).toBeTruthy();
    pipe(
      resultV2,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(anUnarchiveChange)
      )
    );
  });

  it("should succeed decoding an archive change", () => {
    const result = MessageStatusChange.decode(anArchiveChange);
    expect(E.isRight(result)).toBeTruthy();
    pipe(
      result,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(anArchiveChange)
      )
    );

    const resultV2 = MessageStatusChangeV2.decode(anArchiveChange);
    expect(E.isRight(resultV2)).toBeTruthy();
    pipe(
      resultV2,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(anArchiveChange)
      )
    );
  });

  it("should succeed decoding a right bulk change", () => {
    const result = MessageStatusChange.decode(aRightBulkChange);
    expect(E.isRight(result)).toBeTruthy();
    pipe(
      result,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(aRightBulkChange)
      )
    );
    const resultV2 = MessageStatusChangeV2.decode(aRightBulkChange);
    expect(E.isRight(resultV2)).toBeTruthy();
    pipe(
      resultV2,
      E.fold(
        () => fail(),
        value => expect(value).toEqual(aRightBulkChange)
      )
    );
  });
});

describe("ThirdPartyMessage", () => {
  it("should decode a ThirdPartyMessage with empty attachment list", async () => {
    const aThirdPartyMessage = {
      attachments: []
    };

    const decoded = ThirdPartyMessage.decode(aThirdPartyMessage);

    pipe(
      decoded,
      E.map(d => expect(d).toEqual(aThirdPartyMessage)),
      E.mapLeft(_ => fail())
    );

    const decodedV2 = ThirdPartyMessageV2.decode(aThirdPartyMessage);

    pipe(
      decodedV2,
      E.map(d => expect(d).toEqual(aThirdPartyMessage)),
      E.mapLeft(_ => fail())
    );
  });

  it("should decode a ThirdPartyMessage without attachment list", async () => {
    const aThirdPartyMessage = {};

    const decoded = ThirdPartyMessage.decode(aThirdPartyMessage);

    pipe(
      decoded,
      E.map(d => expect(d).toEqual(aThirdPartyMessage)),
      E.mapLeft(_ => fail())
    );

    const decodedV2 = ThirdPartyMessageV2.decode(aThirdPartyMessage);

    pipe(
      decodedV2,
      E.map(d => expect(d).toEqual(aThirdPartyMessage)),
      E.mapLeft(_ => fail())
    );
  });

  it("should decode a ThirdPartyMessage with details", async () => {
    const aThirdPartyMessage = {
      attachments: [],
      details: {
        extra_data_1: {
          extra_data_1: 42,
          extra_data_2: "42"
        },
        extra_data_2: ["42", "43"]
      }
    };

    const decoded = ThirdPartyMessage.decode(aThirdPartyMessage);

    pipe(
      decoded,
      E.map(d => expect(d).toEqual(aThirdPartyMessage)),
      E.mapLeft(_ => fail())
    );

    const decodedV2 = ThirdPartyMessageV2.decode(aThirdPartyMessage);

    pipe(
      decodedV2,
      E.map(d => expect(d).toEqual(aThirdPartyMessage)),
      E.mapLeft(_ => fail())
    );
  });

  it("should decode a ThirdPartyMessage with attachments", async () => {
    const aThirdPartyMessage = {
      attachments: [
        { id: "anId", url: "an/Url", category: "DOCUMENT" },
        {
          id: "anotherId",
          url: "another/Url",
          name: "anotherName",
          category: "DOCUMENT"
        }
      ]
    };

    const decoded = ThirdPartyMessage.decode(aThirdPartyMessage);

    pipe(
      decoded,
      E.map(d => expect(d).toEqual(aThirdPartyMessage)),
      E.mapLeft(_ => fail())
    );

    const decodedV2 = ThirdPartyMessageV2.decode(aThirdPartyMessage);

    pipe(
      decodedV2,
      E.map(d => expect(d).toEqual(aThirdPartyMessage)),
      E.mapLeft(_ => fail())
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
          id: aThirdPartyId,
          has_attachments: false,
          has_remote_content: false
        }
      })
    );

    const decodedV2 = ThirdPartyDataV2.decode(aThirdPartyData);

    expect(decodedV2).toMatchObject(
      expect.objectContaining({
        _tag: "Right",
        right: {
          id: aThirdPartyId,
          has_attachments: false,
          has_remote_content: false
        }
      })
    );
  });

  it("should decode a ThirdPartyData with has_remote_content true if provided with true", () => {
    const aThirdPartyData = { id: aThirdPartyId, has_remote_content: true };

    const decoded = ThirdPartyData.decode(aThirdPartyData);

    expect(decoded).toMatchObject(
      expect.objectContaining({
        _tag: "Right",
        right: {
          id: aThirdPartyId,
          has_attachments: false,
          has_remote_content: true
        }
      })
    );

    const decodedV2 = ThirdPartyDataV2.decode(aThirdPartyData);

    expect(decodedV2).toMatchObject(
      expect.objectContaining({
        _tag: "Right",
        right: {
          id: aThirdPartyId,
          has_attachments: false,
          has_remote_content: true
        }
      })
    );
  });

  it("should decode a ThirdPartyData with the right configurationId if provided", () => {
    const aThirdPartyData = {
      id: aThirdPartyId,
      configuration_id: "01ARZ3NDEKTSV4RRFFQ69G5FAV"
    };

    const decoded = ThirdPartyData.decode(aThirdPartyData);

    expect(decoded).toMatchObject(
      expect.objectContaining({
        _tag: "Right",
        right: {
          id: aThirdPartyId,
          has_attachments: false,
          has_remote_content: false,
          configuration_id: "01ARZ3NDEKTSV4RRFFQ69G5FAV"
        }
      })
    );

    const decodedV2 = ThirdPartyDataV2.decode(aThirdPartyData);

    expect(decodedV2).toMatchObject(
      expect.objectContaining({
        _tag: "Right",
        right: {
          id: aThirdPartyId,
          has_attachments: false,
          has_remote_content: false,
          configuration_id: "01ARZ3NDEKTSV4RRFFQ69G5FAV"
        }
      })
    );
  });

  it("should fail to decode a ThirdPartyData if a wrong ulid is provided as configuration_id", () => {
    const aThirdPartyData = {
      id: aThirdPartyId,
      configuration_id: "notAnUlid"
    };
    const decoded = ThirdPartyData.decode(aThirdPartyData);
    expect(E.isLeft(decoded)).toBeTruthy();

    const decodedV2 = ThirdPartyDataV2.decode(aThirdPartyData);
    expect(E.isLeft(decodedV2)).toBeTruthy();
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
  draft: T & IfEquals<T, U>,
  expected: U & IfEquals<T, U>
) => IfEquals<T, U> = (_, __) => _;
let semver: Semver;
let appVersion: AppVersion;
let appVersionV2: AppVersionV2;

describe("Semver and AppVersion compatibility", () => {
  it("Should decode successfully a valid semver string", () => {
    const semver = "1.10.1" as Semver;
    const decoded = AppVersion.decode(semver);
    expect(E.isRight(decoded)).toBeTruthy();

    const decodedV2 = AppVersionV2.decode(semver);
    expect(E.isRight(decodedV2)).toBeTruthy();
  });
  it("Should fail the decode of a invalid semver string", () => {
    const semver = "1.10.01" as Semver;
    const decoded = AppVersion.decode(semver);
    expect(E.isLeft(decoded)).toBeTruthy();

    const decodedV2 = AppVersionV2.decode(semver);
    expect(E.isLeft(decodedV2)).toBeTruthy();
  });
  it("Typescript type are compatible and interchangeable", () => {
    exactType(semver, appVersion);
    exactType(appVersion, semver);

    exactType(semver, appVersionV2);
    exactType(appVersionV2, semver);
  });
});

describe("HttpsUrl", () => {
  it("should decode successfully a valid https url string", () => {
    const httpsUrl = "https://sub.domain.com/path/method/file.ext";
    const decoded = HttpsUrl.decode(httpsUrl);
    expect(E.isRight(decoded)).toBeTruthy();
    const decodedV2 = HttpsUrlV2.decode(httpsUrl);
    expect(E.isRight(decodedV2)).toBeTruthy();
  });
  it.each([
    ["http://sub.domain.com/path/method/file.ext"],
    ["https://wrong/path"]
  ])("should fail the decode of a invalid https url string", url => {
    const decoded = HttpsUrl.decode(url);
    expect(E.isLeft(decoded)).toBeTruthy();
    const decodedV2 = HttpsUrlV2.decode(url);
    expect(E.isLeft(decodedV2)).toBeTruthy();
  });
});

describe("UnlockCode", () => {
  it("should decode successfully a valid unlock code string", () => {
    const unlockCode = "123456789";
    const decoded = UnlockCode.decode(unlockCode);
    expect(E.isRight(decoded)).toBeTruthy();
    const decodedV2 = UnlockCodeV2.decode(unlockCode);
    expect(E.isRight(decodedV2)).toBeTruthy();
  });
  it.each([["12345678"], ["1234567890"], ["12345678a"], [""]])(
    "should fail the decode of a invalid unlock code string",
    unlockCode => {
      const decoded = UnlockCode.decode(unlockCode);
      expect(E.isLeft(decoded)).toBeTruthy();
      const decodedV2 = UnlockCodeV2.decode(unlockCode);
      expect(E.isLeft(decodedV2)).toBeTruthy();
    }
  );
});
