import * as t from "io-ts";

import { withDefault } from "@pagopa/ts-commons/lib/types";

import { Container } from "@azure/cosmos";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { Semver } from "@pagopa/ts-commons/lib/strings";
import {
  CosmosdbModelVersioned,
  RetrievedVersionedModel
} from "../utils/cosmosdb_model_versioned";

import { AcceptedTosVersion } from "../../generated/definitions/AcceptedTosVersion";
import { BlockedInboxOrChannels } from "../../generated/definitions/BlockedInboxOrChannels";
import { EmailAddress } from "../../generated/definitions/EmailAddress";
import { FiscalCode } from "../../generated/definitions/FiscalCode";
import { IsEmailEnabled } from "../../generated/definitions/IsEmailEnabled";
import { IsEmailValidated } from "../../generated/definitions/IsEmailValidated";
import { IsInboxEnabled } from "../../generated/definitions/IsInboxEnabled";
import { IsReminderEnabled } from "../../generated/definitions/IsReminderEnabled";
import { IsTestProfile } from "../../generated/definitions/IsTestProfile";
import { IsWebhookEnabled } from "../../generated/definitions/IsWebhookEnabled";
import { ServicesPreferencesModeEnum } from "../../generated/definitions/ServicesPreferencesMode";
import { PreferredLanguages } from "../../generated/definitions/PreferredLanguages";

import { wrapWithKind } from "../utils/types";

export const PROFILE_COLLECTION_NAME = "profiles";
export const PROFILE_MODEL_PK_FIELD = "fiscalCode" as const;

// The placeholder value to be assigned to servicePreferencesSettings.version when servicePreferencesSettings.mode=LEGACY
// As such value will never be used in LEGACY scenario and would not make much sense, it could be anything
// For convenience, is -1 as it could be incremented and become 0 (which is a valid NonNegativeInteger)
export const PROFILE_SERVICE_PREFERENCES_SETTINGS_LEGACY_VERSION = -1 as const;

/**
 * A value object that describes how the Citizen wants to handle service subscriptions.
 * This mechanism replaces what used to do by only using 'blockedInboxOrChannels' field,
 *   as the latter lacks some features to be fully GDPR-compliant.
 * For this reasaon, we mapped a LEGACY mode which refers to Citizens whose profile didn't switch to new mechanism yet.
 */
type ServicePreferencesSettings = t.TypeOf<typeof ServicePreferencesSettings>;
const ServicePreferencesSettings = t.union([
  t.interface({
    mode: t.union([
      // A Citizen is subscribed to every service, then they can cerry-picking specific services to unsubscribe from
      t.literal(ServicesPreferencesModeEnum.AUTO),
      // A Citizen is not subscribed to any service, then they can cerry-picking specific services to subscribe to
      t.literal(ServicesPreferencesModeEnum.MANUAL)
    ]),
    // Every time mode is changed, version should be incremented.
    // This is because specific service preferences, which are bound to a settings version, will be invalidated
    version: NonNegativeInteger
  }),
  // LEGACY mode is valid only with version equals to -1
  // and is the default value retrieved from an existing profile
  t.interface({
    mode: t.literal(ServicesPreferencesModeEnum.LEGACY),
    version: t.literal(PROFILE_SERVICE_PREFERENCES_SETTINGS_LEGACY_VERSION)
  })
]);

/**
 * Base interface for Profile objects
 */
export const Profile = t.intersection([
  t.interface({
    // the fiscal code of the citized associated to this profile
    fiscalCode: FiscalCode,

    // how the citizen prefers to handle subscriptions to Services
    // default value is needed to handle citizens that didn't make the choice yet
    servicePreferencesSettings: withDefault(ServicePreferencesSettings, {
      mode: ServicesPreferencesModeEnum.LEGACY,
      version: PROFILE_SERVICE_PREFERENCES_SETTINGS_LEGACY_VERSION
    })
  }),
  t.partial({
    // Notification channels blocked by the user;
    // Version of terms of services accepted by citizen
    acceptedTosVersion: AcceptedTosVersion,

    // each channel is related to a specific Service (sender)
    blockedInboxOrChannels: BlockedInboxOrChannels,

    // the preferred email for receiving email notifications
    // if defined, will override the default email provided by the API client
    // if defined, will enable email notifications for the citizen
    email: EmailAddress,

    // whether to send email notifications (defaults to true)
    // this field defaults to true to keep backward compatibility with users
    // that don't have this setting in their profile
    isEmailEnabled: withDefault(IsEmailEnabled, true),

    // if true the email has been validated by the user
    // this field defaults to true to keep backward compatibility with users
    // that don't have this setting in their profile
    isEmailValidated: withDefault(IsEmailValidated, true),

    // whether to store the content of messages sent to this citizen
    isInboxEnabled: IsInboxEnabled,

    // opt-in flag for reminder functionality (defaults to false)
    isReminderEnabled: IsReminderEnabled,

    // if true this profile is only for test purpose
    isTestProfile: IsTestProfile,

    // whether to push notifications to the default webhook (defaults to false)
    isWebhookEnabled: IsWebhookEnabled,

    // user app version
    lastAppVersion: withDefault(
      t.union([Semver, t.literal("UNKNOWN")]),
      "UNKNOWN"
    ),

    // array of user's preferred languages in ISO-3166-1-2 format
    // https://it.wikipedia.org/wiki/ISO_3166-2
    preferredLanguages: PreferredLanguages
  })
]);

export type Profile = t.TypeOf<typeof Profile>;

export const NewProfile = wrapWithKind(Profile, "INewProfile" as const);

export type NewProfile = t.TypeOf<typeof NewProfile>;

export const RetrievedProfile = wrapWithKind(
  t.intersection([Profile, RetrievedVersionedModel]),
  "IRetrievedProfile" as const
);

export type RetrievedProfile = t.TypeOf<typeof RetrievedProfile>;

/**
 * A model for handling Profiles
 */
export class ProfileModel extends CosmosdbModelVersioned<
  Profile,
  NewProfile,
  RetrievedProfile,
  typeof PROFILE_MODEL_PK_FIELD
> {
  /**
   * Creates a new Profile model
   *
   * @param dbClient the DocumentDB client
   * @param collectionUrl the collection URL
   */
  constructor(container: Container) {
    super(container, NewProfile, RetrievedProfile, "fiscalCode" as const);
  }
}
