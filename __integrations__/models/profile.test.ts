/* eslint-disable no-console */
import { EmailString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { fromEither, taskEither } from "fp-ts/lib/TaskEither";
import {
  Profile,
  PROFILE_MODEL_PK_FIELD,
  ProfileModel
} from "../../src/models/profile";
import { createContext } from "./cosmos_utils";
import { fromOption } from "fp-ts/lib/Either";
import { toString } from "fp-ts/lib/function";
import { ServicesPreferencesModeEnum } from "../../generated/definitions/ServicesPreferencesMode";

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
                version: 0 // version 0 means default
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
        version: 1
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
                version: 1
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
                version: 1
              }
            })
          );
        }
      )
      .run();

    context.dispose();
  });

  it.each`
    mode                                  | version
    ${ServicesPreferencesModeEnum.LEGACY} | ${1}
    ${ServicesPreferencesModeEnum.AUTO}   | ${0}
    ${ServicesPreferencesModeEnum.MANUAL} | ${0}
    ${ServicesPreferencesModeEnum.MANUAL} | ${-1}
    ${ServicesPreferencesModeEnum.LEGACY} | ${-1}
    ${"fantasy-mode"}                     | ${1}
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
