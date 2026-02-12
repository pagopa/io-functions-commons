/**
 * Unit tests for extractArgsFromMiddlewares function
 * Tests the middleware execution and argument extraction logic
 */

import {
  InvocationContext,
  HttpRequest,
  HttpRequestInit
} from "@azure/functions";
import { IRequestMiddleware } from "@pagopa/ts-commons/lib/request_middleware";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import { extractArgsFromMiddlewares } from "../adapter";
import {
  ResponseErrorValidation,
  ResponseErrorForbiddenAnonymousUser,
  ResponseErrorInternal
} from "@pagopa/ts-commons/lib/responses";

// Import middlewares to test
import { FiscalCodeMiddleware } from "../../middlewares/fiscalcode";
import { RequiredParamMiddleware } from "../../middlewares/required_param";
import { OptionalParamMiddleware } from "../../middlewares/optional_param";
import { RequiredQueryParamMiddleware } from "../../middlewares/required_query_param";
import { OptionalQueryParamMiddleware } from "../../middlewares/optional_query_param";
import { RequiredBodyPayloadMiddleware } from "../../middlewares/required_body_payload";
import { ClientIpMiddleware } from "../../middlewares/client_ip_middleware";
import { ContextMiddleware } from "../../middlewares/context_middleware";
import { SandboxFiscalCodeMiddleware } from "../../middlewares/sandboxfiscalcode";
import {
  AzureApiAuthMiddleware,
  AzureAllowBodyPayloadMiddleware,
  UserGroup,
  IAzureApiAuthorization
} from "../../middlewares/azure_api_auth";
import { AzureUserAttributesMiddleware } from "../../middlewares/azure_user_attributes";
import { AzureUserAttributesManageMiddleware } from "../../middlewares/azure_user_attributes_manage";

// Import types for testing
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { ServiceId } from "../../../../generated/definitions/ServiceId";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";
import { createMockContext, createMockRequest } from "./test-utils";

// Helper to create a simple middleware that returns a value
const createSuccessMiddleware = <A>(
  value: A
): IRequestMiddleware<never, A> => async () => E.right(value);

// Helper to create a middleware that returns an error
const createErrorMiddleware = <K extends string>(
  errorResponse: any
): IRequestMiddleware<K, never> => async () => E.left(errorResponse);

describe("extractArgsFromMiddlewares", () => {
  describe("Basic functionality", () => {
    it("should return empty array when no middlewares are provided", async () => {
      const req = createMockRequest();
      const context = createMockContext();

      const extractArgs = extractArgsFromMiddlewares();
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right([]));
    });

    it("should extract value from a single successful middleware", async () => {
      const req = createMockRequest();
      const context = createMockContext();

      const middleware = createSuccessMiddleware("test-value");
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right(["test-value"]));
    });

    it("should extract values from multiple successful middlewares", async () => {
      const req = createMockRequest();
      const context = createMockContext();

      const mw1 = createSuccessMiddleware("first");
      const mw2 = createSuccessMiddleware(42);
      const mw3 = createSuccessMiddleware({ key: "value" });

      const extractArgs = extractArgsFromMiddlewares(mw1, mw2, mw3);
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right(["first", 42, { key: "value" }]));
    });

    it("should return error when a middleware fails", async () => {
      const req = createMockRequest();
      const context = createMockContext();

      const errorResponse = ResponseErrorValidation(
        "Validation failed",
        "Invalid input"
      );
      const middleware = createErrorMiddleware(errorResponse);

      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.left(errorResponse));
    });

    it("should stop execution and return error from first failing middleware", async () => {
      const req = createMockRequest();
      const context = createMockContext();

      const mw1 = createSuccessMiddleware("first");
      const errorResponse = ResponseErrorValidation(
        "Validation failed",
        "Second middleware failed"
      );
      const mw2 = createErrorMiddleware(errorResponse);
      const mw3 = createSuccessMiddleware("third"); // Should not be executed

      const extractArgs = extractArgsFromMiddlewares(mw1, mw2, mw3);
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.left(errorResponse));
    });

    it("should execute middlewares sequentially", async () => {
      const req = createMockRequest();
      const context = createMockContext();
      const executionOrder: number[] = [];

      const mw1: IRequestMiddleware<never, string> = async () => {
        executionOrder.push(1);
        return E.right("first");
      };

      const mw2: IRequestMiddleware<never, string> = async () => {
        executionOrder.push(2);
        return E.right("second");
      };

      const mw3: IRequestMiddleware<never, string> = async () => {
        executionOrder.push(3);
        return E.right("third");
      };

      const extractArgs = extractArgsFromMiddlewares(mw1, mw2, mw3);
      await extractArgs(req, context);

      expect(executionOrder).toEqual([1, 2, 3]);
    });
  });

  describe("FiscalCodeMiddleware", () => {
    it("should extract valid fiscal code from params", async () => {
      const req = createMockRequest({
        params: { fiscalcode: "AAAAAA00A00A000A" }
      });
      const context = createMockContext();

      const extractArgs = extractArgsFromMiddlewares(FiscalCodeMiddleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right(["AAAAAA00A00A000A"]));
    });

    it("should return validation error for invalid fiscal code", async () => {
      const req = createMockRequest({
        params: { fiscalcode: "INVALID" }
      });
      const context = createMockContext();

      const extractArgs = extractArgsFromMiddlewares(FiscalCodeMiddleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(expect.objectContaining({ kind: "IResponseErrorValidation" }))
      );
    });

    it("should return validation error for missing fiscal code", async () => {
      const req = createMockRequest({
        params: {}
      });
      const context = createMockContext();

      const extractArgs = extractArgsFromMiddlewares(FiscalCodeMiddleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(expect.objectContaining({ kind: "IResponseErrorValidation" }))
      );
    });
  });

  describe("SandboxFiscalCodeMiddleware", () => {
    it("should extract valid sandbox fiscal code from params", async () => {
      const req = createMockRequest({
        params: { fiscalcode: "AAAAAA00A00Y000X" }
      });
      const context = createMockContext();

      const extractArgs = extractArgsFromMiddlewares(
        SandboxFiscalCodeMiddleware
      );
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right(["AAAAAA00A00Y000X"]));
    });

    it("should return validation error for invalid sandbox fiscal code", async () => {
      const req = createMockRequest({
        params: { fiscalcode: "INVALID" }
      });
      const context = createMockContext();

      const extractArgs = extractArgsFromMiddlewares(
        SandboxFiscalCodeMiddleware
      );
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(expect.objectContaining({ kind: "IResponseErrorValidation" }))
      );
    });

    it("should return validation error for missing sandbox fiscal code", async () => {
      const req = createMockRequest({
        params: {}
      });
      const context = createMockContext();

      const extractArgs = extractArgsFromMiddlewares(
        SandboxFiscalCodeMiddleware
      );
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(expect.objectContaining({ kind: "IResponseErrorValidation" }))
      );
    });
  });

  describe("RequiredParamMiddleware", () => {
    it("should extract valid required param", async () => {
      const req = createMockRequest({
        params: { serviceid: "test-service-123" }
      });
      const context = createMockContext();

      const middleware = RequiredParamMiddleware("serviceid", ServiceId);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right(["test-service-123"]));
    });

    it("should return validation error for missing required param", async () => {
      const req = createMockRequest({
        params: {}
      });
      const context = createMockContext();

      const middleware = RequiredParamMiddleware("serviceid", ServiceId);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(expect.objectContaining({ kind: "IResponseErrorValidation" }))
      );
    });

    it("should return validation error for invalid param type", async () => {
      const req = createMockRequest({
        params: { serviceid: "" } // Empty string is invalid for ServiceId
      });
      const context = createMockContext();

      const middleware = RequiredParamMiddleware("serviceid", ServiceId);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(expect.objectContaining({ kind: "IResponseErrorValidation" }))
      );
    });
  });

  describe("OptionalParamMiddleware", () => {
    it("should extract optional param when present", async () => {
      const req = createMockRequest({
        params: { serviceid: "test-service-456" }
      });
      const context = createMockContext();

      const middleware = OptionalParamMiddleware("serviceid", ServiceId);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right([O.some("test-service-456")]));
    });

    it("should return None when optional param is missing", async () => {
      const req = createMockRequest({
        params: {}
      });
      const context = createMockContext();

      const middleware = OptionalParamMiddleware("serviceid", ServiceId);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right([O.none]));
    });

    it("should return validation error for invalid optional param", async () => {
      const req = createMockRequest({
        params: { serviceid: "" } // Empty string is invalid for ServiceId
      });
      const context = createMockContext();

      const middleware = OptionalParamMiddleware("serviceid", ServiceId);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(expect.objectContaining({ kind: "IResponseErrorValidation" }))
      );
    });
  });

  describe("RequiredQueryParamMiddleware", () => {
    it("should extract valid required query param", async () => {
      const req = createMockRequest({ query: { code: "ABC123" } });
      const context = createMockContext();

      const middleware = RequiredQueryParamMiddleware("code", NonEmptyString);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right(["ABC123"]));
    });

    it("should return validation error for missing required query param", async () => {
      const req = createMockRequest({
        query: {}
      });
      const context = createMockContext();

      const middleware = RequiredQueryParamMiddleware("code", NonEmptyString);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(expect.objectContaining({ kind: "IResponseErrorValidation" }))
      );
    });
  });

  describe("OptionalQueryParamMiddleware", () => {
    it("should extract optional query param when present", async () => {
      const req = createMockRequest({ query: { filter: "active" } });
      const context = createMockContext();

      const middleware = OptionalQueryParamMiddleware("filter", NonEmptyString);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right([O.some("active")]));
    });

    it("should return None when optional query param is missing", async () => {
      const req = createMockRequest({
        query: {}
      });
      const context = createMockContext();

      const middleware = OptionalQueryParamMiddleware("filter", NonEmptyString);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right([O.none]));
    });

    it("should return validation error for invalid optional query param", async () => {
      const req = createMockRequest({ query: { filter: "" } }); // Empty string is invalid for NonEmptyString
      const context = createMockContext();

      const middleware = OptionalQueryParamMiddleware("filter", NonEmptyString);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(expect.objectContaining({ kind: "IResponseErrorValidation" }))
      );
    });
  });

  describe("RequiredBodyPayloadMiddleware", () => {
    const TestPayload = t.interface({
      name: NonEmptyString,
      age: t.number
    });

    type TestPayload = t.TypeOf<typeof TestPayload>;

    it("should extract valid body payload", async () => {
      const body = { name: "John", age: 30 };
      const req = createMockRequest({
        body: { string: JSON.stringify(body) }
      });
      const context = createMockContext();

      const middleware = RequiredBodyPayloadMiddleware(TestPayload);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right([{ name: "John", age: 30 }]));
    });

    it("should return validation error for invalid body payload", async () => {
      const body = { name: "", age: 30 }; // Empty name is invalid
      const req = createMockRequest({
        body: { string: JSON.stringify(body) }
      });
      const context = createMockContext();

      const middleware = RequiredBodyPayloadMiddleware(TestPayload);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(expect.objectContaining({ kind: "IResponseErrorValidation" }))
      );
    });

    it("should return validation error for missing body payload", async () => {
      const req = createMockRequest({
        body: undefined
      });
      const context = createMockContext();

      const middleware = RequiredBodyPayloadMiddleware(TestPayload);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(expect.objectContaining({ kind: "IResponseErrorValidation" }))
      );
    });
  });

  describe("ClientIpMiddleware", () => {
    it("should extract client IP when available", async () => {
      const req = createMockRequest({
        headers: { "x-forwarded-for": "192.168.1.1" }
      });
      const context = createMockContext();

      const extractArgs = extractArgsFromMiddlewares(ClientIpMiddleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right([O.some("192.168.1.1")]));
    });

    it("should return None when IP is not available", async () => {
      const req = createMockRequest();
      const context = createMockContext();

      const extractArgs = extractArgsFromMiddlewares(ClientIpMiddleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right([O.none]));
    });
  });

  describe("ContextMiddleware", () => {
    it("should extract context from request", async () => {
      const context = createMockContext();
      const req = createMockRequest();

      // extractArgsFromMiddlewares calls functionToExpressRequest internally,
      // which automatically sets the context in app.get("context")
      const extractArgs = extractArgsFromMiddlewares(ContextMiddleware());
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right([context]));
    });
  });

  describe("AzureApiAuthMiddleware", () => {
    it("should successfully authenticate user with valid headers and allowed groups", async () => {
      const req = createMockRequest({
        headers: {
          "x-user-id": "user123",
          "x-subscription-id": "subscription456",
          "x-user-groups": "ApiMessageWrite,ApiInfoRead"
        }
      });
      const context = createMockContext();

      const allowedGroups = new Set([
        UserGroup.ApiMessageWrite,
        UserGroup.ApiServiceRead
      ]);

      const middleware = AzureApiAuthMiddleware(allowedGroups);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const [authInfo] = result.right as [IAzureApiAuthorization];
        expect(authInfo).toMatchObject({
          kind: "IAzureApiAuthorization",
          userId: "user123",
          subscriptionId: "subscription456"
        });
        expect(authInfo.groups.has(UserGroup.ApiMessageWrite)).toBe(true);
        expect(authInfo.groups.has(UserGroup.ApiInfoRead)).toBe(true);
      }
    });

    it("should return error when user-id header is missing", async () => {
      const req = createMockRequest({
        headers: {
          "x-subscription-id": "subscription456",
          "x-user-groups": "ApiMessageWrite"
        }
      });
      const context = createMockContext();

      const allowedGroups = new Set([UserGroup.ApiMessageWrite]);
      const middleware = AzureApiAuthMiddleware(allowedGroups);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(
          expect.objectContaining({
            kind: "IResponseErrorForbiddenAnonymousUser"
          })
        )
      );
    });

    it("should return error when user has no authorization groups", async () => {
      const req = createMockRequest({
        headers: {
          "x-user-id": "user123",
          "x-subscription-id": "subscription456"
        }
        // No x-user-groups header
      });
      const context = createMockContext();

      const allowedGroups = new Set([UserGroup.ApiMessageWrite]);
      const middleware = AzureApiAuthMiddleware(allowedGroups);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(
          expect.objectContaining({
            kind: "IResponseErrorForbiddenNoAuthorizationGroups"
          })
        )
      );
    });

    it("should return error when user is not in allowed groups", async () => {
      const req = createMockRequest({
        headers: {
          "x-user-id": "user123",
          "x-subscription-id": "subscription456",
          "x-user-groups": "ApiInfoRead,ApiDebugRead"
        }
      });
      const context = createMockContext();

      // Only allow ApiMessageWrite, which the user doesn't have
      const allowedGroups = new Set([UserGroup.ApiMessageWrite]);
      const middleware = AzureApiAuthMiddleware(allowedGroups);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(
          expect.objectContaining({
            kind: "IResponseErrorForbiddenNotAuthorized"
          })
        )
      );
    });
  });

  describe("AzureAllowBodyPayloadMiddleware", () => {
    // Define a test codec that matches objects with a specific property
    const RestrictedPayload = t.interface({
      sensitiveData: t.string
    });

    it("should allow request when body matches pattern and user has allowed group", async () => {
      const body = {
        sensitiveData: "secret-value"
      };

      const req = createMockRequest({
        headers: { "x-user-groups": "ApiMessageWrite,ApiInfoRead" },
        body: { string: JSON.stringify(body) }
      });
      const context = createMockContext();

      const allowedGroups = new Set([UserGroup.ApiMessageWrite]);
      const middleware = AzureAllowBodyPayloadMiddleware(
        RestrictedPayload,
        allowedGroups
      );
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right([void 0]));
    });

    it("should allow request when body does not match pattern (skip middleware)", async () => {
      const body = {
        otherData: "some-value"
        // Missing sensitiveData property
      };

      const req = createMockRequest({
        headers: {},
        body: { string: JSON.stringify(body) }
      });
      // No x-user-groups header, but it shouldn't matter since pattern doesn't match
      const context = createMockContext();

      const allowedGroups = new Set([UserGroup.ApiMessageWrite]);
      const middleware = AzureAllowBodyPayloadMiddleware(
        RestrictedPayload,
        allowedGroups
      );
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right([void 0]));
    });

    it("should return error when body matches pattern but user has no groups header", async () => {
      const body = {
        sensitiveData: "secret-value"
      };

      const req = createMockRequest({
        headers: {},
        body: { string: JSON.stringify(body) }
      });
      // No x-user-groups header
      const context = createMockContext();

      const allowedGroups = new Set([UserGroup.ApiMessageWrite]);
      const middleware = AzureAllowBodyPayloadMiddleware(
        RestrictedPayload,
        allowedGroups
      );
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(
          expect.objectContaining({
            kind: "IResponseErrorForbiddenNoAuthorizationGroups"
          })
        )
      );
    });

    it("should return error when body matches pattern but user is not in allowed groups", async () => {
      const body = {
        sensitiveData: "secret-value"
      };

      const req = createMockRequest({
        headers: { "x-user-groups": "ApiInfoRead,ApiDebugRead" },
        body: { string: JSON.stringify(body) }
      });
      const context = createMockContext();

      // Only allow ApiMessageWrite, which the user doesn't have
      const allowedGroups = new Set([UserGroup.ApiMessageWrite]);
      const middleware = AzureAllowBodyPayloadMiddleware(
        RestrictedPayload,
        allowedGroups
      );
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(
          expect.objectContaining({
            kind: "IResponseErrorForbiddenNotAuthorized"
          })
        )
      );
    });
  });

  describe("AzureUserAttributesMiddleware", () => {
    it("should extract user attributes with valid headers and existing service", async () => {
      const mockService = {
        serviceId: "test-service-id" as NonEmptyString,
        serviceName: "Test Service" as NonEmptyString,
        version: 1 as any
      };

      const mockServiceModel = {
        findLastVersionByModelId: jest.fn(() => async () =>
          E.right(O.some(mockService))
        )
      } as any;

      const req = createMockRequest({
        headers: {
          "x-user-email": "test@example.com",
          "x-subscription-id": "test-subscription-id"
        }
      });
      const context = createMockContext();

      const middleware = AzureUserAttributesMiddleware(mockServiceModel);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.right([
          expect.objectContaining({
            kind: "IAzureUserAttributes",
            email: "test@example.com",
            service: mockService
          })
        ])
      );
    });

    it("should return error when x-user-email header is missing", async () => {
      const mockServiceModel = {} as any;

      const req = createMockRequest({
        headers: {
          "x-subscription-id": "test-subscription-id"
        }
      });
      const context = createMockContext();

      const middleware = AzureUserAttributesMiddleware(mockServiceModel);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(expect.objectContaining({ kind: "IResponseErrorInternal" }))
      );
    });

    it("should return error when x-subscription-id header is missing", async () => {
      const mockServiceModel = {} as any;

      const req = createMockRequest({
        headers: {
          "x-user-email": "test@example.com"
        }
      });
      const context = createMockContext();

      const middleware = AzureUserAttributesMiddleware(mockServiceModel);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(expect.objectContaining({ kind: "IResponseErrorInternal" }))
      );
    });

    it("should return forbidden error when service is not found", async () => {
      const mockServiceModel = {
        findLastVersionByModelId: jest.fn(() => async () => E.right(O.none))
      } as any;

      const req = createMockRequest({
        headers: {
          "x-user-email": "test@example.com",
          "x-subscription-id": "non-existent-service"
        }
      });
      const context = createMockContext();

      const middleware = AzureUserAttributesMiddleware(mockServiceModel);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(
          expect.objectContaining({
            kind: "IResponseErrorForbiddenNotAuthorized"
          })
        )
      );
    });
  });

  describe("AzureUserAttributesManageMiddleware", () => {
    it("should extract manage attributes with valid MANAGE subscription", async () => {
      const mockCIDRs = new Set(["192.168.1.0/24" as any]);

      const mockSubscriptionCIDRsModel = {
        findLastVersionByModelId: jest.fn(() => async () =>
          E.right(O.some({ cidrs: mockCIDRs }))
        )
      } as any;

      const req = createMockRequest({
        headers: {
          "x-user-email": "admin@example.com",
          "x-subscription-id": "MANAGE-test-subscription"
        }
      });
      const context = createMockContext();

      const middleware = AzureUserAttributesManageMiddleware(
        mockSubscriptionCIDRsModel
      );
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.right([
          expect.objectContaining({
            kind: "IAzureUserAttributesManage",
            email: "admin@example.com",
            authorizedCIDRs: mockCIDRs
          })
        ])
      );
    });

    it("should return forbidden error when subscription does not start with MANAGE-", async () => {
      const mockSubscriptionCIDRsModel = {} as any;

      const req = createMockRequest({
        headers: {
          "x-user-email": "test@example.com",
          "x-subscription-id": "regular-subscription-id"
        }
      });
      const context = createMockContext();

      const middleware = AzureUserAttributesManageMiddleware(
        mockSubscriptionCIDRsModel
      );
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(
          expect.objectContaining({
            kind: "IResponseErrorForbiddenNotAuthorized"
          })
        )
      );
    });

    it("should return error when x-user-email header is missing", async () => {
      const mockSubscriptionCIDRsModel = {} as any;

      const req = createMockRequest({
        headers: {
          "x-subscription-id": "MANAGE-test-subscription"
        }
      });
      const context = createMockContext();

      const middleware = AzureUserAttributesManageMiddleware(
        mockSubscriptionCIDRsModel
      );
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(expect.objectContaining({ kind: "IResponseErrorInternal" }))
      );
    });

    it("should return error when CIDRs are not found for MANAGE subscription", async () => {
      const mockSubscriptionCIDRsModel = {
        findLastVersionByModelId: jest.fn(() => async () => E.right(O.none))
      } as any;

      const req = createMockRequest({
        headers: {
          "x-user-email": "admin@example.com",
          "x-subscription-id": "MANAGE-unknown-subscription"
        }
      });
      const context = createMockContext();

      const middleware = AzureUserAttributesManageMiddleware(
        mockSubscriptionCIDRsModel
      );
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(
        E.left(expect.objectContaining({ kind: "IResponseErrorInternal" }))
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle middleware that returns undefined", async () => {
      const req = createMockRequest();
      const context = createMockContext();

      const middleware = createSuccessMiddleware(undefined);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right([undefined]));
    });

    it("should handle middleware that returns null", async () => {
      const req = createMockRequest();
      const context = createMockContext();

      const middleware = createSuccessMiddleware(null);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right([null]));
    });

    it("should handle middleware that returns complex objects", async () => {
      const req = createMockRequest();
      const context = createMockContext();

      const complexObject = {
        nested: { value: 42 },
        array: [1, 2, 3],
        func: () => "test"
      };

      const middleware = createSuccessMiddleware(complexObject);
      const extractArgs = extractArgsFromMiddlewares(middleware);
      const result = await extractArgs(req, context);

      expect(result).toEqual(E.right([complexObject]));
    });
  });
});
