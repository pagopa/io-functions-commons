/**
 * Transports module
 *
 * This module wraps the inner mechanism to send mail (NodeMailer at the time of writing)
 * and expose a set of utilities to setup a proper mail transporter.
 *
 * This is the place to come to add a new mail provider.
 */

import { catOptions } from "fp-ts/lib/Array";
import { toError } from "fp-ts/lib/Either";
import { none, Option, some } from "fp-ts/lib/Option";
import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { createTransport, SentMessageInfo, Transport } from "nodemailer";
import NodeMailerSendgrid = require("nodemailer-sendgrid");
// tslint:disable-next-line: no-submodule-imports
import MailerTransporter = require("nodemailer/lib/mailer");
import { promisify } from "util";
import { MailUpTransport } from "./mailup";
import { MailMultiTransportConnections } from "./multi_transport_connection";

/**
 * Creates a NodeMailer transport that balances the delivery through multiple transports.
 * Transport is selected randomly at each email sent
 *
 * @param transports an array of transport configurations
 *
 * @returns maybe a mailer transport
 */
function MultiTransport(
  transports: ReadonlyArray<Transport>
): Transport | undefined {
  const count = transports.length;
  if (count === 0) {
    // can't create the transport if we don't have any transports available
    return undefined;
  }

  // returns the index of a randomly chosen transport
  const randomTransportIndex = () => Math.floor(Math.random() * count);

  // returns a randomly chosen transport
  const randomTransport = () => transports[randomTransportIndex()];

  return {
    name: "Multi",

    version: "0.1",

    // The send method selects a random transport and calls its send method.
    // Note that, in case of success, the info object gets augmented with
    // details on the actual transport used to deliver the email.
    send: (mail, callback) => {
      const transport = randomTransport();
      const extraInfo = {
        selectedTransportName: transport.name,
        selectedTransportVersion: transport.version
      };
      return transport.send(mail, (err, info) => {
        // if info is an object we add the extraInfo attributes
        // if it's null or undefined, we override it with extraInfo
        // or else we just return its value
        const newInfo =
          typeof info === "object"
            ? {
                ...info,
                ...extraInfo
              }
            : (info === undefined || info === null) &&
              (err === undefined || err === null)
            ? extraInfo
            : info;
        callback(err, newInfo);
      });
    }
  };
}

/**
 * Converts an array of mail transport connections into their corresponding
 * NodeMailer transports
 */
function getTransportsForConnections(
  configs: MailMultiTransportConnections,
  fetchAgent: typeof fetch
): ReadonlyArray<Transport> {
  const fn = (config: {
    password: string;
    transport: NonEmptyString;
    username: string;
  }): Option<Transport> => {
    // configure mailup
    if (
      config.transport === "mailup" &&
      NonEmptyString.is(config.password) &&
      NonEmptyString.is(config.username)
    ) {
      return some(
        MailUpTransport({
          creds: {
            Secret: config.password,
            Username: config.username
          },
          fetchAgent
        })
      );
    }

    // sendgrid uses username as api key
    if (config.transport === "sendgrid" && NonEmptyString.is(config.username)) {
      return some(
        NodeMailerSendgrid({
          apiKey: config.username
        })
      );
    }

    // default ignore
    return none;
  };
  return catOptions(configs.map(fn));
}

/**
 * TaskEither wrapper around MailerTransporter#sendMail
 */
const sendMail = (
  mailTransporter: MailerTransporter,
  options: Parameters<typeof mailTransporter.sendMail>[0]
): TaskEither<Error, SentMessageInfo> =>
  tryCatch(
    () => promisify(mailTransporter.sendMail.bind(mailTransporter))(options),
    toError
  );

export {
  // meaningful types
  Transport,
  MailerTransporter,
  // transport factories
  MailUpTransport,
  NodeMailerSendgrid,
  MultiTransport,
  getTransportsForConnections,
  // There is actually a non-intuitive difference between trasnport and transporter
  // NodeMailer uses such terms interchangeably, so I thought it may be worth a note:
  // |> a transport is a bundled configuration for how mail are sent
  // |> a transporter is the object that activate over a given transport
  // This is actually the reason of the alias below
  createTransport as createMailTransporter,
  // to actually send a mail
  sendMail
};
