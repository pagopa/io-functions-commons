/**
 * Mailer module
 *
 * This is the entrypoint of the mailer module, which is spread over multiple files in this directory.
 * Ideally this is the only file that's needed to be imported when apps want to send email.
 */

import { fromNullable, none, Option, some } from "fp-ts/lib/Option";
import { agent } from "italia-ts-commons";
import {
  AbortableFetch,
  setFetchTimeout,
  toFetch
} from "italia-ts-commons/lib/fetch";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { Millisecond } from "italia-ts-commons/lib/units";

import {
  MailerConfig,
  MailhogMailerConfig,
  MailupMailerConfig,
  MultiTrasnsportMailerConfig,
  SendgridMailerConfig
} from "./config";

import {
  createMailTransporter,
  getTransportsForConnections,
  MailerTransporter,
  MailUpTransport,
  MultiTransport,
  NodeMailerSendgrid,
  Transport
} from "./transports";

export { sendMail } from "./transports";

// expects a never value. return a constant or the value itself
const defaultNever = <T>(e: never, retVal: T = e): T => retVal;

// 5 seconds timeout by default
const DEFAULT_EMAIL_REQUEST_TIMEOUT_MS = 5000;

// Must be an https endpoint so we use an https agent
const abortableFetch = AbortableFetch(agent.getHttpsFetch(process.env));
const fetchWithTimeout = setFetchTimeout(
  DEFAULT_EMAIL_REQUEST_TIMEOUT_MS as Millisecond,
  abortableFetch
);
const fetchAgent = toFetch(fetchWithTimeout);

/**
 * Create a mail transporter object inferring the type from a given configuration
 *
 * @param config the configuration provided
 *
 * @returns a mail transporter object
 * @throws an error creating the transporter
 */
export function getMailerTransporter(config: MailerConfig): MailerTransporter {
  const maybeTransportOpts: Option<
    | Transport
    | {
        host: NonEmptyString;
        port: number;
        secure: boolean;
      }
  > = SendgridMailerConfig.is(config)
    ? some(
        NodeMailerSendgrid({
          apiKey: config.SENDGRID_API_KEY
        })
      )
    : MailupMailerConfig.is(config)
    ? some(
        MailUpTransport({
          creds: {
            Secret: config.MAILUP_SECRET,
            Username: config.MAILUP_USERNAME
          },
          // HTTPS-only fetch with optional keepalive agent
          fetchAgent
        })
      )
    : MultiTrasnsportMailerConfig.is(config)
    ? fromNullable(
        MultiTransport(
          getTransportsForConnections(config.MAIL_TRANSPORTS, fetchAgent)
        )
      )
    : MailhogMailerConfig.is(config)
    ? some({
        host: config.MAILHOG_HOSTNAME,
        port: 1025,
        secure: false
      })
    : defaultNever(config, none);

  return maybeTransportOpts.map(createMailTransporter).getOrElseL(() => {
    throw new Error(
      "Failed to choose a mail transport based on provided configuration"
    );
  });
}
