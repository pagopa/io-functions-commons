/**
 * Tests for iResponseToHttpResponse functionality
 * Tests the conversion of all IResponse types to Azure Functions response format
 */

import {
  ResponseSuccessJson,
  ResponseSuccessXml,
  ResponseSuccessAccepted,
  ResponseSuccessNoContent,
  ResponseSuccessRedirectToResource,
  ResponsePermanentRedirect,
  ResponseSeeOtherRedirect,
  ResponseErrorValidation,
  ResponseErrorNotFound,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorForbiddenNotAuthorizedForProduction,
  ResponseErrorForbiddenNotAuthorizedForRecipient,
  ResponseErrorForbiddenNotAuthorizedForDefaultAddresses,
  ResponseErrorForbiddenAnonymousUser,
  ResponseErrorForbiddenNoAuthorizationGroups,
  ResponseErrorConflict,
  ResponseErrorPreconditionFailed,
  ResponseErrorTooManyRequests,
  ResponseErrorInternal,
  ResponseErrorBadGateway,
  ResponseErrorServiceUnavailable,
  ResponseErrorGatewayTimeout,
  ResponseErrorGone
} from "@pagopa/ts-commons/lib/responses";
import { UrlFromString } from "@pagopa/ts-commons/lib/url";
import * as E from "fp-ts/lib/Either";

import { iResponseToHttpResponse } from "../mappers";

describe("iResponseToHttpResponse", () => {
  describe("Success responses", () => {
    it("should convert ResponseSuccessJson correctly", () => {
      const testData = { id: "123", name: "Test" };
      const iresponse = ResponseSuccessJson(testData);

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toEqual({
        status: 200,
        headers: { ["content-type"]: "application/json" },
        jsonBody: testData
      });
    });

    it("should convert ResponseSuccessXml correctly", () => {
      const xmlData = '<?xml version="1.0"?><root>test</root>';
      const iresponse = ResponseSuccessXml(xmlData);

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toEqual({
        status: 200,
        headers: { ["content-type"]: "application/xml" },
        jsonBody: xmlData
      });
    });

    it("should convert ResponseSuccessAccepted without payload", () => {
      const iresponse = ResponseSuccessAccepted();

      const result = iResponseToHttpResponse(iresponse);

      expect(result.status).toBe(202);
      expect(result.jsonBody).toBeUndefined();
    });

    it("should convert ResponseSuccessAccepted with payload", () => {
      const payload = { status: "processing" };
      const iresponse = ResponseSuccessAccepted("Request accepted", payload);

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toEqual({
        status: 202,
        headers: { ["content-type"]: "application/json" },
        jsonBody: payload
      });
    });

    it("should convert ResponseSuccessNoContent correctly", () => {
      const iresponse = ResponseSuccessNoContent();

      const result = iResponseToHttpResponse(iresponse);

      expect(result.status).toBe(204);
      expect(result.jsonBody).toBeUndefined();
    });

    it("should convert ResponseSuccessRedirectToResource correctly", () => {
      const resource = { id: "123" };
      const url = "/api/resource/123";
      const payload = { created: true };
      const iresponse = ResponseSuccessRedirectToResource(
        resource,
        url,
        payload
      );

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toEqual({
        status: 201,
        headers: {
          location: url,
          ["content-type"]: "application/json"
        },
        jsonBody: payload
      });
    });
  });

  describe("Redirect responses", () => {
    it("should convert ResponsePermanentRedirect correctly", () => {
      const urlResult = UrlFromString.decode("https://example.com/redirect");
      if (E.isLeft(urlResult)) {
        throw new Error("Invalid URL");
      }

      const iresponse = ResponsePermanentRedirect(urlResult.right);
      const result = iResponseToHttpResponse(iresponse);

      expect(result).toEqual({
        status: 301,
        headers: {
          location: "https://example.com/redirect"
        }
      });
    });

    it("should convert ResponseSeeOtherRedirect correctly", () => {
      const urlResult = UrlFromString.decode("https://example.com/other");
      if (E.isLeft(urlResult)) {
        throw new Error("Invalid URL");
      }

      const iresponse = ResponseSeeOtherRedirect(urlResult.right);
      const result = iResponseToHttpResponse(iresponse);

      expect(result).toEqual({
        status: 303,
        headers: {
          location: "https://example.com/other"
        }
      });
    });
  });

  describe("Error responses - 4xx", () => {
    it("should convert ResponseErrorValidation correctly", () => {
      const iresponse = ResponseErrorValidation(
        "Invalid input",
        "Field is required"
      );

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toEqual({
        status: 400,
        headers: {
          ["content-type"]: "application/problem+json"
        },
        jsonBody: {
          status: 400,
          title: "Invalid input",
          detail: "Field is required"
        }
      });
    });

    it("should convert ResponseErrorNotFound correctly", () => {
      const iresponse = ResponseErrorNotFound(
        "Resource not found",
        "User with id 123"
      );

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toMatchObject({
        status: 404,
        headers: {
          ["content-type"]: "application/problem+json"
        },
        jsonBody: {
          status: 404,
          title: "Resource not found"
        }
      });
    });

    it("should convert ResponseErrorForbiddenNotAuthorized correctly", () => {
      const iresponse = ResponseErrorForbiddenNotAuthorized;

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toMatchObject({
        status: 403,
        headers: {
          ["content-type"]: "application/problem+json"
        },
        jsonBody: {
          status: 403,
          title: "You are not allowed here"
        }
      });
    });

    it("should convert ResponseErrorForbiddenNotAuthorizedForProduction correctly", () => {
      const iresponse = ResponseErrorForbiddenNotAuthorizedForProduction;

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toMatchObject({
        status: 403,
        headers: {
          ["content-type"]: "application/problem+json"
        },
        jsonBody: {
          title: "Production call forbidden"
        }
      });
    });

    it("should convert ResponseErrorForbiddenNotAuthorizedForRecipient correctly", () => {
      const iresponse = ResponseErrorForbiddenNotAuthorizedForRecipient;

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toMatchObject({
        status: 403,
        headers: {
          ["content-type"]: "application/problem+json"
        }
      });
    });

    it("should convert ResponseErrorForbiddenNotAuthorizedForDefaultAddresses correctly", () => {
      const iresponse = ResponseErrorForbiddenNotAuthorizedForDefaultAddresses;

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toMatchObject({
        status: 403,
        headers: {
          ["content-type"]: "application/problem+json"
        }
      });
    });

    it("should convert ResponseErrorForbiddenAnonymousUser correctly", () => {
      const iresponse = ResponseErrorForbiddenAnonymousUser;

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toMatchObject({
        status: 403,
        headers: {
          ["content-type"]: "application/problem+json"
        },
        jsonBody: {
          title: "Anonymous user"
        }
      });
    });

    it("should convert ResponseErrorForbiddenNoAuthorizationGroups correctly", () => {
      const iresponse = ResponseErrorForbiddenNoAuthorizationGroups;

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toMatchObject({
        status: 403,
        headers: {
          ["content-type"]: "application/problem+json"
        },
        jsonBody: {
          title: "User has no valid scopes"
        }
      });
    });

    it("should convert ResponseErrorConflict correctly", () => {
      const iresponse = ResponseErrorConflict("Resource already exists");

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toMatchObject({
        status: 409,
        headers: {
          ["content-type"]: "application/problem+json"
        },
        jsonBody: {
          title: "Conflict",
          detail: "Resource already exists"
        }
      });
    });

    it("should convert ResponseErrorPreconditionFailed correctly", () => {
      const iresponse = ResponseErrorPreconditionFailed("ETag mismatch");

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toMatchObject({
        status: 412,
        headers: {
          ["content-type"]: "application/problem+json"
        },
        jsonBody: {
          title: "Precondition Failed",
          detail: "ETag mismatch"
        }
      });
    });

    it("should convert ResponseErrorTooManyRequests correctly", () => {
      const iresponse = ResponseErrorTooManyRequests("Rate limit exceeded");

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toMatchObject({
        status: 429,
        headers: {
          ["content-type"]: "application/problem+json"
        },
        jsonBody: {
          title: "Too many requests",
          detail: "Rate limit exceeded"
        }
      });
    });

    it("should convert ResponseErrorGone correctly", () => {
      const iresponse = ResponseErrorGone("Resource permanently deleted");

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toMatchObject({
        status: 410,
        headers: {
          ["content-type"]: "application/json"
        },
        jsonBody: {
          detail: "Resource permanently deleted"
        }
      });
    });
  });

  describe("Error responses - 5xx", () => {
    it("should convert ResponseErrorInternal correctly", () => {
      const iresponse = ResponseErrorInternal("Database connection failed");

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toMatchObject({
        status: 500,
        headers: {
          ["content-type"]: "application/problem+json"
        },
        jsonBody: {
          title: "Internal server error",
          detail: "Database connection failed"
        }
      });
    });

    it("should convert ResponseErrorBadGateway correctly", () => {
      const iresponse = ResponseErrorBadGateway("Upstream service error");

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toMatchObject({
        status: 502,
        headers: {
          ["content-type"]: "application/problem+json"
        },
        jsonBody: {
          title: "Bad Gateway",
          detail: "Upstream service error"
        }
      });
    });

    it("should convert ResponseErrorServiceUnavailable correctly", () => {
      const iresponse = ResponseErrorServiceUnavailable("Service is down");

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toMatchObject({
        status: 503,
        headers: {
          ["content-type"]: "application/problem+json"
        },
        jsonBody: {
          title: "Service temporarily unavailable",
          detail: "Service is down"
        }
      });
    });

    it("should convert ResponseErrorGatewayTimeout correctly", () => {
      const iresponse = ResponseErrorGatewayTimeout("Upstream timeout");

      const result = iResponseToHttpResponse(iresponse);

      expect(result).toMatchObject({
        status: 504,
        headers: {
          ["content-type"]: "application/problem+json"
        },
        jsonBody: {
          title: "Gateway Timeout",
          detail: "Upstream timeout"
        }
      });
    });
  });
});
