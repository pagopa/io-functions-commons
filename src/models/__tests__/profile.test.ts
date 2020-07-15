import { isLeft, isRight } from "fp-ts/lib/Either";
import { isSome } from "fp-ts/lib/Option";

import { NonNegativeInteger } from "italia-ts-commons/lib/numbers";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { FiscalCode } from "../../../generated/definitions/FiscalCode";

import { ProfileModel, RetrievedProfile } from "../profile";

import {
  containerMock,
  mockContainerQueryFetchAll
} from "../../__mocks__/@azure/cosmos";

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;

const aStoredProfile = {
  acceptedTosVersion: 1,
  fiscalCode: aFiscalCode,
  id: "xyz-0",
  isEmailValidated: false,
  isInboxEnabled: false,
  isWebhookEnabled: false,
  version: 0
};

const aRetrievedProfile: RetrievedProfile = {
  acceptedTosVersion: 1,
  fiscalCode: aFiscalCode,
  id: "xyz-0" as NonEmptyString,
  isEmailValidated: false,
  isInboxEnabled: false,
  isWebhookEnabled: false,
  kind: "IRetrievedProfile",
  version: 0 as NonNegativeInteger
};

describe("findOneProfileByFiscalCode", () => {
  it("should resolve to an existing profile", async () => {
    mockContainerQueryFetchAll.mockImplementationOnce(async () => ({
      resources: [aStoredProfile]
    }));

    const model = new ProfileModel(containerMock);

    const result = await model.findLastVersionByModelId(aFiscalCode).run();

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual({
        ...aRetrievedProfile,
        isEmailEnabled: true,
        isTestProfile: false
      });
    }
  });

  it("should resolve to empty if no profile is found", async () => {
    mockContainerQueryFetchAll.mockImplementationOnce(async () => ({
      resources: []
    }));

    const model = new ProfileModel(containerMock);

    const result = await model.findLastVersionByModelId(aFiscalCode).run();

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isNone()).toBeTruthy();
    }
  });

  it("should validate the retrieved object agains the model type", async () => {
    mockContainerQueryFetchAll.mockImplementationOnce(async () => ({
      resources: [{}]
    }));

    const model = new ProfileModel(containerMock);

    const result = await model.findLastVersionByModelId(aFiscalCode).run();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toBe("COSMOS_DECODING_ERROR");
    }
  });
});

/*
describe("createProfile", () => {
  it("should create a new profile", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, newDocument, __, cb) => {
        cb(undefined, {
          ...newDocument,
          _self: "self",
          _ts: 123
        });
      })
    };

    const model = new ProfileModel(clientMock, profilesCollectionUrl);

    const newProfile: Profile = {
      fiscalCode: aFiscalCode
    };

    const result = await model.create(newProfile, newProfile.fiscalCode);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(clientMock.createDocument.mock.calls[0][2]).toHaveProperty(
      "partitionKey",
      aFiscalCode
    );
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.fiscalCode).toEqual(newProfile.fiscalCode);
      expect(result.value.id).toEqual(`${aFiscalCode}-${"0".repeat(16)}`);
      expect(result.value.version).toEqual(0);
      expect(result.value.isTestProfile).toEqual(false);
    }
  });

  it("should reject the promise in case of error", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, __, ___, cb) => {
        cb("error");
      })
    };

    const model = new ProfileModel(clientMock, profilesCollectionUrl);

    const newProfile: Profile = {
      fiscalCode: aFiscalCode
    };

    const result = await model.create(newProfile, newProfile.fiscalCode);

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("update", () => {
  it("should update an existing profile", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, newDocument, __, cb) => {
        cb(undefined, {
          ...newDocument,
          _self: "self",
          _ts: 123
        });
      }),
      readDocument: jest.fn((_, __, cb) => cb(undefined, aRetrievedProfile))
    };

    const model = new ProfileModel(clientMock, profilesCollectionUrl);

    const result = await model.update(
      aRetrievedProfile.fiscalCode,
      aRetrievedProfile.fiscalCode,
      p => {
        return {
          ...p,
          email: "new@example.com" as EmailString
        };
      }
    );

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(clientMock.createDocument.mock.calls[0][2]).toHaveProperty(
      "partitionKey",
      aFiscalCode
    );
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      if (isSome(result.value)) {
        const updatedProfile = result.value.value;
        expect(updatedProfile.fiscalCode).toEqual(aRetrievedProfile.fiscalCode);
        expect(updatedProfile.id).toEqual(`${aFiscalCode}-${"0".repeat(15)}1`);
        expect(updatedProfile.version).toEqual(1);
        expect(updatedProfile.email).toEqual("new@example.com");
      }
    }
  });

  it("should reject the promise in case of error (read)", async () => {
    const clientMock: any = {
      createDocument: jest.fn(),
      readDocument: jest.fn((_, __, cb) => cb("error"))
    };

    const model = new ProfileModel(clientMock, profilesCollectionUrl);

    const result = await model.update(aFiscalCode, aFiscalCode, o => o);

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument).not.toHaveBeenCalled();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });

  it("should reject the promise in case of error (create)", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error")),
      readDocument: jest.fn((_, __, cb) => cb(undefined, aRetrievedProfile))
    };

    const model = new ProfileModel(clientMock, profilesCollectionUrl);

    const result = await model.update(aFiscalCode, aFiscalCode, o => o);

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});
*/
