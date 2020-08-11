import * as nodemailer from "nodemailer";

const TRANSPORT_NAME = "Multi";
const TRANSPORT_VERSION = "0.1";

export interface IMultiTransportOptions {
  transports: ReadonlyArray<nodemailer.Transport>;
}

/**
 * Creates a Nodemailer transport that balances the delivery through
 * multiple transports.
 */
export function MultiTransport(
  options: IMultiTransportOptions
): nodemailer.Transport | undefined {
  const count = options.transports.length;
  if (count === 0) {
    // can't create the transport if we don't have any transports available
    return undefined;
  }

  // returns the index of a randomly chosen transport
  const randomTransportIndex = () => Math.floor(Math.random() * count);

  // returns a randomly chosen transport
  const randomTransport = () => options.transports[randomTransportIndex()];

  return {
    name: TRANSPORT_NAME,

    version: TRANSPORT_VERSION,

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
