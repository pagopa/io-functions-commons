/* eslint-disable sonarjs/no-duplicate-string */
/* eslint-disable sonarjs/no-identical-functions */

vi.mock("winston");

import {
  FiscalCode,
  NonEmptyString,
  OrganizationFiscalCode,
} from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import { Set } from "json-set-map";

import { MaxAllowedPaymentAmount } from "../../../../generated/definitions/MaxAllowedPaymentAmount";
import { Service, toAuthorizedCIDRs } from "../../../models/service";
import { CosmosErrorResponse } from "../../cosmosdb_model";
import { AzureUserAttributesMiddleware } from "../azure_user_attributes";
import { vi } from "vitest";

type IHeaders = Readonly<Record<string, string | undefined>>;

function lookup(h: IHeaders): (k: string) => string | undefined {
  return (k: string) => h[k];
}

const anOrganizationFiscalCode = "01234567890" as OrganizationFiscalCode;

const aService: Service = {
  authorizedCIDRs: toAuthorizedCIDRs([]),
  authorizedRecipients: new Set([]),
  departmentName: "MyDept" as NonEmptyString,
  isVisible: true,
  maxAllowedPaymentAmount: 0 as MaxAllowedPaymentAmount,
  organizationFiscalCode: anOrganizationFiscalCode,
  organizationName: "MyService" as NonEmptyString,
  requireSecureChannels: false,
  serviceId: "serviceId" as NonEmptyString,
  serviceName: "MyService" as NonEmptyString,
};

describe("AzureUserAttributesMiddleware", () => {
  it("should fail on empty user email", async () => {
    const serviceModel = vi.fn();

    const headers: IHeaders = {
      "x-user-email": "",
    };

    const mockRequest = {
      header: vi.fn(lookup(headers)),
    };

    const middleware = AzureUserAttributesMiddleware(serviceModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledTimes(1);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-email");
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorInternal");
    }
  });

  it("should fail on invalid user email", async () => {
    const serviceModel = vi.fn();

    const headers: IHeaders = {
      "x-user-email": "xyz",
    };

    const mockRequest = {
      header: vi.fn(lookup(headers)),
    };

    const middleware = AzureUserAttributesMiddleware(serviceModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledTimes(1);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-email");
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorInternal");
    }
  });

  it("should fail on invalid key", async () => {
    const serviceModel = {
      findOneByServiceId: vi.fn(),
    };
    const headers: IHeaders = {
      "x-subscription-id": undefined,
      "x-user-email": "test@example.com",
    };

    const mockRequest = {
      header: vi.fn(lookup(headers)),
    };

    const middleware = AzureUserAttributesMiddleware(serviceModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-subscription-id");
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorInternal");
    }
  });

  it("should fail if the user service does not exist", async () => {
    const serviceModel = {
      findLastVersionByModelId: vi.fn(() => TE.fromEither(E.right(O.none))),
    };

    const headers: IHeaders = {
      "x-subscription-id": "MySubscriptionId",
      "x-user-email": "test@example.com",
    };

    const mockRequest = {
      header: vi.fn(lookup(headers)),
    };

    const middleware = AzureUserAttributesMiddleware(serviceModel as any);

    const result = await middleware(mockRequest as any);

    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-subscription-id");
    expect(serviceModel.findLastVersionByModelId).toHaveBeenCalledWith([
      mockRequest.header("x-subscription-id"),
    ]);
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorForbiddenNotAuthorized");
    }
  });

  it("should fetch and return the user service from the custom attributes", async () => {
    const serviceModel = {
      findLastVersionByModelId: vi.fn(() =>
        TE.fromEither(E.right(O.some(aService))),
      ),
    };

    const headers: IHeaders = {
      "x-subscription-id": "MySubscriptionId",
      "x-user-email": "test@example.com",
    };

    const mockRequest = {
      header: vi.fn(lookup(headers)),
    };

    const middleware = AzureUserAttributesMiddleware(serviceModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-subscription-id");
    expect(serviceModel.findLastVersionByModelId).toHaveBeenCalledWith([
      mockRequest.header("x-subscription-id"),
    ]);
    expect(E.isRight(result));
    if (E.isRight(result)) {
      const attributes = result.right;
      expect(attributes.service).toEqual({
        ...aService,
        authorizedRecipients: new Set<FiscalCode>(),
      });
    }
  });

  it("should fail in case of error when fetching the user service", async () => {
    const serviceModel = {
      findLastVersionByModelId: vi.fn(() => TE.left(new Error("error"))),
    };

    const headers: IHeaders = {
      "x-subscription-id": "MySubscriptionId",
      "x-user-email": "test@example.com",
    };

    const mockRequest = {
      header: vi.fn(lookup(headers)),
    };

    const middleware = AzureUserAttributesMiddleware(serviceModel as any);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-subscription-id");
    expect(serviceModel.findLastVersionByModelId).toHaveBeenCalledWith([
      mockRequest.header("x-subscription-id"),
    ]);
    expect(E.isLeft(result));
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorQuery");
    }
  });
});
