import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";

import { EmailString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { AzureUserAttributesManageMiddleware } from "../azure_user_attributes_manage";
import { AuthorizedCIDRs } from "../../../models/authorized_cidrs";
import { CIDR } from "../../../../generated/definitions/CIDR";
import { CosmosErrors, toCosmosErrorResponse } from "../../cosmosdb_model";

jest.mock("winston");

interface IHeaders {
  readonly [key: string]: string | undefined;
}

function lookup(h: IHeaders): (k: string) => string | undefined {
  return (k: string) => h[k];
}

const anUserEmail = "test@example.com" as EmailString;
const aSubscriptionId = "MySubscriptionId" as NonEmptyString;
const aManageSubscriptionId = "MANAGE-MySubscriptionId" as NonEmptyString;
const anAuthorizedCIDRs: AuthorizedCIDRs = {
  id: "MANAGE-123" as NonEmptyString,
  cidrs: new Set((["0.0.0.0/0"] as unknown) as CIDR[])
};

describe("AzureUserAttributesManageMiddleware", () => {
  it("should fail on empty user email", async () => {
    const authorizedCIDRsModel = jest.fn();

    const headers: IHeaders = {
      "x-user-email": ""
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesManageMiddleware(
      authorizedCIDRsModel as any
    );

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledTimes(1);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-email");
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorInternal");
    }
  });

  it("should fail on invalid user email", async () => {
    const authorizedCIDRsModel = jest.fn();

    const headers: IHeaders = {
      "x-user-email": "xyz"
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesManageMiddleware(
      authorizedCIDRsModel as any
    );

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledTimes(1);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-email");
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorInternal");
    }
  });

  it("should fail on invalid key", async () => {
    const authorizedCIDRsModel = jest.fn();

    const headers: IHeaders = {
      "x-subscription-id": undefined,
      "x-user-email": anUserEmail
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesManageMiddleware(
      authorizedCIDRsModel as any
    );

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-subscription-id");
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorInternal");
    }
  });

  it("should fail and return an ErrorForbiddenNotAuthorized if the subscription is not a MANAGE subscription", async () => {
    const authorizedCIDRsModel = {
      find: jest.fn()
    };

    const headers: IHeaders = {
      "x-subscription-id": aSubscriptionId,
      "x-user-email": anUserEmail
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesManageMiddleware(
      authorizedCIDRsModel as any
    );

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-subscription-id");
    expect(authorizedCIDRsModel.find).not.toBeCalled();

    expect(E.isLeft(result));
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorForbiddenNotAuthorized");
    }
  });

  it("should fail on a subscription cidrs find error", async () => {
    const authorizedCIDRsModel = {
      find: jest.fn(() => TE.left(toCosmosErrorResponse("") as CosmosErrors))
    };

    const headers: IHeaders = {
      "x-subscription-id": aManageSubscriptionId,
      "x-user-email": anUserEmail
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesManageMiddleware(
      authorizedCIDRsModel as any
    );

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-subscription-id");
    expect(authorizedCIDRsModel.find).toHaveBeenCalledWith([
      mockRequest.header("x-subscription-id")
    ]);
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorQuery");
    }
  });

  it("should fail and return an ErrorForbiddenNotAuthorized if subscription cidrs return a None", async () => {
    const authorizedCIDRsModel = {
      find: jest.fn(() => TE.fromEither(E.right(O.none)))
    };

    const headers: IHeaders = {
      "x-subscription-id": aManageSubscriptionId,
      "x-user-email": anUserEmail
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesManageMiddleware(
      authorizedCIDRsModel as any
    );

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-subscription-id");
    expect(authorizedCIDRsModel.find).toHaveBeenCalledWith([
      mockRequest.header("x-subscription-id")
    ]);
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorForbiddenNotAuthorized");
    }
  });

  it("should return a default cidrs if the subscription cidrs does not exist", async () => {
    const authorizedCIDRsModel = {
      find: jest.fn(() => TE.fromEither(E.right(O.some(O.none))))
    };

    const headers: IHeaders = {
      "x-subscription-id": aManageSubscriptionId,
      "x-user-email": anUserEmail
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesManageMiddleware(
      authorizedCIDRsModel as any
    );

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-subscription-id");
    expect(authorizedCIDRsModel.find).toHaveBeenCalledWith([
      mockRequest.header("x-subscription-id")
    ]);
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right.kind).toEqual("IAzureUserAttributesManage");
      expect(result.right.authorizedCIDRs).toEqual(
        new Set((["0.0.0.0/0"] as unknown) as CIDR[])
      );
    }
  });

  it("should return the user custom attributes if the subscription is a MANAGE subscription", async () => {
    const authorizedCIDRsModel = {
      find: jest.fn(() => TE.fromEither(E.right(O.some(anAuthorizedCIDRs))))
    };

    const headers: IHeaders = {
      "x-subscription-id": aManageSubscriptionId,
      "x-user-email": anUserEmail
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesManageMiddleware(
      authorizedCIDRsModel as any
    );

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-subscription-id");
    expect(authorizedCIDRsModel.find).toHaveBeenCalledWith([
      mockRequest.header("x-subscription-id")
    ]);
    expect(E.isRight(result));
    if (E.isRight(result)) {
      const attributes = result.right;
      expect(attributes.email).toBe(anUserEmail);
      expect(attributes.kind).toBe("IAzureUserAttributesManage");
      expect(attributes.authorizedCIDRs).toBe(anAuthorizedCIDRs.cidrs);
    }
  });

  //TODO: The test MUST be removed after io-function-services update
  it("should return the user custom attributes if the subscription is a MANAGE subscription and authorizedCIDRs in not defined", async () => {
    const headers: IHeaders = {
      "x-subscription-id": aManageSubscriptionId,
      "x-user-email": anUserEmail
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesManageMiddleware();

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-subscription-id");
    expect(E.isRight(result));
    if (E.isRight(result)) {
      const attributes = result.right;
      expect(attributes.email).toBe(anUserEmail);
      expect(attributes.kind).toBe("IAzureUserAttributesManage");
      expect(attributes.authorizedCIDRs).toStrictEqual(anAuthorizedCIDRs.cidrs);
    }
  });
});
