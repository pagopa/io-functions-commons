import { catOptions } from "fp-ts/lib/Array";
import { none, some } from "fp-ts/lib/Option";
import * as t from "io-ts";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

/**
 * Describes a nodemailer transport connection
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const MailTransportConnection = t.interface({
  password: t.string,
  transport: NonEmptyString,
  username: t.string
});

export type MailTransportConnection = t.TypeOf<typeof MailTransportConnection>;

/**
 * An array of nodemailer transport connections
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const MailMultiTransportConnections = t.readonlyArray(
  MailTransportConnection
);

export type MailMultiTransportConnections = t.TypeOf<
  typeof MailMultiTransportConnections
>;

/**
 * Parses a multi email provider connection string.
 *
 * Multiple providers can be specified as following:
 *
 * transport:username:password[;transport:username:password][;transport:username:password]...
 *
 */
const parseMultiProviderConnection = (
  conn: string
): MailMultiTransportConnections =>
  catOptions(
    conn.split(";").map(providerStr => {
      const [transport, username, password] = providerStr.split(":");
      if (
        NonEmptyString.is(transport) &&
        username !== undefined && // allow empty username
        password !== undefined // allow empty password
      ) {
        return some({
          password,
          transport,
          username
        });
      }
      return none;
    })
  );

/**
 * Decodes an array of nodemailer transport connections from a multi
 * transport connection string.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const MailMultiTransportConnectionsFromString = new t.Type<
  MailMultiTransportConnections,
  string,
  unknown
>(
  "MailMultiTransportConnectionsFromString",
  MailMultiTransportConnections.is,
  (u, c) =>
    t.string.validate(u, c).chain(s => {
      const conns = parseMultiProviderConnection(s);
      return conns.length === 0 ? t.failure(u, c) : t.success(conns);
    }),
  () => "NOT_IMPLEMENTED"
);
