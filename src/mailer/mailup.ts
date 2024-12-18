/**
 * Implements a Nodemailer MailUp transport.
 *
 * Uses the MailUp REST API to send transactional emails:
 * see http://help.mailup.com/display/mailupapi/Transactional+Emails+using+APIs
 *
 */
import { EmailString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { isLeft, isRight } from "fp-ts/lib/Either";
import * as E from "fp-ts/lib/Either";
import {
  fromEither,
  fromPredicate,
  TaskEither,
  tryCatch
} from "fp-ts/lib/TaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import nodeFetch from "node-fetch";

import * as nodemailer from "nodemailer";

// eslint-disable-next-line import/no-internal-modules
import { Address as NodemailerAddress } from "nodemailer/lib/addressparser";

import * as winston from "winston";

import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { fromNullable, Option } from "fp-ts/lib/Option";
import * as O from "fp-ts/lib/Option";
import { pipe } from "fp-ts/lib/function";

export const SEND_TRANSACTIONAL_MAIL_ENDPOINT =
  "https://send.mailup.com/API/v2.0/messages/sendmessage";

const TRANSPORT_NAME = "MailUp";
const TRANSPORT_VERSION = "0.1";

/**
 * You need to create a SMTP+ user in MailUp administration panel
 * see also http://help.mailup.com/display/MUG/SMTP+Settings
 */
/* eslint-disable @typescript-eslint/naming-convention */
export const SmtpAuthInfo = t.interface({
  Secret: NonEmptyString,
  Username: NonEmptyString
});
/* eslint-enable @typescript-eslint/naming-convention */

export type SmtpAuthInfo = t.TypeOf<typeof SmtpAuthInfo>;

/**
 * MailUp API calls common response fields
 */
/* eslint-disable @typescript-eslint/naming-convention */
const ApiResponse = t.interface({
  Code: t.string,
  Message: t.string,
  Status: t.string
});
/* eslint-enable @typescript-eslint/naming-convention */

type ApiResponse = t.TypeOf<typeof ApiResponse>;

/* eslint-disable @typescript-eslint/naming-convention */
const Address = t.interface({
  Email: EmailString,
  Name: t.string
});
/* eslint-enable @typescript-eslint/naming-convention */

type Address = t.TypeOf<typeof Address>;

/* eslint-disable @typescript-eslint/naming-convention */
const NameValue = t.interface({
  N: NonEmptyString,
  V: t.string
});
/* eslint-enable @typescript-eslint/naming-convention */

type NameValue = t.TypeOf<typeof NameValue>;

const Html = t.interface({
  Body: NonEmptyString
});

type Html = t.TypeOf<typeof NameValue>;

/* eslint-disable @typescript-eslint/naming-convention */
const Attachment = t.interface({
  Body: t.array(t.number),
  ContentId: t.string,
  Filename: t.string
});
type Attachment = t.TypeOf<typeof Attachment>;
/* eslint-enable @typescript-eslint/naming-convention */

/* eslint-disable @typescript-eslint/naming-convention */
const EmailPayload = t.intersection([
  t.interface({
    ExtendedHeaders: t.array(NameValue),
    From: Address,
    Html,
    Subject: NonEmptyString,
    Text: NonEmptyString,
    To: t.array(Address)
  }),
  t.partial({
    Attachments: t.array(Attachment),
    Bcc: t.array(Address),
    Cc: t.array(Address),
    ReplyTo: t.string
  })
]);
/* eslint-enable @typescript-eslint/naming-convention */

type EmailPayload = t.TypeOf<typeof EmailPayload>;

export interface IMailUpTransportOptions {
  readonly creds: SmtpAuthInfo;
  readonly fetchAgent?: typeof fetch;
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

/* eslint-disable @typescript-eslint/naming-convention */
const sendTransactionalMail = (
  creds: SmtpAuthInfo,
  payload: EmailPayload,
  fetchAgent: typeof fetch
): TaskEither<Error, ApiResponse> =>
  pipe(
    tryCatch(
      () =>
        fetchAgent(SEND_TRANSACTIONAL_MAIL_ENDPOINT, {
          body: JSON.stringify({ ...payload, User: creds }),
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST"
        }),
      err => new Error(`Error posting to MailUp: ${err}`)
    ),
    TE.chain(
      fromPredicate<Error, Response>(
        r => r.ok,
        r => new Error(`Error returned from MailUp API: ${r.status}`)
      )
    ),
    TE.chain(response =>
      tryCatch(
        () => response.json(),
        err => new Error(`Error getting MailUp API payload: ${err}`)
      )
    ),
    TE.chain(json =>
      fromEither(
        pipe(
          ApiResponse.decode(json),
          E.mapLeft(
            errors =>
              new Error(
                `Error while decoding response from MailUp: ${readableReport(
                  errors
                )})`
              )
          )
        )
      )
    ),
    TE.chain(
      fromPredicate(
        ar => ar.Code === "0",
        ar =>
          new Error(
            `Error sending email using MailUp: ${ar.Code}:${ar.Message}`
          )
      )
    )
  );
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Translates nodemailer parsed addresses ({ name: <name>, address: <address> })
 * to the format expected by the MailUp API ({ Name: <name>, Email: <address> })
 */
const toMailupAddresses = (
  addresses: ReadonlyArray<NodemailerAddress>
): ReadonlyArray<Address> =>
  addresses.map((address: NodemailerAddress) => ({
    Email: pipe(
      EmailString.decode(address.address),
      E.getOrElseW(() => {
        // this never happens as nodemailer has already parsed
        // the email address (so it's a valid one)
        throw new Error(
          `Error while parsing email address (toMailupAddresses): invalid format '${address.address}'.`
        );
      })
    ),
    Name: address.name || address.address
  }));

/**
 * Translates nodemailer parsed addresses ({ name: <name>, address: <address> })
 * to the format expected by the MailUp API ({ Name: <name>, Email: <address> })
 * then get the first one from the input array.
 */
const toMailupAddress = (
  addresses: ReadonlyArray<NodemailerAddress>
): Option<Address> => {
  const addrs = toMailupAddresses(addresses);
  return fromNullable(addrs[0]);
};

type NodemailerAttachment = NonNullable<
  nodemailer.SendMailOptions["attachments"]
>[0];

const toMailupAttachmentBody = (content: string): ReadonlyArray<number> => {
  const textEncoder = new TextEncoder();
  return Array.from(textEncoder.encode(content));
};

/**
 * Converts an array of Nodemailer attachments to an array of MailUp attachments.
 *
 * @param attachments - An array of NodemailerAttachment objects.
 * @returns An array of objects representing MailUp attachments, with each object containing:
 *   - `Body`: The content of the attachment.
 *   - `ContentId`: The content ID of the attachment.
 *   - `Filename`: The filename of the attachment.
 */
const toMailupAttachments = (
  attachments: ReadonlyArray<NodemailerAttachment>
): ReadonlyArray<{ [k in keyof Attachment]: unknown }> =>
  attachments.map(att => ({
    Body:
      typeof att.content === "string"
        ? toMailupAttachmentBody(att.content)
        : undefined,
    ContentId: att.cid,
    Filename: att.filename
  }));

/**
 * Nodemailer transport for MailUp transactional APIs
 *
 * see http://help.mailup.com/display/mailupapi/Transactional+Emails+using+APIs
 * and https://nodemailer.com/plugins/create/#transports
 *
 * Usage:
 *
 * const transporter = nodemailer.createTransport(
 *   MailUpTransport({
 *     creds: {
 *       Username: <SMPT+Username>,
 *       Secret: <SMPT+Password>
 *     },
 *     fetchAgent: customFetch
 *   })
 * );
 *
 * transporter
 *   .sendMail({
 *     from:      "foobar@xexample.com",
 *     to:        "deadbeef@xexample.com",
 *     replyTo:   "foobar-reply@xexample.com",
 *     subject:   "lorem ipsum",
 *     text:      "lorem ipsum",
 *     html:      "<b>lorem ipsum</b>",
 *     attachments: [
 *      {
 *        filename: "lorem.txt",
 *        content: "lorem ipsum",
 *        cid: "cid:lorem"
 *      }
 *    ]
 *   })
 *   .then(res => console.log(JSON.stringify(res)))
 *   .catch(err => console.error(JSON.stringify(err)));
 */
/* eslint-disable @typescript-eslint/naming-convention */
export const MailUpTransport = (
  options: IMailUpTransportOptions
): nodemailer.Transport => {
  const fetchAgent =
    options.fetchAgent !== undefined
      ? options.fetchAgent
      : ((nodeFetch as unknown) as typeof fetch);
  return {
    name: TRANSPORT_NAME,

    version: TRANSPORT_VERSION,

    // eslint-disable-next-line sort-keys
    send: (mail, callback): void => {
      // We don't extract email addresses from mail.data.from / mail.data.to
      // as they are just strings that can contain invalid addresses.
      // Instead, mail.message.getAddresses() gets the email addresses
      // already validated by nodemailer (or undefined in case there are
      // no valid addresses for one specific field).
      // The following cast exists because of a bug in nodemailer typings
      // (MimeNode.Addresses are *not* just array of strings)
      const addresses: IAddresses = mail.message.getAddresses() as IAddresses;

      // Convert SMTP headers from the format used by nodemailer
      // to (N: <headerName>, V: <headerValue>) tuples
      // used by the MailUp APIs
      const headers = Object.keys(
        mail.data.headers as {
          readonly [s: string]: string;
        }
      ).map(header => ({
        N: header,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        V: (mail.data.headers as any)[header]
      }));

      const emailPayload = {
        Attachments: pipe(
          fromNullable(mail.data.attachments),
          O.map(toMailupAttachments),
          O.toUndefined
        ),
        Bcc: pipe(
          fromNullable(addresses.bcc),
          O.map(toMailupAddresses),
          O.toUndefined
        ),
        Cc: pipe(
          fromNullable(addresses.cc),
          O.map(toMailupAddresses),
          O.toUndefined
        ),
        ExtendedHeaders: headers,
        From: pipe(
          fromNullable(addresses.from),
          O.chain(toMailupAddress),
          O.toUndefined
        ),
        Html: {
          Body: mail.data.html
        },
        ReplyTo: pipe(
          fromNullable(addresses["reply-to"]),
          O.chain(toMailupAddress),
          O.map(addr => addr.Email),
          O.toUndefined
        ),
        Subject: mail.data.subject,
        Text: mail.data.text,
        To: pipe(
          fromNullable(addresses.to),
          O.map(toMailupAddresses),
          O.toUndefined
        )
      };

      const errorOrEmail = EmailPayload.decode(emailPayload);

      if (isLeft(errorOrEmail)) {
        const errors = readableReport(errorOrEmail.left);
        winston.error("MailUpTransport|errors", errors);
        return callback(
          new Error(`Invalid email payload: ${errors}`),
          undefined
        );
      }

      const email = errorOrEmail.right;

      sendTransactionalMail(options.creds, email, fetchAgent)()
        .then(errorOrResponse => {
          if (isRight(errorOrResponse)) {
            return callback(null, {
              ...errorOrResponse.right,
              messageId: mail.data.messageId
            });
          } else {
            return callback(errorOrResponse.left, undefined);
          }
        })
        .catch(e => callback(e, undefined));
    }
  };
};
/* eslint-enable @typescript-eslint/naming-convention */
