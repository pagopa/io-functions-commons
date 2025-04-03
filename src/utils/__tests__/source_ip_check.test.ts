/* eslint-disable sonarjs/no-identical-functions */

import { ResponseSuccessJson } from "@pagopa/ts-commons/lib/responses";
import { EmailString, IPString } from "@pagopa/ts-commons/lib/strings";
import { ITuple2, Tuple2 } from "@pagopa/ts-commons/lib/tuples";
import { Service, toAuthorizedCIDRs } from "../../models/service";
import { ClientIp } from "../middlewares/client_ip_middleware";

import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { fromEither as OptionFromEither } from "fp-ts/lib/Option";
import { IAzureUserAttributes } from "../middlewares/azure_user_attributes";
import {
  checkSourceIpForHandler,
  clientIPAndCidrTuple
} from "../source_ip_check";
import { IAzureUserAttributesManage } from "../middlewares/azure_user_attributes_manage";
import { CIDR } from "../../../generated/definitions/v2/CIDR";

describe("checkSourceIpForHandler", () => {
  // a sample request handler that gets the source IP and allowed CIDRs
  const handler = (__: ClientIp, ___: ReadonlySet<string>) => {
    return Promise.resolve(ResponseSuccessJson("OK"));
  };

  // extracts the source IP and the allowed CIDRs from the parameters passed
  // to the request handler
  function extractor(
    sourceIp: ClientIp,
    cidrs: ReadonlySet<string>
  ): ITuple2<ClientIp, ReadonlySet<string>> {
    return Tuple2(sourceIp, cidrs);
  }

  // wrap the request handler with the source IP checker
  const checkedHandler = checkSourceIpForHandler(handler, extractor);

  it("should let the request pass if no CIDRs have been set", async () => {
    const result = await checkedHandler(
      OptionFromEither(IPString.decode("127.0.0.1")),
      toAuthorizedCIDRs([])
    );
    expect(result.kind).toEqual("IResponseSuccessJson");
  });

  it("should let the request pass if IP matches CIDRs", async () => {
    const result = await checkedHandler(
      OptionFromEither(IPString.decode("192.168.1.1")),
      toAuthorizedCIDRs(["192.168.1.0/24"])
    );
    expect(result.kind).toEqual("IResponseSuccessJson");
  });

  it("should let the request pass if IP matches IPs", async () => {
    const result = await checkedHandler(
      OptionFromEither(IPString.decode("192.168.10.10")),
      toAuthorizedCIDRs(["192.168.10.10/32"])
    );
    expect(result.kind).toEqual("IResponseSuccessJson");
  });

  it("should reject the request if IP does not match CIDRs", async () => {
    const result = await checkedHandler(
      OptionFromEither(IPString.decode("10.0.1.1")),
      toAuthorizedCIDRs(["192.168.1.0/24"])
    );
    expect(result.kind).toEqual("IResponseErrorForbiddenNotAuthorized");
  });
});

describe("clientIPAndCidrTuple", () => {
  const userAttributes: IAzureUserAttributes = {
    email: "email@example.com" as EmailString,
    kind: "IAzureUserAttributes",
    service: ({
      authorizedCIDRs: toAuthorizedCIDRs(["192.168.1.0/24"])
    } as unknown) as Service & { readonly version: NonNegativeInteger }
  };
  const expectedClientIp = OptionFromEither(IPString.decode("192.168.10.10"));
  it("should return a set with client ip and autorizedCIDRs", () => {
    const resultTuple = clientIPAndCidrTuple(expectedClientIp, userAttributes);
    expect(resultTuple.e1).toBe(expectedClientIp);
    expect(resultTuple.e2).toStrictEqual(
      userAttributes.service.authorizedCIDRs
    );
  });
  it("should add /32 subnet if autorizedCIDR hasn't any subnet", () => {
    const userAttributesNoSubnet: IAzureUserAttributes = {
      email: "email@example.com" as EmailString,
      kind: "IAzureUserAttributes",
      service: ({
        authorizedCIDRs: toAuthorizedCIDRs(["192.168.1.0", "192.168.1.1/24"])
      } as unknown) as Service & { readonly version: NonNegativeInteger }
    };
    const resultTuple = clientIPAndCidrTuple(
      expectedClientIp,
      userAttributesNoSubnet
    );
    expect(resultTuple.e1).toBe(expectedClientIp);
    expect(resultTuple.e2).toStrictEqual(
      toAuthorizedCIDRs(["192.168.1.0/32", "192.168.1.1/24"])
    );
  });
  it("should return  authorizedCIDRs tuple if userAttribute is of IAzureUserAttributeManage kind", () => {
    const userAttributesManage: IAzureUserAttributesManage = {
      email: "email@example.com" as EmailString,
      kind: "IAzureUserAttributesManage",
      authorizedCIDRs: new Set((["0.0.0.0/0"] as unknown) as ReadonlyArray<
        CIDR
      >)
    };
    const resultTuple = clientIPAndCidrTuple(
      expectedClientIp,
      userAttributesManage
    );
    expect(resultTuple.e1).toBe(expectedClientIp);
    expect(resultTuple.e2).toStrictEqual(toAuthorizedCIDRs(["0.0.0.0/0"]));
  });
});
