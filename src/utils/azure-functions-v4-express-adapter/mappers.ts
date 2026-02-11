import { IncomingHttpHeaders } from "http";
import {
  InvocationContext,
  HttpRequest,
  HttpResponseInit
} from "@azure/functions";
import { Request } from "express";
import { ParsedQs } from "qs";
import { IResponse } from "@pagopa/ts-commons/lib/responses";

// -----------------------------------------------------
// HTTP Request mapping from Azure Functions to Express
// -----------------------------------------------------

// Minimal mapping from Azure HttpRequest to Express Request
export const functionRequestToExpressRequest = async (
  req: HttpRequest,
  context: InvocationContext
): Promise<Partial<Request>> => {
  // Convert headers to plain object (Express expects IncomingHttpHeaders)
  const headers: IncomingHttpHeaders = Object.fromEntries(
    Array.from(req.headers.entries()).map(([key, value]) => [
      key.toLowerCase(),
      value
    ])
  );

  // Convert query to plain object (Express expects ParsedQs)
  const query = Object.fromEntries(req.query.entries());

  // eslint-disable-next-line functional/no-let
  let body;
  try {
    body = req.body ? await req.json() : undefined;
  } catch {
    throw new Error("Invalid JSON body");
  }

  // eslint-disable-next-line sonarjs/prefer-immediate-return
  const expressReq: Partial<Request> = {
    app: {
      // Mocking app.get for ContextMiddleware compatibility
      // @ts-expect-error - Type mismatch between Azure and Express
      get: (key: string) => (key === "context" ? context : undefined)
    },
    body,
    // @ts-expect-error - Simplified header accessor
    header: (field: string) => headers[field.toLowerCase()] || undefined,
    headers,
    method: String(req.method),
    params: req.params as Record<string, string>,
    query: query as ParsedQs,
    url: req.url
  };

  return expressReq;
};

// -----------------------------------------------------
// HTTP Response mapping from Express to Azure Functions
// -----------------------------------------------------

/* eslint-disable functional/no-class, functional/no-this-expression */
/* eslint-disable functional/prefer-readonly-type, functional/immutable-data */
class MockExpressResponse {
  public statusCode = 200;
  public headers: Record<string, string> = {};
  public body?: unknown;

  public status(code: number): this {
    this.statusCode = code;
    return this;
  }

  public set(field: string, value: string): this {
    this.headers[field.toLowerCase()] = value;
    return this;
  }

  public json(obj: unknown): this {
    this.body = obj;
    if (!this.headers["content-type"]) {
      this.headers["content-type"] = "application/json";
    }
    return this;
  }

  public send(body: unknown): this {
    if (typeof body === "number") {
      this.statusCode = body;
    } else {
      this.body = body;
    }
    return this;
  }

  public redirect(statusOrUrl: number | string, url?: string): this {
    if (typeof statusOrUrl === "number") {
      this.statusCode = statusOrUrl;
      if (url) {
        this.headers.location = url;
      }
    } else {
      this.statusCode = 302;
      this.headers.location = statusOrUrl;
    }
    return this;
  }
}
/* eslint-enable functional/no-class, functional/no-this-expression */
/* eslint-enable functional/prefer-readonly-type, functional/immutable-data */

/**
 * Converts IResponse to Azure Functions response format.
 * Works by creating a mock Express response and extracting the result.
 */
export const iResponseToHttpResponse = <T>(
  iresponse: IResponse<T>
): HttpResponseInit => {
  const mockExpressResponse = new MockExpressResponse();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  iresponse.apply(mockExpressResponse as any);

  return {
    headers: mockExpressResponse.headers,
    jsonBody: mockExpressResponse.body,
    status: mockExpressResponse.statusCode
  };
};
