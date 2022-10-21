import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";

import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { EmailString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { FiscalCode } from "../../../generated/definitions/FiscalCode";

import {
  NewProfile,
  Profile,
  ProfileModel,
  PROFILE_SERVICE_PREFERENCES_SETTINGS_LEGACY_VERSION,
  RetrievedProfile
} from "../profile";

import { Container } from "@azure/cosmos";
import { ServicesPreferencesModeEnum } from "../../../generated/definitions/ServicesPreferencesMode";
import { pipe } from "fp-ts/lib/function";

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;

const anEmail = "new@example.com" as EmailString;

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
  id: (`${aFiscalCode}-${"0".repeat(16)}` as unknown) as NonEmptyString,
  kind: "IRetrievedProfile",
  version: 0 as NonNegativeInteger,
  ...aStoredProfile
};

const aLastAppVersion = "1.0.0";

const newProfile: NewProfile = {
  kind: "INewProfile",
  ...aRawProfile,
  servicePreferencesSettings: {
    mode: ServicesPreferencesModeEnum.LEGACY,
    version: -1
  }
};

describe("findLastVersionByModelId", () => {
  it.each`
    case                                                           | lastAppVersion     | expectedLastAppVersion | reminderStatus | expectedReminderStatus
    ${"existing profile with no props"}                            | ${undefined}       | ${"UNKNOWN"}           | ${undefined}   | ${"UNSET"}
    ${"existing profile with no props and unset reminder"}         | ${undefined}       | ${"UNKNOWN"}           | ${"UNSET"}     | ${"UNSET"}
    ${"existing profile with reminder enabled"}                    | ${undefined}       | ${"UNKNOWN"}           | ${"ENABLED"}   | ${"ENABLED"}
    ${"existing profile with reminder disabled"}                   | ${undefined}       | ${"UNKNOWN"}           | ${"DISABLED"}  | ${"DISABLED"}
    ${"existing profile with last app version"}                    | ${aLastAppVersion} | ${aLastAppVersion}     | ${undefined}   | ${"UNSET"}
    ${"existing profile with last app version and unset reminder"} | ${aLastAppVersion} | ${aLastAppVersion}     | ${"UNSET"}     | ${"UNSET"}
    ${"existing profile with all props with reminder enabled"}     | ${aLastAppVersion} | ${aLastAppVersion}     | ${"ENABLED"}   | ${"ENABLED"}
    ${"existing profile with all props with reminder disabled"}    | ${aLastAppVersion} | ${aLastAppVersion}     | ${"DISABLED"}  | ${"DISABLED"}
  `(
    "should resolve to an $case",
    async ({
      _,
      lastAppVersion,
      expectedLastAppVersion,
      reminderStatus,
      expectedReminderStatus
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
                    reminderStatus
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
          reminderStatus: expectedReminderStatus
        });
      }
    }
  );

  it.each`
    case                                                              | pushNotificationsContentType | expectedPushNotificationsContentType
    ${"existing profile with pushNotificationsContentType empty"}     | ${undefined}                 | ${"UNSET"}
    ${"existing profile with pushNotificationsContentType UNSET"}     | ${"UNSET"}                   | ${"UNSET"}
    ${"existing profile with pushNotificationsContentType FULL"}      | ${"FULL"}                    | ${"FULL"}
    ${"existing profile with pushNotificationsContentType ANONYMOUS"} | ${"ANONYMOUS"}               | ${"ANONYMOUS"}
  `(
    "should resolve to an $case",
    async ({
      pushNotificationsContentType,
      expectedPushNotificationsContentType
    }) => {
      const containerMock = ({
        items: {
          query: jest.fn(() => ({
            fetchAll: jest.fn(() =>
              Promise.resolve({
                resources: [
                  {
                    ...aRetrievedProfile,
                    pushNotificationsContentType
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
          pushNotificationsContentType: expectedPushNotificationsContentType
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

describe("createProfile", () => {
  it("should create a new profile", async () => {
    const containerMock = ({
      items: {
        create: jest.fn().mockReturnValue(
          Promise.resolve({
            resource: aRetrievedProfile
          })
        )
      }
    } as unknown) as Container;

    const model = new ProfileModel(containerMock);

    const result = await model.create(newProfile)();

    expect(containerMock.items.create).toHaveBeenCalledTimes(1);
    expect(containerMock.items.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: newProfile.kind,
        fiscalCode: newProfile.fiscalCode,
        // id and version are generated before calling the create.
        // for a new profile:
        // id: <fiscalcode>-"0".repeat(16) for a new profile
        // version: 0
        id: aRetrievedProfile.id,
        version: 0
      }),
      expect.anything()
    );
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toStrictEqual(aRetrievedProfile);
    }
  });

  it("should fail with a left value in case of error", async () => {
    const containerMock = ({
      items: {
        create: jest.fn().mockReturnValue(Promise.reject())
      }
    } as unknown) as Container;

    const model = new ProfileModel(containerMock);

    const result = await model.create(newProfile)();

    expect(containerMock.items.create).toHaveBeenCalledTimes(1);

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("COSMOS_ERROR_RESPONSE");
    }
  });

  it("should get COSMOS_EMPTY_RESPONSE in case of empty resource", async () => {
    const containerMock = ({
      items: {
        create: jest.fn().mockReturnValue(
          // this scenario is unlikely to happen because the cosmos SDK should reject the promise
          // if something went wrong
          Promise.resolve({
            resource: undefined
          })
        )
      }
    } as unknown) as Container;

    const model = new ProfileModel(containerMock);

    const result = await model.create(newProfile)();

    expect(containerMock.items.create).toHaveBeenCalledTimes(1);

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("COSMOS_EMPTY_RESPONSE");
    }
  });

  it.each`
    case                                                              | pushNotificationsContentType | expectedPushNotificationsContentType
    ${"existing profile with pushNotificationsContentType empty"}     | ${undefined}                 | ${"UNSET"}
    ${"existing profile with pushNotificationsContentType UNSET"}     | ${"UNSET"}                   | ${"UNSET"}
    ${"existing profile with pushNotificationsContentType FULL"}      | ${"FULL"}                    | ${"FULL"}
    ${"existing profile with pushNotificationsContentType ANONYMOUS"} | ${"ANONYMOUS"}               | ${"ANONYMOUS"}
  `(
    "should create a profile with pushNotificationsContentType=$expectedPushNotificationsContentType when passing $pushNotificationsContentType",
    async ({
      pushNotificationsContentType,
      expectedPushNotificationsContentType
    }) => {
      const containerMock = ({
        items: {
          create: jest.fn().mockReturnValue(
            Promise.resolve({
              resource: {
                ...aRetrievedProfile,
                pushNotificationsContentType
              }
            })
          )
        }
      } as unknown) as Container;

      const model = new ProfileModel(containerMock);

      const newProfileWithNotificationsContentType: NewProfile = {
        ...newProfile,
        pushNotificationsContentType
      };
      const result = await model.create(
        newProfileWithNotificationsContentType
      )();

      expect(E.isRight(result)).toBeTruthy();
      if (E.isRight(result)) {
        expect(result.right).toEqual({
          ...aRetrievedProfile,
          pushNotificationsContentType: expectedPushNotificationsContentType
        });
      }
    }
  );
});

describe("updateProfile", () => {
  it("should update an existing profile", async () => {
    const containerMock = ({
      items: {
        create: jest.fn().mockReturnValue(
          Promise.resolve({
            resource: {
              ...aRetrievedProfile,
              id: `${aFiscalCode}-${"0".repeat(15)}1`,
              version: 1,
              email: anEmail
            }
          })
        )
      }
    } as unknown) as Container;

    const model = new ProfileModel(containerMock);

    const aProfileWithDifferentEmail = {
      ...aRetrievedProfile,
      email: anEmail
    };

    const aRetrievedUpdatedProfile = {
      ...aRetrievedProfile,
      email: anEmail,
      id: `${aFiscalCode}-${"0".repeat(15)}1`,
      version: 1
    };

    const result = await model.update(aProfileWithDifferentEmail)();

    expect(containerMock.items.create).toHaveBeenCalledTimes(1);
    expect(containerMock.items.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "INewProfile",
        fiscalCode: aProfileWithDifferentEmail.fiscalCode,
        email: aProfileWithDifferentEmail.email,
        version: aRetrievedUpdatedProfile.version,
        id: aRetrievedUpdatedProfile.id
      }),
      expect.anything()
    );

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toStrictEqual(aRetrievedUpdatedProfile);
    }
  });

  it("should get COSMOS_ERROR_RESPONSE in case of create error", async () => {
    const containerMock = ({
      items: {
        create: jest.fn().mockReturnValue(Promise.reject())
      }
    } as unknown) as Container;

    const model = new ProfileModel(containerMock);

    const result = await model.update(aRetrievedProfile)();

    expect(containerMock.items.create).toHaveBeenCalledTimes(1);

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("COSMOS_ERROR_RESPONSE");
    }
  });

  it("should get COSMOS_EMPTY_RESPONSE in case of empty resource", async () => {
    const containerMock = ({
      items: {
        create: jest
          .fn()
          .mockReturnValue(Promise.resolve({ resource: undefined }))
      }
    } as unknown) as Container;

    const model = new ProfileModel(containerMock);

    const result = await model.update(aRetrievedProfile)();

    expect(containerMock.items.create).toHaveBeenCalledTimes(1);

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("COSMOS_EMPTY_RESPONSE");
    }
  });

  it.each`
    case                                                              | pushNotificationsContentType | expectedPushNotificationsContentType
    ${"existing profile with pushNotificationsContentType empty"}     | ${undefined}                 | ${"UNSET"}
    ${"existing profile with pushNotificationsContentType UNSET"}     | ${"UNSET"}                   | ${"UNSET"}
    ${"existing profile with pushNotificationsContentType FULL"}      | ${"FULL"}                    | ${"FULL"}
    ${"existing profile with pushNotificationsContentType ANONYMOUS"} | ${"ANONYMOUS"}               | ${"ANONYMOUS"}
  `(
    "should update a profile and return the decoded pushNotificationsContentType",
    async ({
      pushNotificationsContentType,
      expectedPushNotificationsContentType
    }) => {
      const containerMock = ({
        items: {
          create: jest.fn().mockReturnValue(
            Promise.resolve({
              resource: {
                ...aRetrievedProfile,
                pushNotificationsContentType,
                version: 1
              }
            })
          )
        }
      } as unknown) as Container;

      const model = new ProfileModel(containerMock);

      const result = await model.update({
        ...aRetrievedProfile,
        pushNotificationsContentType
      })();

      expect(E.isRight(result)).toBeTruthy();
      if (E.isRight(result)) {
        expect(result.right).toEqual({
          ...aRetrievedProfile,
          pushNotificationsContentType: expectedPushNotificationsContentType,
          version: 1
        });
      }
    }
  );
});

describe("upsertProfile", () => {
  it.each`
    case                                                              | pushNotificationsContentType | expectedPushNotificationsContentType
    ${"existing profile with pushNotificationsContentType empty"}     | ${undefined}                 | ${"UNSET"}
    ${"existing profile with pushNotificationsContentType UNSET"}     | ${"UNSET"}                   | ${"UNSET"}
    ${"existing profile with pushNotificationsContentType FULL"}      | ${"FULL"}                    | ${"FULL"}
    ${"existing profile with pushNotificationsContentType ANONYMOUS"} | ${"ANONYMOUS"}               | ${"ANONYMOUS"}
  `(
    "should upsert a profile and return the decoded pushNotificationsContentType",
    async ({
      pushNotificationsContentType,
      expectedPushNotificationsContentType
    }) => {
      const containerMock = ({
        items: {
          create: jest.fn().mockReturnValue(
            Promise.resolve({
              resource: {
                ...aRetrievedProfile,
                pushNotificationsContentType,
                version: 1
              }
            })
          ),
          query: jest.fn().mockReturnValue({
            fetchAll: jest.fn().mockReturnValue(
              Promise.resolve({
                resources: [
                  {
                    ...aRetrievedProfile,
                    pushNotificationsContentType
                  }
                ]
              })
            )
          })
        }
      } as unknown) as Container;

      const model = new ProfileModel(containerMock);

      const newProfileWithNotificationsContentType: NewProfile = {
        ...newProfile,
        pushNotificationsContentType
      };
      const result = await model.upsert(
        newProfileWithNotificationsContentType
      )();

      expect(E.isRight(result)).toBeTruthy();
      if (E.isRight(result)) {
        expect(result.right).toEqual({
          ...aRetrievedProfile,
          pushNotificationsContentType: expectedPushNotificationsContentType,
          version: 1
        });
      }
    }
  );
});
