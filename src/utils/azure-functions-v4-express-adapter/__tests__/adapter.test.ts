/**
 * Integration tests for wrapHandlerV4
 * Tests the complete flow from Azure Function request to response
 * For detailed convertIResponse tests, see convert-iresponse.test.ts
 */
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";

import {
  ResponseSuccessJson,
  ResponseErrorNotFound,
  ResponseErrorValidation
} from "@pagopa/ts-commons/lib/responses";

import { FiscalCodeMiddleware } from "../../middlewares/fiscalcode";
import { RequiredParamMiddleware } from "../../middlewares/required_param";
import { RequiredBodyPayloadMiddleware } from "../../middlewares/required_body_payload";
import { ServiceId } from "../../../../generated/definitions/ServiceId";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";
import { createMockContext, createMockRequest } from "./test-utils";
import {
  ClientIp,
  ClientIpMiddleware
} from "../../middlewares/client_ip_middleware";
import {
  AzureUserAttributesMiddleware,
  IAzureUserAttributes
} from "../../middlewares/azure_user_attributes";

import { wrapHandlerV4 } from "../adapter";
import {
  checkSourceIpForHandler,
  clientIPAndCidrTuple
} from "../../source_ip_check";
import { IAzureUserAttributesManage } from "../../middlewares/azure_user_attributes_manage";
import { toAuthorizedCIDRs } from "../../../models/service";

describe("wrapHandlerV4 - Integration tests", () => {
  describe("Basic handler execution", () => {
    it("should execute handler with no middlewares and return success response", async () => {
      const handler = wrapHandlerV4([], async () =>
        ResponseSuccessJson({ message: "Hello World" })
      );

      const req = createMockRequest();
      const context = createMockContext();

      const response = await handler(req, context);

      expect(response.status).toBe(200);
      expect(response.jsonBody).toEqual({ message: "Hello World" });
      expect(
        (response.headers as Record<string, string>)?.["content-type"]
      ).toBe("application/json");
    });

    it("should execute handler with single middleware", async () => {
      const handler = wrapHandlerV4(
        [FiscalCodeMiddleware],
        async (fiscalCode: FiscalCode) => ResponseSuccessJson({ fiscalCode })
      );

      const req = createMockRequest({
        params: { fiscalcode: "AAAAAA00A00A000A" }
      });
      const context = createMockContext();

      const response = await handler(req, context);

      expect(response.status).toBe(200);
      expect(response.jsonBody).toEqual({ fiscalCode: "AAAAAA00A00A000A" });
    });

    it("should execute handler with multiple middlewares", async () => {
      const handler = wrapHandlerV4(
        [
          FiscalCodeMiddleware,
          RequiredParamMiddleware("serviceid", ServiceId)
        ] as const,
        async (fiscalCode: FiscalCode, serviceId: ServiceId) =>
          ResponseSuccessJson({ fiscalCode, serviceId })
      );

      const req = createMockRequest({
        params: {
          fiscalcode: "AAAAAA00A00A000A",
          serviceid: "test-service-123"
        }
      });
      const context = createMockContext();

      const response = await handler(req, context);

      expect(response.status).toBe(200);
      expect(response.jsonBody).toEqual({
        fiscalCode: "AAAAAA00A00A000A",
        serviceId: "test-service-123"
      });
    });
  });

  describe("Middleware validation errors", () => {
    it("should return validation error when middleware fails", async () => {
      const handler = wrapHandlerV4(
        [FiscalCodeMiddleware],
        async (fiscalCode: FiscalCode) => ResponseSuccessJson({ fiscalCode })
      );

      const req = createMockRequest({
        params: { fiscalcode: "INVALID" }
      });
      const context = createMockContext();

      const response = await handler(req, context);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toHaveProperty("title");
    });

    it("should stop at first failing middleware", async () => {
      const handler = wrapHandlerV4(
        [
          FiscalCodeMiddleware,
          RequiredParamMiddleware("serviceid", ServiceId)
        ] as const,
        async (fiscalCode: FiscalCode, serviceId: ServiceId) =>
          ResponseSuccessJson({ fiscalCode, serviceId })
      );

      const req = createMockRequest({
        params: {
          fiscalcode: "INVALID", // This will fail first
          serviceid: "test-service-123"
        }
      });
      const context = createMockContext();

      const response = await handler(req, context);

      expect(response.status).toBe(400);
      // Should be validation error from FiscalCodeMiddleware
      expect(response.jsonBody).toHaveProperty("title");
    });
  });

  describe("Handler response types", () => {
    it("should handle ResponseSuccessJson", async () => {
      const handler = wrapHandlerV4([], async () =>
        ResponseSuccessJson({ data: "test" })
      );

      const req = createMockRequest();
      const context = createMockContext();

      const response = await handler(req, context);

      expect(response.status).toBe(200);
      expect(response.jsonBody).toEqual({ data: "test" });
      expect(
        (response.headers as Record<string, string>)?.["content-type"]
      ).toBe("application/json");
    });

    it("should handle ResponseErrorNotFound", async () => {
      const handler = wrapHandlerV4([], async () =>
        ResponseErrorNotFound("Resource not found", "Details here")
      );

      const req = createMockRequest();
      const context = createMockContext();

      const response = await handler(req, context);

      expect(response.status).toBe(404);
      expect(response.jsonBody).toHaveProperty("title", "Resource not found");
      expect(response.jsonBody).toHaveProperty("detail", "Details here");
    });

    it("should handle ResponseErrorValidation", async () => {
      const handler = wrapHandlerV4([], async () =>
        ResponseErrorValidation("Validation failed", "Invalid input")
      );

      const req = createMockRequest();
      const context = createMockContext();

      const response = await handler(req, context);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toHaveProperty("title", "Validation failed");
    });
  });

  describe("Request body handling", () => {
    it("should parse JSON body correctly", async () => {
      const TestBody = t.interface({
        name: NonEmptyString,
        age: t.number
      });

      const handler = wrapHandlerV4(
        [RequiredBodyPayloadMiddleware(TestBody)],
        async (body: t.TypeOf<typeof TestBody>) =>
          ResponseSuccessJson({ received: body })
      );

      const expectedBody = { name: "John", age: 30 };
      const req = createMockRequest({
        method: "POST",
        body: { string: JSON.stringify(expectedBody) }
      });
      const context = createMockContext();
      const response = await handler(req, context);
      expect(response.status).toBe(200);
      expect(response.jsonBody).toEqual({
        received: expectedBody
      });
    });

    it("should return validation error for invalid body", async () => {
      const TestBody = t.interface({
        name: NonEmptyString,
        age: t.number
      });

      const handler = wrapHandlerV4(
        [RequiredBodyPayloadMiddleware(TestBody)],
        async (body: t.TypeOf<typeof TestBody>) =>
          ResponseSuccessJson({ received: body })
      );

      const req = createMockRequest({
        method: "POST",
        body: { string: JSON.stringify({ name: "", age: 30 }) } // Empty name is invalid
      });
      const context = createMockContext();

      const response = await handler(req, context);

      expect(response.status).toBe(400);
    });
  });

  describe("Error handling", () => {
    it("should catch handler exceptions and return internal server error", async () => {
      const handler = wrapHandlerV4([], async () => {
        throw new Error("Something went wrong");
      });

      const req = createMockRequest();
      const context = createMockContext();

      const response = await handler(req, context);

      expect(response.status).toBe(500);
      expect(context.error).toHaveBeenCalledWith(
        "Unexpected Internal Server Error:",
        expect.any(Error)
      );
      expect(response.jsonBody).toHaveProperty("title");
    });

    it("should handle non-Error exceptions", async () => {
      const handler = wrapHandlerV4([], async () => {
        // eslint-disable-next-line no-throw-literal
        throw "string error";
      });

      const req = createMockRequest();
      const context = createMockContext();

      const response = await handler(req, context);

      expect(response.status).toBe(500);
      expect(response.jsonBody).toHaveProperty("title");
    });
  });

  describe("Complex integration scenarios", () => {
    it("should handle complex flow with multiple middlewares and body", async () => {
      const TestBody = t.interface({
        message: NonEmptyString
      });

      const middlewares = [
        FiscalCodeMiddleware,
        RequiredParamMiddleware("serviceid", ServiceId),
        RequiredBodyPayloadMiddleware(TestBody)
      ] as const;

      const handler = wrapHandlerV4(
        middlewares,
        async (
          fiscalCode: FiscalCode,
          serviceId: ServiceId,
          body: t.TypeOf<typeof TestBody>
        ) =>
          ResponseSuccessJson({
            fiscalCode,
            serviceId,
            message: body.message
          })
      );

      const req = createMockRequest({
        method: "POST",
        params: {
          fiscalcode: "AAAAAA00A00A000A",
          serviceid: "service-123"
        },
        body: { string: JSON.stringify({ message: "Hello" }) }
      });
      const context = createMockContext();

      const response = await handler(req, context);

      expect(response.status).toBe(200);
      expect(response.jsonBody).toEqual({
        fiscalCode: "AAAAAA00A00A000A",
        serviceId: "service-123",
        message: "Hello"
      });
    });

    const mockService = {
      serviceId: "test-service-id" as NonEmptyString,
      serviceName: "Test Service" as NonEmptyString,
      authorizedCIDRs: toAuthorizedCIDRs(["192.168.1.0/24"]),
      version: 1 as any
    };

    const mockServiceModel = {
      findLastVersionByModelId: jest.fn(() => async () =>
        E.right(O.some(mockService))
      )
    } as any;
    const middleware = [
      ClientIpMiddleware,
      AzureUserAttributesMiddleware(mockServiceModel)
    ] as const;

    const handler = async (
      clientIp: ClientIp,
      _userAttributes: IAzureUserAttributes | IAzureUserAttributesManage
    ) =>
      ResponseSuccessJson({
        clientIp
      });

    const req = createMockRequest({
      method: "GET",
      headers: {
        "x-forwarded-for": "192.168.1.1",
        "x-user-email": "test@example.com",
        "x-subscription-id": "test-subscription-id"
      }
    });
    const context = createMockContext();

    it("should handle checkSourceIpForHandler middleware correctly when passing valid IP and userAttributes", async () => {
      const wrappedHandler = wrapHandlerV4(
        middleware,
        checkSourceIpForHandler(handler, (c, u) => clientIPAndCidrTuple(c, u))
      );

      const result = await wrappedHandler(req, context);

      expect(result).toEqual({
        status: 200,
        headers: expect.any(Object),
        jsonBody: {
          clientIp: O.some("192.168.1.1")
        }
      });
    });

    it("should handle checkSourceIpForHandler middleware correctly when passing valid non-matching IP", async () => {
      const wrappedHandler = wrapHandlerV4(
        middleware,
        checkSourceIpForHandler(handler, (c, u) => clientIPAndCidrTuple(c, u))
      );
      const invalidReq = createMockRequest({
        method: "GET",
        headers: {
          "x-forwarded-for": "192.167.1.1",
          "x-user-email": "test@example.com",
          "x-subscription-id": "test-subscription-id"
        }
      });

      const result = await wrappedHandler(invalidReq, context);

      expect(result).toEqual({
        status: 403,
        headers: expect.any(Object),
        jsonBody: {
          detail:
            "You do not have enough permission to complete the operation you requested",
          status: 403,
          title: "You are not allowed here"
        }
      });
    });
  });

  describe("Security headers", () => {
    const expectedSecurityHeaders = {
      "Content-Security-Policy":
        "default-src 'none'; upgrade-insecure-requests",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Origin-Agent-Cluster": "?1",
      "Referrer-Policy": "no-referrer",
      "Strict-Transport-Security": "max-age=15552000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
      "X-DNS-Prefetch-Control": "off",
      "X-Download-Options": "noopen",
      "X-Frame-Options": "DENY",
      "X-Permitted-Cross-Domain-Policies": "none",
      "X-XSS-Protection": "0"
    };

    it("should add security headers to successful responses", async () => {
      const handler = wrapHandlerV4([], async () =>
        ResponseSuccessJson({ message: "Hello World" })
      );

      const req = createMockRequest();
      const context = createMockContext();

      const response = await handler(req, context);

      expect(response.status).toBe(200);
      const headers = response.headers as Record<string, string>;

      Object.entries(expectedSecurityHeaders).forEach(([key, value]) => {
        expect(headers[key]).toBe(value);
      });
    });

    it("should add security headers to middleware validation error responses", async () => {
      const handler = wrapHandlerV4(
        [FiscalCodeMiddleware],
        async (fiscalCode: FiscalCode) => ResponseSuccessJson({ fiscalCode })
      );

      const req = createMockRequest({
        params: { fiscalcode: "INVALID" }
      });
      const context = createMockContext();

      const response = await handler(req, context);

      expect(response.status).toBe(400);
      const headers = response.headers as Record<string, string>;

      Object.entries(expectedSecurityHeaders).forEach(([key, value]) => {
        expect(headers[key]).toBe(value);
      });
    });

    it("should add security headers to handler error responses", async () => {
      const handler = wrapHandlerV4([], async () =>
        ResponseErrorNotFound("Not found", "Resource does not exist")
      );

      const req = createMockRequest();
      const context = createMockContext();

      const response = await handler(req, context);

      expect(response.status).toBe(404);
      const headers = response.headers as Record<string, string>;

      Object.entries(expectedSecurityHeaders).forEach(([key, value]) => {
        expect(headers[key]).toBe(value);
      });
    });

    it("should add security headers to exception responses", async () => {
      const handler = wrapHandlerV4([], async () => {
        throw new Error("Something went wrong");
      });

      const req = createMockRequest();
      const context = createMockContext();

      const response = await handler(req, context);

      expect(response.status).toBe(500);
      const headers = response.headers as Record<string, string>;

      Object.entries(expectedSecurityHeaders).forEach(([key, value]) => {
        expect(headers[key]).toBe(value);
      });
    });

    it("should preserve existing headers while adding security headers", async () => {
      const handler = wrapHandlerV4([], async () =>
        ResponseSuccessJson({ data: "test" })
      );

      const req = createMockRequest();
      const context = createMockContext();

      const response = await handler(req, context);

      expect(response.status).toBe(200);
      const headers = response.headers as Record<string, string>;

      // Should have both content-type (from IResponse) and security headers
      expect(headers["content-type"]).toBe("application/json");

      Object.entries(expectedSecurityHeaders).forEach(([key, value]) => {
        expect(headers[key]).toBe(value);
      });
    });
  });
});
