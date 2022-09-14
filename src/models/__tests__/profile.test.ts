import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";

import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { FiscalCode } from "../../../generated/definitions/FiscalCode";

import {
  Profile,
  ProfileModel,
  PROFILE_SERVICE_PREFERENCES_SETTINGS_LEGACY_VERSION,
  RetrievedProfile
} from "../profile";

import { Container } from "@azure/cosmos";
import { ServicesPreferencesModeEnum } from "../../../generated/definitions/ServicesPreferencesMode";
import { pipe } from "fp-ts/lib/function";

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;

const aRawProfile = {
  acceptedTosVersion: 1,
  fiscalCode: aFiscalCode,
  isEmailValidated: false,
  isInboxEnabled: false,
  isWebhookEnabled: false
};

const aStoredProfile: Profile = pipe(
  Profile.decode(aRawProfile),
  E.getOrElseW(_ =>
    fail(`Cannot decode aStoredProfile, error: ${readableReport(_)}`)
  )
);

const aRetrievedProfile: RetrievedProfile = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  id: (aFiscalCode as unknown) as NonEmptyString,
  kind: "IRetrievedProfile",
  version: 0 as NonNegativeInteger,
  ...aStoredProfile
};

const aRetrievedProfileWithEnabledReminder: RetrievedProfile = {
  ...aRetrievedProfile,
  isReminderEnabled: true
};

const aLastAppVersion = "1.0.0";

describe("findLastVersionByModelId", () => {
  it.each`
    case                                         | lastAppVersion     | expectedLastAppVersion | isReminderEnabled | expectedIsReminderEnabled
    ${"existing profile"}                        | ${undefined}       | ${"UNKNOWN"}           | ${undefined}      | ${false}
    ${"existing profile with last app version"}  | ${aLastAppVersion} | ${aLastAppVersion}     | ${undefined}      | ${false}
    ${"existing profile with reminder enabled"}  | ${undefined}       | ${"UNKNOWN"}           | ${true}           | ${true}
    ${"existing profile with reminder disabled"} | ${undefined}       | ${"UNKNOWN"}           | ${false}          | ${false}
    ${"existing profile with all props"}         | ${aLastAppVersion} | ${aLastAppVersion}     | ${true}           | ${true}
  `(
    "should resolve to an $case",
    async ({
      _,
      lastAppVersion,
      expectedLastAppVersion,
      isReminderEnabled,
      expectedIsReminderEnabled
    }) => {
      const containerMock = ({
        items: {
          create: jest.fn(),
          query: jest.fn(() => ({
            fetchAll: jest.fn(() =>
              Promise.resolve({
                resources: [
                  {
                    ...aRetrievedProfile,
                    lastAppVersion,
                    isReminderEnabled
                  }
                ]
              })
            )
          }))
        }
      } as unknown) as Container;

      const model = new ProfileModel(containerMock);

      const result = await model.findLastVersionByModelId([aFiscalCode])();

      expect(E.isRight(result)).toBeTruthy();
      if (E.isRight(result)) {
        expect(O.isSome(result.right)).toBeTruthy();
        expect(O.toUndefined(result.right)).toEqual({
          ...aRetrievedProfile,
          isEmailEnabled: true,
          isTestProfile: false,
          servicePreferencesSettings: {
            mode: ServicesPreferencesModeEnum.LEGACY,
            version: PROFILE_SERVICE_PREFERENCES_SETTINGS_LEGACY_VERSION
          },
          // we make sure that last optional properties added are with default values
          lastAppVersion: expectedLastAppVersion,
          isReminderEnabled: expectedIsReminderEnabled
        });
      }
    }
  );

  it("should resolve to empty if no profile is found", async () => {
    const containerMock = ({
      items: {
        create: jest.fn(),
        query: jest.fn(_ => ({
          fetchAll: jest.fn(() =>
            Promise.resolve({
              resources: undefined
            })
          )
        }))
      }
    } as unknown) as Container;

    const model = new ProfileModel(containerMock);

    const result = await model.findLastVersionByModelId([aFiscalCode])();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isNone(result.right)).toBeTruthy();
    }
  });

  it("should validate the retrieved object agains the model type", async () => {
    const containerMock = ({
      items: {
        create: jest.fn(),
        query: jest.fn(() => ({
          fetchAll: jest.fn(() =>
            Promise.resolve({
              resources: [{}]
            })
          )
        }))
      }
    } as unknown) as Container;

    const model = new ProfileModel(containerMock);

    const result = await model.findLastVersionByModelId([aFiscalCode])();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toBe("COSMOS_DECODING_ERROR");
    }
  });
});

describe("Profile codec", () => {
  it("should consider all possible ServicesPreferencesMode values", async () => {
    // This is a safe-guard to programmatically ensure all possible values of ServicesPreferencesModeEnum are considered

    for (const mode in ServicesPreferencesModeEnum) {
      const version =
        mode === "LEGACY"
          ? PROFILE_SERVICE_PREFERENCES_SETTINGS_LEGACY_VERSION
          : 0;
      pipe(
        Profile.decode({
          ...aRawProfile,
          servicePreferencesSettings: { mode, version }
        }),
        E.getOrElseW(_ =>
          fail(
            `Cannot decode profile, maybe an unhandled ServicesPreferencesMode: ${mode}, error: ${readableReport(
              _
            )}`
          )
        )
      );
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
