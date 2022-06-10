import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";

import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { FiscalCode } from "../../../generated/definitions/FiscalCode";

import {
  makeServicesPreferencesDocumentId,
  NewServicePreference,
  RetrievedServicePreference,
  AccessReadMessageStatusEnum,
  ServicePreference,
  ServicesPreferencesModel,
  SERVICE_PREFERENCES_COLLECTION_NAME
} from "../service_preference";

import { Container } from "@azure/cosmos";

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const aServiceId = "aServiceId" as NonEmptyString;

const aStoredServicePreference: ServicePreference = {
  fiscalCode: aFiscalCode,
  serviceId: aServiceId,
  accessReadMessageStatus: AccessReadMessageStatusEnum.ALLOW,
  isEmailEnabled: true,
  isInboxEnabled: true,
  settingsVersion: 0 as NonNegativeInteger,
  isWebhookEnabled: true
};

const aNewServicePreference: NewServicePreference = {
  id: makeServicesPreferencesDocumentId(
    aFiscalCode,
    aServiceId,
    0 as NonNegativeInteger
  ),
  fiscalCode: aFiscalCode,
  serviceId: aServiceId,
  accessReadMessageStatus: AccessReadMessageStatusEnum.ALLOW,
  isEmailEnabled: true,
  isInboxEnabled: true,
  settingsVersion: 0 as NonNegativeInteger,
  kind: "INewServicePreference",
  isWebhookEnabled: true
};

const aRetrievedServicePreference: RetrievedServicePreference = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  id: makeServicesPreferencesDocumentId(
    aFiscalCode,
    aServiceId,
    0 as NonNegativeInteger
  ),
  kind: "IRetrievedServicePreference",
  ...aStoredServicePreference
};

describe("ServicePreference::Codec", () => {
  it("retrocompatibility - should succeed decoding a disabled inbox ServicePreference with enabled preferences and DENY accessReadMessageStatus", async () => {
    const aWrongServicePreference = {
      ...aStoredServicePreference,
      isInboxEnabled: false,
      accessReadMessageStatus: AccessReadMessageStatusEnum.DENY,
      isEmailEnabled: true,
      isWebhookEnabled: true
    };

    const result = ServicePreference.decode(aWrongServicePreference);

    expect(E.isRight(result)).toBeTruthy();
  });

  it("should fail decoding a disabled inbox ServicePreference with enabled preferences and ALLOW accessReadMessageStatus", async () => {
    const aWrongServicePreference = {
      ...aStoredServicePreference,
      isInboxEnabled: false,
      accessReadMessageStatus: AccessReadMessageStatusEnum.ALLOW,
      isEmailEnabled: true,
      isWebhookEnabled: true
    };

    const result = ServicePreference.decode(aWrongServicePreference);

    expect(E.isLeft(result)).toBeTruthy();
  });

  it("should succeed decoding a correctly disabled ServicePreference", async () => {
    const aWrongServicePreference = {
      ...aStoredServicePreference,
      isInboxEnabled: false,
      accessReadMessageStatus: AccessReadMessageStatusEnum.DENY,
      isEmailEnabled: false,
      isWebhookEnabled: false
    };

    const result = ServicePreference.decode(aWrongServicePreference);

    expect(E.isRight(result)).toBeTruthy();
  });

  it("should succeed decoding a correctly enabled ServicePreference", async () => {
    const aWrongServicePreference = {
      ...aStoredServicePreference,
      isInboxEnabled: true,
      accessReadMessageStatus: AccessReadMessageStatusEnum.DENY,
      isEmailEnabled: true,
      isWebhookEnabled: false
    };

    const result = ServicePreference.decode(aWrongServicePreference);

    expect(E.isRight(result)).toBeTruthy();
  });
});

describe("find", () => {
  it("should resolve to an existing profile", async () => {
    const containerMock = ({
      item: jest.fn().mockImplementation((_, __) => ({
        read: jest.fn(() =>
          Promise.resolve({
            resource: aRetrievedServicePreference
          })
        )
      }))
    } as unknown) as Container;

    const model = new ServicesPreferencesModel(
      containerMock,
      SERVICE_PREFERENCES_COLLECTION_NAME
    );

    const result = await model.find([
      makeServicesPreferencesDocumentId(
        aFiscalCode,
        aServiceId,
        0 as NonNegativeInteger
      ),
      aFiscalCode
    ])();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBeTruthy();
      expect(O.toUndefined(result.right)).toEqual(aRetrievedServicePreference);
    }
  });

  it("should resolve to empty if no profile is found", async () => {
    const containerMock = ({
      item: jest.fn().mockImplementation((_, __) => ({
        read: jest.fn(() =>
          Promise.resolve({
            resource: undefined
          })
        )
      }))
    } as unknown) as Container;

    const model = new ServicesPreferencesModel(
      containerMock,
      SERVICE_PREFERENCES_COLLECTION_NAME
    );

    const result = await model.find([
      makeServicesPreferencesDocumentId(
        aFiscalCode,
        aServiceId,
        0 as NonNegativeInteger
      ),
      aFiscalCode
    ])();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isNone(result.right)).toBeTruthy();
    }
  });

  it("should validate the retrieved object agains the model type", async () => {
    const containerMock = ({
      item: jest.fn().mockImplementation((_, __) => ({
        read: jest.fn(() =>
          Promise.resolve({
            resource: {}
          })
        )
      }))
    } as unknown) as Container;

    const model = new ServicesPreferencesModel(
      containerMock,
      SERVICE_PREFERENCES_COLLECTION_NAME
    );

    const result = await model.find([
      makeServicesPreferencesDocumentId(
        aFiscalCode,
        aServiceId,
        0 as NonNegativeInteger
      ),
      aFiscalCode
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

    const containerMock = ({
      item: jest.fn().mockImplementation((_, __) => ({
        read: jest.fn(() =>
          Promise.resolve({
            resource: aRetrievedServicePreferenceWithoutSendReadMessageStatus
          })
        )
      }))
    } as unknown) as Container;

    const model = new ServicesPreferencesModel(
      containerMock,
      SERVICE_PREFERENCES_COLLECTION_NAME
    );

    const result = await model.find([
      makeServicesPreferencesDocumentId(
        aFiscalCode,
        aServiceId,
        0 as NonNegativeInteger
      ),
      aFiscalCode
    ])();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBeTruthy();
      expect(O.toUndefined(result.right)).toEqual({
        ...aRetrievedServicePreference,
        accessReadMessageStatus: AccessReadMessageStatusEnum.UNKNOWN
      });
    }
  });
});

describe("create ServicePreference", () => {
  it("should create a new document", async () => {
    const containerMock = ({
      items: {
        create: jest.fn((_, __) =>
          Promise.resolve({
            resource: aRetrievedServicePreference
          })
        )
      }
    } as unknown) as Container;
    const model = new ServicesPreferencesModel(
      containerMock,
      SERVICE_PREFERENCES_COLLECTION_NAME
    );

    const result = await model.create(aNewServicePreference)();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toEqual(aRetrievedServicePreference);
    }
  });
});
