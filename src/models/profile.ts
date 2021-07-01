import * as t from "io-ts";

import { withDefault } from "@pagopa/ts-commons/lib/types";

import { Container } from "@azure/cosmos";
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
import { IsTestProfile } from "../../generated/definitions/IsTestProfile";
import { IsWebhookEnabled } from "../../generated/definitions/IsWebhookEnabled";
import { ServicesPreferencesModeEnum } from "../../generated/definitions/ServicesPreferencesMode";
import { PreferredLanguages } from "../../generated/definitions/PreferredLanguages";

import { wrapWithKind } from "../utils/types";

export const PROFILE_COLLECTION_NAME = "profiles";
export const PROFILE_MODEL_PK_FIELD = "fiscalCode" as const;

type ServicePreferencesSettings = t.TypeOf<typeof ServicePreferencesSettings>;
const ServicePreferencesSettings = t.union([
  t.interface({
    mode: t.literal(
      ServicesPreferencesModeEnum.AUTO,
      ServicesPreferencesModeEnum.MANUAL
    ),
    version: t.refinement(t.number, e => e > 0)
  }),
  // Legacy mode is valid only with version equals to 0
  // and is the default value retrieved from an existing profile
  t.interface({
    mode: t.literal(ServicesPreferencesModeEnum.LEGACY),
    version: t.literal(0)
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
      version: 0
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

    // if true this profile is only for test purpose
    isTestProfile: IsTestProfile,

    // whether to push notifications to the default webhook (defaults to false)
    isWebhookEnabled: IsWebhookEnabled,

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
