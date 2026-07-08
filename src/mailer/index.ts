/**
 * Mailer module
 *
 * This is the entrypoint of the mailer module, which is spread over multiple files in this directory.
 * Ideally this is the only file that's needed to be imported when apps want to send email.
 */

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Option } from "fp-ts/lib/Option";
import * as O from "fp-ts/lib/Option";

import {
  AbortableFetch,
  setFetchTimeout,
  toFetch
} from "@pagopa/ts-commons/lib/fetch";
import { Millisecond } from "@pagopa/ts-commons/lib/units";
import { agent } from "@pagopa/ts-commons";
import { withoutUndefinedValues } from "@pagopa/ts-commons/lib/types";
import {
  createMailTransporter,
  getTransportsForConnections,
  MailerTransporter,
  MailUpTransport,
  MultiTransport,
  NodeMailerSendgrid,
  OneMailTransport,
  Transport
} from "./transports";

import {
  MailerConfig,
  MailhogMailerConfig,
  MailupMailerConfig,
  MultiTrasnsportMailerConfig,
  OneMailMailerConfig,
  SendgridMailerConfig,
  SMTPMailerConfig
} from "./config";

// expects a never value. return a constant or the value itself
const defaultNever = <T>(e: never, retVal: T = e): T => retVal;

// Some transports require http connections, this is the default client
const defaultFetchAgent = toFetch(
  setFetchTimeout(
    5000 as Millisecond, // 5 seconds timeout by default
    AbortableFetch(agent.getHttpsFetch(process.env))
  )
);

type TransportOpts =
  | Transport
  | {
      readonly host: NonEmptyString;
      readonly port: number;
      readonly secure: boolean;
    };

/**
 * Select the proper transport options inferring the type from a given configuration
 */
const selectTransportOpts = (
  config: MailerConfig,
  fetchAgent: typeof fetch
): Option<TransportOpts> => {
  if (SendgridMailerConfig.is(config)) {
    return O.some(
      NodeMailerSendgrid({
        apiKey: config.SENDGRID_API_KEY
      })
    );
  }
  if (MailupMailerConfig.is(config)) {
    return O.some(
      MailUpTransport({
        creds: {
          Secret: config.MAILUP_SECRET,
          Username: config.MAILUP_USERNAME
        },
        // HTTPS-only fetch with optional keepalive agent
        fetchAgent
      })
    );
  }
  if (MultiTrasnsportMailerConfig.is(config)) {
    return O.fromNullable(
      MultiTransport(
        getTransportsForConnections(config.MAIL_TRANSPORTS, fetchAgent)
      )
    );
  }
  if (OneMailMailerConfig.is(config)) {
    return O.some(
      OneMailTransport({
        apiKey: config.ONEMAIL_API_KEY,
        baseUrl: config.ONEMAIL_BASE_URL,
        // HTTPS-only fetch with optional keepalive agent
        fetchAgent,
        tenantName: config.ONEMAIL_TENANT_NAME
      })
    );
  }
  if (MailhogMailerConfig.is(config)) {
    return O.some({
      host: config.MAILHOG_HOSTNAME,
      port: 1025,
      secure: false
    });
  }
  if (SMTPMailerConfig.is(config)) {
    return O.some({
      // Either both are defined or undefined
      auth: withoutUndefinedValues({
        pass: config.SMTP_PASS,
        user: config.SMTP_USER
      }),
      host: config.SMTP_HOSTNAME,
      pool: config.SMTP_USE_POOL,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE
    });
  }
  return defaultNever(config, O.none);
};

/**
 * Create a mail transporter object inferring the type from a given configuration
 *
 * @param config the configuration provided.
 * @param fetchAgent optional fetch function to be used by whose transport that use http connctions. A default with 5s timeout is used if no agent is passed.
 *
 * @returns a mail transporter object
 * @throws an error creating the transporter
 */
export const getMailerTransporter = (
  config: MailerConfig,
  fetchAgent: typeof fetch = defaultFetchAgent
): MailerTransporter => {
  const maybeTransportOpts = selectTransportOpts(config, fetchAgent);

  if (O.isSome(maybeTransportOpts)) {
    return createMailTransporter(maybeTransportOpts.value);
  } else {
    throw new Error(
      "Failed to choose a mail transport based on provided configuration"
    );
  }
};

// expose inner stuff as public module interface
export { MailerConfig } from "./config";
export { sendMail, MailerTransporter } from "./transports";
