import { isNone } from "fp-ts/lib/Option";
/*
 * A request wrapper that checks whether the source IP is contained in the
 * CIDRs allowed to make requests.
 */

import { IPString } from "@pagopa/ts-commons/lib/strings";
import { ITuple2, Tuple2 } from "@pagopa/ts-commons/lib/tuples";
import CIDRMatcher = require("cidr-matcher");

import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal
} from "@pagopa/ts-commons/lib/responses";
import { CIDR } from "../../generated/definitions/CIDR";
import { toAuthorizedCIDRs } from "../models/service";
import { ClientIp } from "./middlewares/client_ip_middleware";
import { IAzureUserAttributes } from "./middlewares/azure_user_attributes";
import { IAzureUserAttributesManage } from "./middlewares/azure_user_attributes_manage";

/**
 * Whether IP is contained in the provided CIDRs
 */
const isContainedInCidrs = (
  ip: IPString,
  cidrs: ReadonlySet<string>
): boolean => {
  const matcher = new CIDRMatcher();
  cidrs.forEach(c => {
    matcher.addNetworkClass(c);
  });
  return matcher.contains(ip);
};

export function checkSourceIpForHandler<P1, O>(
  f: (p1: P1) => Promise<O>,
  e: (p1: P1) => ITuple2<ClientIp, ReadonlySet<string>>
): (p1: P1) => Promise<O | IResponseErrorForbiddenNotAuthorized>;

export function checkSourceIpForHandler<P1, P2, O>(
  f: (p1: P1, p2: P2) => Promise<O>,
  e: (p1: P1, p2: P2) => ITuple2<ClientIp, ReadonlySet<string>>
): (p1: P1, p2: P2) => Promise<O | IResponseErrorForbiddenNotAuthorized>;

export function checkSourceIpForHandler<P1, P2, P3, O>(
  f: (p1: P1, p2: P2, p3: P3) => Promise<O>,
  e: (p1: P1, p2: P2, p3: P3) => ITuple2<ClientIp, ReadonlySet<string>>
): (
  p1: P1,
  p2: P2,
  p3: P3
) => Promise<O | IResponseErrorForbiddenNotAuthorized>;

export function checkSourceIpForHandler<P1, P2, P3, P4, O>(
  f: (p1: P1, p2: P2, p3: P3, p4: P4) => Promise<O>,
  e: (p1: P1, p2: P2, p3: P3, p4: P4) => ITuple2<ClientIp, ReadonlySet<string>>
): (
  p1: P1,
  p2: P2,
  p3: P3,
  p4: P4
) => Promise<O | IResponseErrorForbiddenNotAuthorized>;

export function checkSourceIpForHandler<P1, P2, P3, P4, P5, O>(
  f: (p1: P1, p2: P2, p3: P3, p4: P4, p5: P5) => Promise<O>,
  e: (
    p1: P1,
    p2: P2,
    p3: P3,
    p4: P4,
    p5: P5
  ) => ITuple2<ClientIp, ReadonlySet<string>>
): (
  p1: P1,
  p2: P2,
  p3: P3,
  p4: P4,
  p5: P5
) => Promise<O | IResponseErrorForbiddenNotAuthorized>;

export function checkSourceIpForHandler<P1, P2, P3, P4, P5, P6, O>(
  f: (p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6) => Promise<O>,
  e: (
    p1: P1,
    p2: P2,
    p3: P3,
    p4: P4,
    p5: P5,
    p6: P6
  ) => ITuple2<ClientIp, ReadonlySet<string>>
): (
  p1: P1,
  p2: P2,
  p3: P3,
  p4: P4,
  p5: P5,
  p6: P6
) => Promise<O | IResponseErrorForbiddenNotAuthorized>;

export function checkSourceIpForHandler<P1, P2, P3, P4, P5, P6, P7, O>(
  f: (p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7) => Promise<O>,
  e: (
    p1: P1,
    p2: P2,
    p3: P3,
    p4: P4,
    p5: P5,
    p6: P6,
    p7: P7
  ) => ITuple2<ClientIp, ReadonlySet<string>>
): (
  p1: P1,
  p2: P2,
  p3: P3,
  p4: P4,
  p5: P5,
  p6: P6,
  p7: P7
) => Promise<O | IResponseErrorForbiddenNotAuthorized>;

/**
 * Whether the request is coming from an allowed IP.
 *
 * @param handler     The handler to be wrapped
 * @param extractor   A Function that takes the parameters of f and extracts the
 *                    X-Forwarded-For header from the request and the authorized
 *                    CIDRs from the user attributes
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function checkSourceIpForHandler<P1, P2, P3, P4, P5, P6, P7, O>(
  handler: (
    p1: P1,
    p2: P2,
    p3: P3,
    p4: P4,
    p5: P5,
    p6: P6,
    p7: P7
  ) => Promise<O>,
  extractor: (
    p1: P1,
    p2: P2,
    p3: P3,
    p4: P4,
    p5: P5,
    p6: P6,
    p7: P7
  ) => ITuple2<ClientIp, ReadonlySet<string>>
): (
  p1: P1,
  p2: P2,
  p3: P3,
  p4: P4,
  p5: P5,
  p6: P6,
  p7: P7
) => Promise<
  O | IResponseErrorForbiddenNotAuthorized | IResponseErrorInternal
> {
  // eslint-disable-next-line max-params, @typescript-eslint/explicit-function-return-type
  return (p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7) =>
    new Promise(resolve => {
      // extract the x-forwarded-for header and the allowed cidrs from the params
      const x = extractor(p1, p2, p3, p4, p5, p6, p7);
      const maybeClientIp = x.e1;
      const cidrs = x.e2;

      if (isNone(maybeClientIp)) {
        return resolve(
          ResponseErrorInternal(
            "IP address cannot be extracted from the request"
          )
        );
      }

      if (
        // either allowed CIDRs is empty or client IP is contained in allowed CIDRs
        cidrs.size === 0 ||
        isContainedInCidrs(maybeClientIp.value, cidrs)
      ) {
        // forward request to handler
        return resolve(handler(p1, p2, p3, p4, p5, p6, p7));
      } else {
        // respond with Not Authorized
        return resolve(ResponseErrorForbiddenNotAuthorized);
      }
    });
}

/**
 * A helper for building the Tuple2 needed by checkSourceIpForHandler.
 *
 * @param request         The Express Request object
 * @param userAttributes  The IAzureUserAttributes object provided by
 *                        AzureUserAttributesMiddleware.
 */
export const clientIPAndCidrTuple = (
  clientIp: ClientIp,
  userAttributes: IAzureUserAttributes | IAzureUserAttributesManage
): ITuple2<ClientIp, ReadonlySet<string>> => {
  /**
   * Add the default /32 subnet to an IP without any subnet.
   */
  const withDefaultSubnet = (ip: CIDR): CIDR =>
    ip.indexOf("/") !== -1 ? ip : (`${ip}/32` as CIDR);
  const cidrs =
    userAttributes.kind === "IAzureUserAttributes"
      ? userAttributes.service.authorizedCIDRs
      : userAttributes.authorizedCIDRs;
  return Tuple2(
    clientIp,
    toAuthorizedCIDRs(Array.from(cidrs).map(withDefaultSubnet))
  );
};
