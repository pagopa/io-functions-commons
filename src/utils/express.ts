import * as express from "express";
import * as helmet from "helmet";
import * as csp from "helmet-csp";
import * as referrerPolicy from "referrer-policy";
import { tryCatch, fromEither } from "fp-ts/lib/TaskEither";
import { toError, fromNullable } from "fp-ts/lib/Either";
import * as t from "io-ts";

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
 * Type used to map version from package.json
 */
type PackageJson = t.TypeOf<typeof PackageJson>;
const PackageJson = t.interface({
  version: t.string
});

/**
 * Create an express middleware to set the 'X-API-Version' response header field to the current app version in execution.
 * The function will extract from (win first):
 * 1. the package.json file in the process working directory;
 * 2. the npm environment.
 *
 * @returns a factory method for the Middleware
 */
export const createAppVersionHeaderMiddleware: () => express.RequestHandler = () => (
  _,
  res,
  next
): void => {
  void tryCatch<Error, PackageJson>(
    () => import(`${process.cwd()}/package.json`),
    toError
  )
    .map(p => p.version)
    .orElse(__ =>
      fromEither(
        fromNullable(new Error("Missing NPM Package Version"))(
          process.env.npm_package_version
        )
      )
    )
    .map(v => res.setHeader("X-API-Version", v))
    .run();

  next();
};

/**
 * Configure all the default express middleware handlers on the input express app.
 * Register here all the non business-logic-related common behaviours.
 * Registerd middlewares:
 *  - @see createAppVersionHeaderMiddleware
 *
 * @param app an express application
 */
export const configureDefaultMiddlewares = (app: express.Express): void => {
  app.use(createAppVersionHeaderMiddleware());
};
