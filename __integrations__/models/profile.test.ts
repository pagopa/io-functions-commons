/* eslint-disable no-console */
import { EmailString } from "@pagopa/ts-commons/lib/strings";

import { fromEither, taskEither } from "fp-ts/lib/TaskEither";
import {
  Profile,
  PROFILE_MODEL_PK_FIELD,
  ProfileModel,
  PROFILE_SERVICE_PREFERENCES_SETTINGS_LEGACY_VERSION
} from "../../src/models/profile";
import { createContext } from "./cosmos_utils";
import { fromOption } from "fp-ts/lib/Either";
import { identity, toString } from "fp-ts/lib/function";
import { ServicesPreferencesModeEnum } from "../../generated/definitions/ServicesPreferencesMode";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";

const aProfile: Profile = Profile.decode({
  acceptedTosVersion: 1,
  email: "email@example.com",
  fiscalCode: "AAAAAA00A00A000A",
  isEmailEnabled: true,
  isEmailValidated: true,
  isInboxEnabled: true,
  isWebhookEnabled: true
}).getOrElseL(() => {
  throw new Error("Cannot decode profile payload.");
});
describe("Models |> Profile", () => {
  it("should save documents with correct versioning", async () => {
    const context = await createContext(PROFILE_MODEL_PK_FIELD);
    await context.init();
    const model = new ProfileModel(context.container);

    const newDoc = {
      kind: "INewProfile" as const,
      ...aProfile
    };

    // create a new document
    const created = await model
      .create(newDoc)
      .fold(
        _ => fail(`Failed to create doc, error: ${toString(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aProfile,
              version: 0
            })
          );
          return result;
        }
      )
      .run();

    // update document
    const updates = { email: "emailUpdated@example.com" as EmailString };
    await model
      .update({ ...created, ...updates })
      .fold(
        _ => fail(`Failed to update doc, error: ${toString(_)}`),
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
      .run();

    // read latest version of the document
    await taskEither
      .of<any, void>(void 0)
      .chain(_ =>
        model.findLastVersionByModelId([newDoc[PROFILE_MODEL_PK_FIELD]])
      )
      .chain(_ => fromEither(fromOption("It's none")(_)))
      .fold(
        _ => fail(`Failed to read doc, error: ${toString(_)}`),
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
      .run();

    // upsert new version
    const upserts = {
      email: "emailUpdatedAgain@example.com" as EmailString
    };
    const toUpsert = {
      kind: "INewProfile" as const,
      ...aProfile,
      ...upserts
    };
    await model
      .upsert(toUpsert)
      .fold(
        _ => fail(`Failed to upsert doc, error: ${toString(_)}`),
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
      .run();

    context.dispose();
  });

  it("should consider service prefereces", async () => {
    const context = await createContext(PROFILE_MODEL_PK_FIELD);
    await context.init();
    const model = new ProfileModel(context.container);

    const newDoc = {
      kind: "INewProfile" as const,
      ...aProfile
    };

    // create a new document
    const created = await model
      .create(newDoc)
      .fold(
        _ => fail(`Failed to create doc, error: ${toString(_)}`),
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
      )
      .run();

    // update document
    const updates = {
      servicePreferencesSettings: {
        mode: ServicesPreferencesModeEnum.AUTO as const,
        version: 0 as NonNegativeInteger
      }
    };
    await model
      .update({ ...created, ...updates })
      .fold(
        _ => fail(`Failed to update doc, error: ${toString(_)}`),
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
      .run();

    // read latest version of the document
    await taskEither
      .of<any, void>(void 0)
      .chain(_ =>
        model.findLastVersionByModelId([newDoc[PROFILE_MODEL_PK_FIELD]])
      )
      .chain(_ => fromEither(fromOption("It's none")(_)))
      .fold(
        _ => fail(`Failed to read doc, error: ${toString(_)}`),
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
      .run();

    context.dispose();
  });

  it("should increment service prefereces version", async () => {
    const context = await createContext(PROFILE_MODEL_PK_FIELD);
    await context.init();
    const model = new ProfileModel(context.container);

    const newDoc = {
      kind: "INewProfile" as const,
      ...aProfile
    };

    // create a new document
    const created = await model
      .create(newDoc)
      .fold(_ => fail(`Failed to create doc, error: ${toString(_)}`), identity)
      .run();

    // update document without changing mode
    const updated = await model
      .update({
        ...created,
        servicePreferencesSettings: created.servicePreferencesSettings
      })
      .fold(
        _ => fail(`Failed to update doc, error: ${toString(_)}`),
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
      )
      .run();

    // update document changing mode
    const updated2 = await model
      .update({
        ...updated,
        servicePreferencesSettings: {
          mode: ServicesPreferencesModeEnum.AUTO,
          version: (created.servicePreferencesSettings.version +
            1) as NonNegativeInteger
        }
      })
      .fold(
        _ => fail(`Failed to update doc, error: ${toString(_)}`),
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
      )
      .run();

    // update document without changing mode, again
    await model
      .update({
        ...created,
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
      })
      .fold(
        _ => fail(`Failed to update doc, error: ${toString(_)}`),
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
      )
      .run();

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
      const context = await createContext(PROFILE_MODEL_PK_FIELD);
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

      await model
        .create(withInconsistentValues)
        .fold(
          _ => {
            expect(_.kind).toBe("COSMOS_DECODING_ERROR");
          },
          _ =>
            fail(
              `Should not have succeedeed with mode: ${mode} and version: ${version}`
            )
        )
        .run();

      context.dispose();
    }
  );
});
