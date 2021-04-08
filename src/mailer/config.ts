import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";
import { MailMultiTransportConnectionsFromString } from "./multi_transport_connection";

// exclude a specific value from a type
// as strict equality is performed, allowed input types are constrained to be values not references (object, arrays, etc)
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/naming-convention
export const AnyBut = <A extends string | number | boolean | symbol, O = A>(
  but: A,
  base: t.Type<A, O> = t.any
) =>
  t.brand(
    base,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    (s): s is t.Branded<t.TypeOf<typeof base>, { readonly AnyBut: symbol }> =>
      s !== but,
    "AnyBut"
  );

// Using sendgrid
// we allow mailup values as well, as sendgrid would be selected first if present
// see here for the rationale: https://github.com/pagopa/io-functions-admin/pull/89#commitcomment-42917672
/* eslint-disable @typescript-eslint/naming-convention */
export const SendgridMailerConfig = t.intersection([
  t.interface({
    MAILHOG_HOSTNAME: t.undefined,
    MAIL_TRANSPORTS: t.undefined,
    NODE_ENV: t.literal("production"),
    SENDGRID_API_KEY: NonEmptyString
  }),
  t.partial({
    MAILUP_SECRET: NonEmptyString,
    MAILUP_USERNAME: NonEmptyString
  })
]);
/* eslint-enable @typescript-eslint/naming-convention */

// using mailup
/* eslint-disable @typescript-eslint/naming-convention */
export const MailupMailerConfig = t.interface({
  MAILHOG_HOSTNAME: t.undefined,
  MAILUP_SECRET: NonEmptyString,
  MAILUP_USERNAME: NonEmptyString,
  MAIL_TRANSPORTS: t.undefined,
  NODE_ENV: t.literal("production"),
  SENDGRID_API_KEY: t.undefined
});
/* eslint-enable @typescript-eslint/naming-convention */

// Using multi-transport definition
// Optional multi provider connection string
// The connection string must be in the format:
//   [mailup:username:password;][sendgrid:apikey:;]
// Note that multiple instances of the same provider can be provided.
/* eslint-disable @typescript-eslint/naming-convention */
export const MultiTrasnsportMailerConfig = t.interface({
  MAILHOG_HOSTNAME: t.undefined,
  MAILUP_SECRET: t.undefined,
  MAILUP_USERNAME: t.undefined,
  MAIL_TRANSPORTS: MailMultiTransportConnectionsFromString,
  NODE_ENV: t.literal("production"),
  SENDGRID_API_KEY: t.undefined
});
/* eslint-enable @typescript-eslint/naming-convention */

// the following states that a mailhog configuration is optional and can be provided only if not in prod
/* eslint-disable @typescript-eslint/naming-convention */
export const MailhogMailerConfig = t.interface({
  MAILHOG_HOSTNAME: NonEmptyString,
  MAILUP_SECRET: t.undefined,
  MAILUP_USERNAME: t.undefined,
  MAIL_TRANSPORTS: t.undefined,
  NODE_ENV: AnyBut("production", t.string),
  SENDGRID_API_KEY: t.undefined
});
/* eslint-enable @typescript-eslint/naming-convention */

// configuration to send email
export type MailerConfig = t.TypeOf<typeof MailerConfig>;
// eslint-disable-next-line @typescript-eslint/naming-convention
export const MailerConfig = t.intersection([
  // common required fields
  t.interface({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    MAIL_FROM: NonEmptyString
  }),
  // the following union includes the possible configuration variants for different mail transports we use in prod
  // undefined values are kept for easy usage
  t.union([
    SendgridMailerConfig,
    MailupMailerConfig,
    MultiTrasnsportMailerConfig,
    MailhogMailerConfig
  ])
]);
