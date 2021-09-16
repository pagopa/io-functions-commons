/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable sonar/sonar-max-lines-per-function */
/* eslint-disable sonarjs/no-duplicate-string */
/* eslint-disable sonarjs/no-identical-functions */

import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as t from "io-ts";

import {
  AzureAllowBodyPayloadMiddleware,
  AzureApiAuthMiddleware,
  UserGroup
} from "../azure_api_auth";

const anAllowedGroupSet = new Set([UserGroup.ApiMessageWrite]);

const someHeaders = {
  "x-subscription-id": "s123",
  "x-user-groups": "ApiMessageWrite",
  "x-user-id": "u123"
};

interface IHeaders {
  readonly [key: string]: string | undefined;
}

function lookup(h: IHeaders): (k: string) => string | undefined {
  return (k: string) => h[k];
}

describe("AzureApiAuthMiddleware", () => {
  it("should fail if no x-user-id header is present", async () => {
    const headers = {
      ...someHeaders,
      "x-user-id": undefined
    };
    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-id");
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorForbiddenAnonymousUser");
    }
  });

  it("should fail if the x-user-id header is empty", async () => {
    const headers = {
      ...someHeaders,
      "x-user-id": ""
    };
    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-id");
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorForbiddenAnonymousUser");
    }
  });

  it("should fail if no x-subscription-id header is present", async () => {
    const headers = {
      ...someHeaders,
      "x-subscription-id": undefined
    };
    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-subscription-id");
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorForbiddenAnonymousUser");
    }
  });

  it("should fail if the x-subscription-id header is empty", async () => {
    const headers = {
      ...someHeaders,
      "x-subscription-id": ""
    };
    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-subscription-id");
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorForbiddenAnonymousUser");
    }
  });

  it("should fail if no x-user-groups header is present", async () => {
    const headers = {
      ...someHeaders,
      "x-user-groups": undefined
    };
    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual(
        "IResponseErrorForbiddenNoAuthorizationGroups"
      );
    }
  });

  it("should fail if there's an empty x-user-groups header", async () => {
    const headers = {
      ...someHeaders,
      "x-user-groups": ""
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual(
        "IResponseErrorForbiddenNoAuthorizationGroups"
      );
    }
  });

  it("should fail if there's an invalid x-user-groups header", async () => {
    const headers = {
      ...someHeaders,
      "x-user-groups": ","
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual(
        "IResponseErrorForbiddenNoAuthorizationGroups"
      );
    }
  });

  it("should fail if the user is not part of an allowed group", async () => {
    const headers = {
      ...someHeaders,
      "x-user-groups": "ApiDebugRead"
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("IResponseErrorForbiddenNotAuthorized");
    }
  });

  it("should succeed if the user is part of an allowed group", async () => {
    const headers = {
      ...someHeaders,
      "x-user-groups": "ApiMessageWrite"
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-id");
    expect(mockRequest.header).toHaveBeenCalledWith("x-subscription-id");
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right.groups).toContain(UserGroup.ApiMessageWrite);
      expect(result.right.subscriptionId).toBe("s123");
      expect(result.right.userId).toBe("u123");
    }
  });

  it("should succeed if the user is part of at least an allowed group", async () => {
    const headers = {
      ...someHeaders,
      "x-user-groups": [
        UserGroup.ApiMessageRead,
        UserGroup.ApiMessageWrite
      ].join(",")
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-id");
    expect(mockRequest.header).toHaveBeenCalledWith("x-subscription-id");
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right.groups).toContain(UserGroup.ApiMessageWrite);
      expect(result.right.subscriptionId).toBe("s123");
      expect(result.right.userId).toBe("u123");
    }
  });

  it("should skip unknown groups in x-user-groups header", async () => {
    const headers = {
      ...someHeaders,
      "x-user-groups": ["a", UserGroup.ApiMessageWrite, "bx", "!"].join(",")
    };

    const mockRequest = {
      header: jest.fn(lookup(headers))
    };

    const middleware = AzureApiAuthMiddleware(anAllowedGroupSet);

    const result = await middleware(mockRequest as any);
    expect(mockRequest.header).toHaveBeenCalledWith("x-user-groups");
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right.groups).toEqual(new Set([UserGroup.ApiMessageWrite]));
    }
  });
});

describe("AzureAllowBodyPayloadMiddleware", () => {
  it("should success if pattern is not matched", async () => {
    const headers = {
      ...someHeaders
    };
    const aPayload = { foo: { bar: "baz" } };
    const mockRequest = {
      header: jest.fn(lookup(headers)),
      body: aPayload
    };
    const aNonMatchingCodec = t.interface({ anyField: t.number });
    const anyGroupSet = new Set([UserGroup.ApiMessageWrite]);

    const middleware = AzureAllowBodyPayloadMiddleware(
      aNonMatchingCodec,
      anyGroupSet
    );

    const result = await middleware(mockRequest as any);

    expect(E.isRight(result)).toBe(true);
    expect(E.isLeft(aNonMatchingCodec.decode(aPayload))).toBe(true); // test is wrong if it fails
  });

  it("should success if pattern is matched and user do belongs to correct user group", async () => {
    const headers = {
      ...someHeaders
    };
    const aPayload = { foo: { bar: "baz" } };
    const mockRequest = {
      header: jest.fn(lookup(headers)),
      body: aPayload
    };
    const aMatchingCodec = t.interface({
      foo: t.interface({ bar: t.string })
    });
    const allowedGroupSet = new Set([UserGroup.ApiMessageWrite]);

    const middleware = AzureAllowBodyPayloadMiddleware(
      aMatchingCodec,
      allowedGroupSet
    );

    const result = await middleware(mockRequest as any);

    expect(E.isRight(result)).toBe(true);
    expect(E.isRight(aMatchingCodec.decode(aPayload))).toBe(true); // test is wrong if it fails
  });

  it("should success if pattern is not matched - test nr. 2", async () => {
    const headers = {
      ...someHeaders
    };
    const aPayload = { foo: { bar: "baz" } };
    const mockRequest = {
      header: jest.fn(lookup(headers)),
      body: aPayload
    };
    const aNonMatchingCodec = t.interface({ anyField: t.string });
    const anyGroupSet = new Set([UserGroup.ApiDebugRead]); // any value

    const middleware = AzureAllowBodyPayloadMiddleware(
      aNonMatchingCodec,
      anyGroupSet
    );

    const result = await middleware(mockRequest as any);

    expect(E.isRight(result)).toBe(true);
    expect(E.isLeft(aNonMatchingCodec.decode(aPayload))).toBe(true); // test is wrong if it fails
  });

  it("should fail if pattern is matched and current user does not belongs to user group", async () => {
    const headers = {
      ...someHeaders
    };
    const aPayload = { foo: { bar: "baz" } };
    const mockRequest = {
      header: jest.fn(lookup(headers)),
      body: aPayload
    };
    const aMatchingCodec = t.interface({
      foo: t.interface({ bar: t.string })
    });
    const anotherAllowedGroupSet = new Set([UserGroup.ApiDebugRead]);

    const middleware = AzureAllowBodyPayloadMiddleware(
      aMatchingCodec,
      anotherAllowedGroupSet
    );

    const result = await middleware(mockRequest as any);

    expect(E.isLeft(result)).toBe(true);
    pipe(
      result,
      E.fold(
        _ => expect(_.kind).toBe("IResponseErrorForbiddenNotAuthorized"),
        _ => fail("Expecting left")
      )
    );
  });

  it("should fail if pattern is matched and current user has no groups", async () => {
    const headers = {
      ...someHeaders,
      "x-user-groups": ""
    };
    const aPayload = { foo: { bar: "baz" } };
    const mockRequest = {
      header: jest.fn(lookup(headers)),
      body: aPayload
    };
    const aMatchingCodec = t.interface({
      foo: t.interface({ bar: t.string })
    });

    const middleware = AzureAllowBodyPayloadMiddleware(
      aMatchingCodec,
      anAllowedGroupSet
    );

    const result = await middleware(mockRequest as any);

    expect(E.isLeft(result)).toBe(true);
    pipe(
      result,
      E.fold(
        _ =>
          expect(_.kind).toBe("IResponseErrorForbiddenNoAuthorizationGroups"),
        _ => fail("Expecting left")
      )
    );
  });
});
