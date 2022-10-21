/* eslint-disable no-console */
import { EmailString } from "@pagopa/ts-commons/lib/strings";

import { fromEither, taskEither } from "fp-ts/lib/TaskEither";
import {
  Profile,
  PROFILE_MODEL_PK_FIELD,
  ProfileModel,
  PROFILE_SERVICE_PREFERENCES_SETTINGS_LEGACY_VERSION,
  NewProfile,
  RetrievedProfile
} from "../../src/models/profile";
import { createContext } from "./cosmos_utils";
import { fromOption } from "fp-ts/lib/Either";
import { identity, pipe } from "fp-ts/lib/function";
import { ServicesPreferencesModeEnum } from "../../generated/definitions/ServicesPreferencesMode";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import * as e from "fp-ts/lib/Either";
import * as te from "fp-ts/lib/TaskEither";

const aProfile: Profile = pipe(
  Profile.decode({
    acceptedTosVersion: 1,
    email: "email@example.com",
    fiscalCode: "AAAAAA00A00A000A",
    isEmailEnabled: true,
    isEmailValidated: true,
    isInboxEnabled: true,
    isWebhookEnabled: true
  }),
  e.getOrElseW(() => {
    throw new Error("Cannot decode profile payload.");
  })
);
describe("Models |> Profile", () => {
  it("should save documents with correct versioning", async () => {
    const context = createContext(PROFILE_MODEL_PK_FIELD);
    await context.init();
    const model = new ProfileModel(context.container);

    const newDoc = {
      kind: "INewProfile" as const,
      ...aProfile
    };

    // create a new document
    const created = await pipe(
      model.create(newDoc),
      te.bimap(
        _ => fail(`Failed to create doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aProfile,
              version: 0
            })
          );
          return result;
        }
      ),
      te.toUnion
    )();

    // update document
    const updates = { email: "emailUpdated@example.com" as EmailString };
    await pipe(
      model.update({ ...created, ...updates }),
      te.bimap(
        _ => fail(`Failed to update doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aProfile,
              ...updates,
              version: 1
            })
          );
        }
      ),
      te.toUnion
    )();

    // read latest version of the document
    await pipe(
      taskEither.of<any, void>(void 0),
      te.chainW(_ =>
        model.findLastVersionByModelId([newDoc[PROFILE_MODEL_PK_FIELD]])
      ),
      te.chain(_ => fromEither(fromOption(() => "It's none")(_))),
      te.bimap(
        _ => fail(`Failed to read doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aProfile,
              ...updates,
              version: 1
            })
          );
        }
      )
    )();

    // upsert new version
    const upserts = {
      email: "emailUpdatedAgain@example.com" as EmailString
    };
    const toUpsert = {
      kind: "INewProfile" as const,
      ...aProfile,
      ...upserts
    };
    await pipe(
      model.upsert(toUpsert),
      te.bimap(
        _ => fail(`Failed to upsert doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aProfile,
              ...upserts,
              version: 2
            })
          );
        }
      )
    )();

    context.dispose();
  });

  it("should consider service prefereces", async () => {
    const context = createContext(PROFILE_MODEL_PK_FIELD);
    await context.init();
    const model = new ProfileModel(context.container);

    const newDoc = {
      kind: "INewProfile" as const,
      ...aProfile
    };

    // create a new document
    const created = await pipe(
      model.create(newDoc),
      te.bimap(
        _ => fail(`Failed to create doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aProfile,
              // checks a default value for servicePreferencesSettings is provided
              servicePreferencesSettings: {
                mode: expect.any(String), // we don't bother the specific value, we just expect a value
                version: -1 // version -1 means default
              }
            })
          );
          return result;
        }
      ),
      te.toUnion
    )();

    // update document
    const updates = {
      servicePreferencesSettings: {
        mode: ServicesPreferencesModeEnum.AUTO as const,
        version: 0 as NonNegativeInteger
      }
    };
    await pipe(
      model.update({ ...created, ...updates }),
      te.bimap(
        _ => fail(`Failed to update doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aProfile,
              ...updates,
              servicePreferencesSettings: {
                mode: ServicesPreferencesModeEnum.AUTO,
                version: 0
              }
            })
          );
        }
      )
    )();

    // read latest version of the document
    await pipe(
      taskEither.of<any, void>(void 0),
      te.chainW(_ =>
        model.findLastVersionByModelId([newDoc[PROFILE_MODEL_PK_FIELD]])
      ),
      te.chain(_ => fromEither(fromOption(() => "It's none")(_))),
      te.bimap(
        _ => fail(`Failed to read doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aProfile,
              ...updates,
              servicePreferencesSettings: {
                mode: ServicesPreferencesModeEnum.AUTO,
                version: 0
              }
            })
          );
        }
      )
    )();

    context.dispose();
  });

  it("should increment service prefereces version", async () => {
    const context = createContext(PROFILE_MODEL_PK_FIELD);
    await context.init();
    const model = new ProfileModel(context.container);

    const newDoc = {
      kind: "INewProfile" as const,
      ...aProfile
    };

    // create a new document
    const created = await pipe(
      model.create(newDoc),
      te.bimap(
        _ => fail(`Failed to create doc, error: ${JSON.stringify(_)}`),
        identity
      ),
      te.toUnion
    )();

    // update document without changing mode
    const updated = await pipe(
      model.update({
        ...created,
        servicePreferencesSettings: created.servicePreferencesSettings
      }),
      te.bimap(
        _ => fail(`Failed to update doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aProfile,
              servicePreferencesSettings: {
                mode: created.servicePreferencesSettings.mode,
                version: created.servicePreferencesSettings.version
              }
            })
          );
          return result;
        }
      ),
      te.toUnion
    )();

    // update document changing mode
    const updated2 = await pipe(
      model.update({
        ...updated,
        servicePreferencesSettings: {
          mode: ServicesPreferencesModeEnum.AUTO,
          version: (created.servicePreferencesSettings.version +
            1) as NonNegativeInteger
        }
      }),
      te.bimap(
        _ => fail(`Failed to update doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aProfile,
              servicePreferencesSettings: {
                mode: ServicesPreferencesModeEnum.AUTO,
                version: created.servicePreferencesSettings.version + 1
              }
            })
          );
          return result;
        }
      ),
      te.toUnion
    )();

    // update document without changing mode, again
    await pipe(
      model.update({
        ...updated2,
        servicePreferencesSettings:
          // This example is just to show an uncomfortable scenario led by ServicePreferencesSettings type definition
          // This works => servicePreferencesSettings: updated2.servicePreferencesSettings
          //   because updated2.servicePreferencesSettings is recognized as a valid ServicePreferencesSettings already
          // This DOES NOT work => servicePreferencesSettings: { mode:  updated2.servicePreferencesSettings.mode,  version: updated2.servicePreferencesSettings.version }
          //   because TS fails to relate 'mode' and 'version' fields when handled separately.
          //   To solve it, the following dummy check will help TS by narrowing possibilities on `mode` field.
          updated2.servicePreferencesSettings.mode ===
          ServicesPreferencesModeEnum.LEGACY
            ? {
                mode: updated2.servicePreferencesSettings.mode,
                version: updated2.servicePreferencesSettings.version
              }
            : {
                mode: updated2.servicePreferencesSettings.mode,
                version: updated2.servicePreferencesSettings.version
              }
      }),
      te.bimap(
        _ => fail(`Failed to update doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aProfile,
              servicePreferencesSettings: {
                mode: updated2.servicePreferencesSettings.mode,
                version: updated2.servicePreferencesSettings.version
              }
            })
          );
          return result;
        }
      ),
      te.toUnion
    )();

    context.dispose();
  });

  it.each`
    mode                                  | version
    ${ServicesPreferencesModeEnum.LEGACY} | ${PROFILE_SERVICE_PREFERENCES_SETTINGS_LEGACY_VERSION + 1}
    ${ServicesPreferencesModeEnum.LEGACY} | ${PROFILE_SERVICE_PREFERENCES_SETTINGS_LEGACY_VERSION - 1}
    ${ServicesPreferencesModeEnum.AUTO}   | ${PROFILE_SERVICE_PREFERENCES_SETTINGS_LEGACY_VERSION}
    ${ServicesPreferencesModeEnum.MANUAL} | ${PROFILE_SERVICE_PREFERENCES_SETTINGS_LEGACY_VERSION}
    ${ServicesPreferencesModeEnum.MANUAL} | ${PROFILE_SERVICE_PREFERENCES_SETTINGS_LEGACY_VERSION - 1}
    ${"fantasy-mode"}                     | ${1 /* any value */}
  `(
    "should fail when passing inconsistent service preferences (mode: $mode, version: $version})",
    async ({ mode, version }) => {
      const context = createContext(PROFILE_MODEL_PK_FIELD);
      await context.init();
      const model = new ProfileModel(context.container);

      const withInconsistentValues = {
        kind: "INewProfile" as const,
        ...aProfile,
        servicePreferencesSettings: {
          mode,
          version
        }
      };

      await pipe(
        model.create(withInconsistentValues),
        te.bimap(
          _ => {
            expect(_.kind).toBe("COSMOS_DECODING_ERROR");
          },
          _ =>
            fail(
              `Should not have succeedeed with mode: ${mode} and version: ${version}`
            )
        )
      )();

      context.dispose();
    }
  );

  it.each`
    mode                                  | version
    ${ServicesPreferencesModeEnum.LEGACY} | ${PROFILE_SERVICE_PREFERENCES_SETTINGS_LEGACY_VERSION}
    ${ServicesPreferencesModeEnum.AUTO}   | ${PROFILE_SERVICE_PREFERENCES_SETTINGS_LEGACY_VERSION + 1 /* should be zero, but we do not know */}
    ${ServicesPreferencesModeEnum.AUTO}   | ${0 /* explicitly zero */}
    ${ServicesPreferencesModeEnum.AUTO}   | ${100 /* any positive number */}
    ${ServicesPreferencesModeEnum.MANUAL} | ${PROFILE_SERVICE_PREFERENCES_SETTINGS_LEGACY_VERSION + 1 /* should be zero, but we do not know */}
    ${ServicesPreferencesModeEnum.MANUAL} | ${0 /* explicitly zero */}
    ${ServicesPreferencesModeEnum.MANUAL} | ${100 /* any positive number */}
  `(
    "should save records when passing consistent service preferences (mode: $mode, version: $version})",
    async ({ mode, version }) => {
      const context = createContext(PROFILE_MODEL_PK_FIELD);
      await context.init();
      const model = new ProfileModel(context.container);

      const withInconsistentValues = {
        kind: "INewProfile" as const,
        ...aProfile,
        servicePreferencesSettings: {
          mode,
          version
        }
      };

      await pipe(
        model.create(withInconsistentValues),
        te.bimap(
          _ =>
            fail(
              `Should not have failed with mode: ${mode} and version: ${version}`
            ),
          _ => {
            expect(_.servicePreferencesSettings.mode).toBe(mode);
            expect(_.servicePreferencesSettings.version).toBe(version);
          }
        )
      )();

      context.dispose();
    }
  );

  it.each`
    inputValue    | expectedValue
    ${undefined}  | ${"UNKNOWN"}
    ${"UNKNOWN"}  | ${"UNKNOWN"}
    ${"1.10.1"}   | ${"1.10.1"}
    ${"1.11.2.1"} | ${"1.11.2.1"}
  `(
    "should save records when passing consistent lastAppVersion = $inputValue",
    async ({ inputValue, expectedValue }) => {
      const context = createContext(PROFILE_MODEL_PK_FIELD);
      await context.init();
      const model = new ProfileModel(context.container);

      const toBeSavedProfile: NewProfile = {
        kind: "INewProfile" as const,
        ...aProfile,
        lastAppVersion: inputValue
      };

      await pipe(
        model.create(toBeSavedProfile),
        te.bimap(
          _ =>
            fail(`Should not have failed with lastAppVersion = ${inputValue}`),
          _ => {
            expect(_.lastAppVersion).toBe(expectedValue);
          }
        )
      )();

      context.dispose();
    }
  );

  it.each`
    inputValue    | expectedValue
    ${undefined}  | ${"UNSET"}
    ${"ENABLED"}  | ${"ENABLED"}
    ${"DISABLED"} | ${"DISABLED"}
  `(
    "should save records when passing consistent reminderStatus = $inputValue",
    async ({ inputValue, expectedValue }) => {
      const context = createContext(PROFILE_MODEL_PK_FIELD);
      await context.init();
      const model = new ProfileModel(context.container);

      const toBeSavedProfile: NewProfile = {
        kind: "INewProfile" as const,
        ...aProfile,
        reminderStatus: inputValue
      };

      await pipe(
        model.create(toBeSavedProfile),
        te.bimap(
          _ =>
            fail(`Should not have failed with reminderStatus = ${inputValue}`),
          _ => {
            expect(_.reminderStatus).toBe(expectedValue);
          }
        )
      )();

      context.dispose();
    }
  );

  it.each`
    inputValue     | expectedValue
    ${undefined}   | ${"UNSET"}
    ${"UNSET"}     | ${"UNSET"}
    ${"FULL"}      | ${"FULL"}
    ${"ANONYMOUS"} | ${"ANONYMOUS"}
  `(
    "should save records when passing consistent pushNotificationsContentType= $inputValue",
    async ({ inputValue, expectedValue }) => {
      const context = createContext(PROFILE_MODEL_PK_FIELD);
      await context.init();
      const model = new ProfileModel(context.container);

      const toBeSavedProfile: NewProfile = {
        kind: "INewProfile" as const,
        ...aProfile,
        pushNotificationsContentType: inputValue
      };

      await pipe(
        model.create(toBeSavedProfile),
        te.bimap(
          _ =>
            fail(
              `Should not have failed with pushNotificationsContentType= ${inputValue}`
            ),
          (retrievedProfile: RetrievedProfile) => {
            expect(retrievedProfile.pushNotificationsContentType).toBe(
              expectedValue
            );
          }
        )
      )();

      context.dispose();
    }
  );
});
