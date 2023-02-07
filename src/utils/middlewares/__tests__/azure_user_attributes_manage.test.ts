import * as E from "fp-ts/lib/Either";
import { EmailString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { AzureUserAttributesManageMiddleware } from "../azure_user_attributes_manage";

interface IHeaders {
  readonly [key: string]: string | undefined;
}

function lookup(h: IHeaders): (k: string) => string | undefined {
  return (k: string) => h[k];
}

const anUserEmail = "test@example.com" as EmailString;
const aSubscriptionId = "MySubscriptionId" as NonEmptyString;
const aManageSubscriptionId = "MANAGE-MySubscriptionId" as NonEmptyString;

describe("AzureUserAttributesManageMiddleware", () => {
  it("should fail on empty user email", async () => {
    const headers: IHeaders = {
      "x-user-email": ""
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesManageMiddleware();

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledTimes(1);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-email");
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorInternal");
    }
  });

  it("should fail on invalid user email", async () => {
    const serviceModel = jest.fn();

    const headers: IHeaders = {
      "x-user-email": "xyz"
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesManageMiddleware();

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledTimes(1);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-email");
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorInternal");
    }
  });

  it("should fail on invalid key", async () => {
    const headers: IHeaders = {
      "x-subscription-id": undefined,
      "x-user-email": anUserEmail
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesManageMiddleware();

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-subscription-id");
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorInternal");
    }
  });

  it("should fail and return an ErrorForbiddenNotAuthorized if the subscription is not a MANAGE subscription", async () => {
    const headers: IHeaders = {
      "x-subscription-id": aSubscriptionId,
      "x-user-email": anUserEmail
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureUserAttributesManageMiddleware();

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header.mock.calls[0][0]).toBe("x-user-email");
    expect(mockRequest.header.mock.calls[1][0]).toBe("x-subscription-id");
    expect(E.isLeft(result));
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorForbiddenNotAuthorized");
    }
  });

  it("should return the user custom attributes if the subscription is a MANAGE subscription", async () => {
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
    }
  });
});
