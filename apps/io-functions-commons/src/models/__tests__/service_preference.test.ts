import { Container } from "@azure/cosmos";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";

import { FiscalCode } from "../../../generated/definitions/FiscalCode";
import {
  AccessReadMessageStatusEnum,
  makeServicesPreferencesDocumentId,
  NewServicePreference,
  RetrievedServicePreference,
  SERVICE_PREFERENCES_COLLECTION_NAME,
  ServicePreference,
  ServicesPreferencesModel,
} from "../service_preference";
import { vi } from "vitest";

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const aServiceId = "aServiceId" as NonEmptyString;

const aStoredServicePreference: ServicePreference = {
  accessReadMessageStatus: AccessReadMessageStatusEnum.ALLOW,
  fiscalCode: aFiscalCode,
  isEmailEnabled: true,
  isInboxEnabled: true,
  isWebhookEnabled: true,
  serviceId: aServiceId,
  settingsVersion: 0 as NonNegativeInteger,
};

const aNewServicePreference: NewServicePreference = {
  accessReadMessageStatus: AccessReadMessageStatusEnum.ALLOW,
  fiscalCode: aFiscalCode,
  id: makeServicesPreferencesDocumentId(
    aFiscalCode,
    aServiceId,
    0 as NonNegativeInteger,
  ),
  isEmailEnabled: true,
  isInboxEnabled: true,
  isWebhookEnabled: true,
  kind: "INewServicePreference",
  serviceId: aServiceId,
  settingsVersion: 0 as NonNegativeInteger,
};

const aRetrievedServicePreference: RetrievedServicePreference = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  id: makeServicesPreferencesDocumentId(
    aFiscalCode,
    aServiceId,
    0 as NonNegativeInteger,
  ),
  kind: "IRetrievedServicePreference",
  ...aStoredServicePreference,
};

describe("ServicePreference::Codec", () => {
  it("retrocompatibility - should succeed decoding a disabled inbox ServicePreference with enabled preferences and DENY accessReadMessageStatus", async () => {
    const aServicePreference = {
      ...aStoredServicePreference,
      accessReadMessageStatus: AccessReadMessageStatusEnum.DENY,
      isEmailEnabled: true,
      isInboxEnabled: false,
      isWebhookEnabled: true,
    };

    const result = ServicePreference.decode(aServicePreference);

    expect(E.isRight(result)).toBeTruthy();
  });

  it("should fail decoding a disabled inbox ServicePreference with enabled preferences and ALLOW accessReadMessageStatus", async () => {
    const aWrongServicePreference = {
      ...aStoredServicePreference,
      accessReadMessageStatus: AccessReadMessageStatusEnum.ALLOW,
      isEmailEnabled: true,
      isInboxEnabled: false,
      isWebhookEnabled: true,
    };

    const result = ServicePreference.decode(aWrongServicePreference);

    expect(E.isLeft(result)).toBeTruthy();
  });

  it("retrocompatibility - should succeed decoding a correctly disabled ServicePreference", async () => {
    const aServicePreference = {
      ...aStoredServicePreference,
      accessReadMessageStatus: AccessReadMessageStatusEnum.DENY,
      isEmailEnabled: false,
      isInboxEnabled: false,
      isWebhookEnabled: false,
    };

    const result = ServicePreference.decode(aServicePreference);

    expect(E.isRight(result)).toBeTruthy();
  });

  it("should succeed decoding a correctly enabled ServicePreference", async () => {
    const aServicePreference = {
      ...aStoredServicePreference,
      accessReadMessageStatus: AccessReadMessageStatusEnum.DENY,
      isEmailEnabled: true,
      isInboxEnabled: true,
      isWebhookEnabled: false,
    };

    const result = ServicePreference.decode(aServicePreference);

    expect(E.isRight(result)).toBeTruthy();
  });
});

describe("find", () => {
  it("should resolve to an existing profile", async () => {
    const containerMock = {
      item: vi.fn().mockImplementation((_, __) => ({
        read: vi.fn(() =>
          Promise.resolve({
            resource: aRetrievedServicePreference,
          }),
        ),
      })),
    } as unknown as Container;

    const model = new ServicesPreferencesModel(
      containerMock,
      SERVICE_PREFERENCES_COLLECTION_NAME,
    );

    const result = await model.find([
      makeServicesPreferencesDocumentId(
        aFiscalCode,
        aServiceId,
        0 as NonNegativeInteger,
      ),
      aFiscalCode,
    ])();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBeTruthy();
      expect(O.toUndefined(result.right)).toEqual(aRetrievedServicePreference);
    }
  });

  it("should resolve to empty if no profile is found", async () => {
    const containerMock = {
      item: vi.fn().mockImplementation((_, __) => ({
        read: vi.fn(() =>
          Promise.resolve({
            resource: undefined,
          }),
        ),
      })),
    } as unknown as Container;

    const model = new ServicesPreferencesModel(
      containerMock,
      SERVICE_PREFERENCES_COLLECTION_NAME,
    );

    const result = await model.find([
      makeServicesPreferencesDocumentId(
        aFiscalCode,
        aServiceId,
        0 as NonNegativeInteger,
      ),
      aFiscalCode,
    ])();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isNone(result.right)).toBeTruthy();
    }
  });

  it("should validate the retrieved object agains the model type", async () => {
    const containerMock = {
      item: vi.fn().mockImplementation((_, __) => ({
        read: vi.fn(() =>
          Promise.resolve({
            resource: {},
          }),
        ),
      })),
    } as unknown as Container;

    const model = new ServicesPreferencesModel(
      containerMock,
      SERVICE_PREFERENCES_COLLECTION_NAME,
    );

    const result = await model.find([
      makeServicesPreferencesDocumentId(
        aFiscalCode,
        aServiceId,
        0 as NonNegativeInteger,
      ),
      aFiscalCode,
    ])();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toBe("COSMOS_DECODING_ERROR");
    }
  });

  it("should successfully validate a retrieved object without sendReadMessageStatus property", async () => {
    const {
      accessReadMessageStatus,
      ...aRetrievedServicePreferenceWithoutSendReadMessageStatus
    } = aRetrievedServicePreference;

    const containerMock = {
      item: vi.fn().mockImplementation((_, __) => ({
        read: vi.fn(() =>
          Promise.resolve({
            resource: aRetrievedServicePreferenceWithoutSendReadMessageStatus,
          }),
        ),
      })),
    } as unknown as Container;

    const model = new ServicesPreferencesModel(
      containerMock,
      SERVICE_PREFERENCES_COLLECTION_NAME,
    );

    const result = await model.find([
      makeServicesPreferencesDocumentId(
        aFiscalCode,
        aServiceId,
        0 as NonNegativeInteger,
      ),
      aFiscalCode,
    ])();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBeTruthy();
      expect(O.toUndefined(result.right)).toEqual({
        ...aRetrievedServicePreference,
        accessReadMessageStatus: AccessReadMessageStatusEnum.UNKNOWN,
      });
    }
  });
});

describe("create ServicePreference", () => {
  it("should create a new document", async () => {
    const containerMock = {
      items: {
        create: vi.fn((_, __) =>
          Promise.resolve({
            resource: aRetrievedServicePreference,
          }),
        ),
      },
    } as unknown as Container;
    const model = new ServicesPreferencesModel(
      containerMock,
      SERVICE_PREFERENCES_COLLECTION_NAME,
    );

    const result = await model.create(aNewServicePreference)();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toEqual(aRetrievedServicePreference);
    }
  });
});
