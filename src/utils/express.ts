import * as express from "express";
import { fromNullable } from "fp-ts/lib/Option";
import * as helmet from "helmet";
import * as csp from "helmet-csp";
import * as referrerPolicy from "referrer-policy";

/**
 * Set up secure HTTP headers applying middlewares
 * to the express application passed in input.
 *
 * @param app an express application.
 */
export const secureExpressApp = (app: express.Express): void => {
  // Set header `referrer-policy` to `no-referrer`
  app.use(referrerPolicy());

  // Set up Content Security Policy
  app.use(
    csp({
      directives: {
        defaultSrc: ["'none'"],
        upgradeInsecureRequests: true
      }
    })
  );

  // Set up the following HTTP headers
  // (see https://helmetjs.github.io/ for default values)
  //    strict-transport-security: max-age=15552000; includeSubDomains
  //    transfer-encoding: chunked
  //    x-content-type-options: nosniff
  //    x-dns-prefetch-control: off
  //    x-download-options: noopen
  //    x-frame-options: DENY
  //    x-xss-protection →1; mode=block
  app.use(
    helmet({
      frameguard: {
        action: "deny"
      }
    })
  );
};

/**
 * Create an express middleware to set the 'X-API-Version' response header field to the current app version in execution (from the npm environment).
 *
 * @returns a factory method for the Middleware
 */
export const createAppVersionHeaderHandler: () => express.RequestHandler = () => (
  _,
  res,
  next
): void => {
  fromNullable(process.env.npm_package_version).map(v =>
    res.setHeader("X-API-Version", v)
  );
  next();
};

/**
 * Configure all the default express middleware handlers on the input express app.
 * Register here all the non business-logic-related common behaviours.
 *
 * @param app an express application
 */
export const configureDefaultHandlers = (app: express.Express): void => {
  app.use(createAppVersionHeaderHandler());
};
