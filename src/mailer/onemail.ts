/**
 * Implements a Nodemailer OneMail transport.
 *
 * Uses the OneMail Dispatcher REST API to send transactional emails through the
 * high-priority endpoint (POST /v1/emails/send/high) with direct HTML content:
 * see https://github.com/pagopa/onemail
 *
 * Note: the high-priority endpoint accepts a single recipient and does not
 * support attachments. Responses are asynchronous (202 Accepted): the API
 * returns a requestId that can later be used to check the delivery status.
 */
import { EmailString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { withoutUndefinedValues } from "@pagopa/ts-commons/lib/types";
import { isLeft, isRight } from "fp-ts/lib/Either";
import * as E from "fp-ts/lib/Either";
import {
  fromEither,
  fromPredicate,
  TaskEither,
  tryCatch
} from "fp-ts/lib/TaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import { fromNullable, Option } from "fp-ts/lib/Option";
import * as O from "fp-ts/lib/Option";
import { pipe } from "fp-ts/lib/function";
import * as t from "io-ts";
import nodeFetch from "node-fetch";

import * as nodemailer from "nodemailer";

// eslint-disable-next-line import/no-internal-modules
import { Address as NodemailerAddress } from "nodemailer/lib/addressparser";

import * as winston from "winston";

const TRANSPORT_NAME = "OneMail";
const TRANSPORT_VERSION = "0.1";

export const SEND_HIGH_PRIORITY_EMAIL_PATH = "/v1/emails/send/high";

/**
 * OneMail recipient/sender email address
 */
const OneMailAddress = t.intersection([
  t.interface({
    email: EmailString
  }),
  t.partial({
    name: NonEmptyString
  })
]);

type OneMailAddress = t.TypeOf<typeof OneMailAddress>;

/**
 * Custom email header expressed as a (name, value) tuple
 */
/* eslint-disable @typescript-eslint/naming-convention */
const NameValue = t.interface({
  N: NonEmptyString,
  V: t.string
});
/* eslint-enable @typescript-eslint/naming-convention */

type NameValue = t.TypeOf<typeof NameValue>;

/**
 * Direct content of the email (as opposed to template-based content)
 */
const OneMailEmailContent = t.intersection([
  t.interface({
    html: NonEmptyString,
    subject: NonEmptyString
  }),
  t.partial({
    text: NonEmptyString
  })
]);

type OneMailEmailContent = t.TypeOf<typeof OneMailEmailContent>;

/**
 * Request body for the high-priority send endpoint (emailContent variant)
 */
const OneMailHighPriorityPayload = t.intersection([
  t.interface({
    emailContent: OneMailEmailContent,
    from: OneMailAddress,
    to: OneMailAddress
  }),
  t.partial({
    extendedHeaders: t.array(NameValue),
    tag: t.array(NonEmptyString)
  })
]);

type OneMailHighPriorityPayload = t.TypeOf<typeof OneMailHighPriorityPayload>;

/**
 * Successful response of the send endpoints
 */
const OneMailSuccessResponse = t.interface({
  requestId: NonEmptyString
});

type OneMailSuccessResponse = t.TypeOf<typeof OneMailSuccessResponse>;

export interface IOneMailTransportOptions {
  readonly apiKey: NonEmptyString;
  readonly baseUrl: NonEmptyString;
  readonly dryRun?: boolean;
  readonly fetchAgent?: typeof fetch;
  readonly tenantName: NonEmptyString;
}

/* eslint-disable @typescript-eslint/naming-convention */
interface IAddresses {
  readonly bcc?: ReadonlyArray<NodemailerAddress>;
  readonly cc?: ReadonlyArray<NodemailerAddress>;
  readonly from?: ReadonlyArray<NodemailerAddress>;
  readonly sender?: ReadonlyArray<NodemailerAddress>;
  readonly "reply-to"?: ReadonlyArray<NodemailerAddress>;
  readonly to?: ReadonlyArray<NodemailerAddress>;
}
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Builds the full URL for the high-priority send endpoint, appending the
 * optional dryRun query parameter.
 */
const buildSendUrl = (options: IOneMailTransportOptions): string =>
  `${options.baseUrl}${SEND_HIGH_PRIORITY_EMAIL_PATH}${
    options.dryRun ? "?dryRun=true" : ""
  }`;

const sendTransactionalMail = (
  options: IOneMailTransportOptions,
  payload: OneMailHighPriorityPayload,
  fetchAgent: typeof fetch
): TaskEither<Error, OneMailSuccessResponse> =>
  pipe(
    tryCatch(
      () =>
        /* eslint-disable @typescript-eslint/naming-convention */
        fetchAgent(buildSendUrl(options), {
          body: JSON.stringify(payload),
          headers: {
            "Content-Type": "application/json",
            "x-api-key": options.apiKey,
            "x-tenant-name": options.tenantName
          },
          method: "POST"
        }),
      /* eslint-enable @typescript-eslint/naming-convention */
      (err) => new Error(`Error posting to OneMail: ${err}`)
    ),
    TE.chain(
      fromPredicate<Error, Response>(
        (r) => r.ok,
        (r) => new Error(`Error returned from OneMail API: ${r.status}`)
      )
    ),
    TE.chain((response) =>
      tryCatch(
        () => response.json(),
        (err) => new Error(`Error getting OneMail API payload: ${err}`)
      )
    ),
    TE.chain((json) =>
      fromEither(
        pipe(
          OneMailSuccessResponse.decode(json),
          E.mapLeft(
            (errors) =>
              new Error(
                `Error while decoding response from OneMail: ${readableReport(
                  errors
                )})`
              )
          )
        )
      )
    )
  );

/**
 * Translates a nodemailer parsed address ({ name: <name>, address: <address> })
 * to the format expected by the OneMail API ({ name: <name>, email: <address> }),
 * then get the first one from the input array.
 */
const toOneMailAddress = (
  addresses: ReadonlyArray<NodemailerAddress>
): Option<OneMailAddress> =>
  pipe(
    fromNullable(addresses[0]),
    O.map((address) =>
      withoutUndefinedValues({
        email: pipe(
          EmailString.decode(address.address),
          E.getOrElseW(() => {
            // this never happens as nodemailer has already parsed
            // the email address (so it's a valid one)
            throw new Error(
              `Error while parsing email address (toOneMailAddress): invalid format '${address.address}'.`
            );
          })
        ),
        name: NonEmptyString.is(address.name) ? address.name : undefined
      })
    )
  );

/**
 * Nodemailer transport for the OneMail Dispatcher high-priority APIs
 *
 * see https://github.com/pagopa/onemail
 * and https://nodemailer.com/plugins/create/#transports
 *
 * Usage:
 *
 * const transporter = nodemailer.createTransport(
 *   OneMailTransport({
 *     apiKey: <api-key>,
 *     tenantName: <tenant-name>,
 *     baseUrl: <server-url>,
 *     fetchAgent: customFetch
 *   })
 * );
 *
 * transporter
 *   .sendMail({
 *     from:      "foobar@example.com",
 *     to:        "deadbeef@example.com",
 *     subject:   "lorem ipsum",
 *     text:      "lorem ipsum",
 *     html:      "<b>lorem ipsum</b>"
 *   })
 *   .then(res => console.log(JSON.stringify(res)))
 *   .catch(err => console.error(JSON.stringify(err)));
 */
export const OneMailTransport = (
  options: IOneMailTransportOptions
): nodemailer.Transport => {
  const fetchAgent =
    options.fetchAgent !== undefined
      ? options.fetchAgent
      : (nodeFetch as unknown as typeof fetch);
  return {
    name: TRANSPORT_NAME,

    version: TRANSPORT_VERSION,

    // eslint-disable-next-line sort-keys
    send: (mail, callback): void => {
      // The high-priority endpoint does not support attachments.
      if (
        mail.data.attachments !== undefined &&
        mail.data.attachments.length > 0
      ) {
        return callback(
          new Error("OneMail transport does not support attachments"),
          undefined
        );
      }

      // We don't extract email addresses from mail.data.from / mail.data.to
      // as they are just strings that can contain invalid addresses.
      // Instead, mail.message.getAddresses() gets the email addresses
      // already validated by nodemailer (or undefined in case there are
      // no valid addresses for one specific field).
      // The following cast exists because of a bug in nodemailer typings
      // (MimeNode.Addresses are *not* just array of strings)
      const addresses: IAddresses = mail.message.getAddresses() as IAddresses;

      // The high-priority endpoint accepts a single recipient only.
      if (addresses.to !== undefined && addresses.to.length > 1) {
        return callback(
          new Error(
            "OneMail high-priority transport supports a single recipient only"
          ),
          undefined
        );
      }

      // Convert SMTP headers from the format used by nodemailer
      // to (N: <headerName>, V: <headerValue>) tuples used by the OneMail APIs
      const extendedHeaders = Object.keys(
        (mail.data.headers as {
          readonly [s: string]: string;
        }) ?? {}
      ).map((header) => ({
        N: header,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        V: (mail.data.headers as any)[header]
      }));

      const emailPayload = {
        emailContent: withoutUndefinedValues({
          html: mail.data.html,
          subject: mail.data.subject,
          text: mail.data.text
        }),
        extendedHeaders,
        from: pipe(
          fromNullable(addresses.from),
          O.chain(toOneMailAddress),
          O.toUndefined
        ),
        to: pipe(
          fromNullable(addresses.to),
          O.chain(toOneMailAddress),
          O.toUndefined
        )
      };

      const errorOrEmail = OneMailHighPriorityPayload.decode(emailPayload);

      if (isLeft(errorOrEmail)) {
        const errors = readableReport(errorOrEmail.left);
        winston.error("OneMailTransport|errors", errors);
        return callback(
          new Error(`Invalid email payload: ${errors}`),
          undefined
        );
      }

      const email = errorOrEmail.right;

      sendTransactionalMail(options, email, fetchAgent)()
        .then((errorOrResponse) => {
          if (isRight(errorOrResponse)) {
            return callback(null, {
              ...errorOrResponse.right,
              messageId: mail.data.messageId
            });
          } else {
            return callback(errorOrResponse.left, undefined);
          }
        })
        .catch((e) => callback(e, undefined));
    }
  };
};
