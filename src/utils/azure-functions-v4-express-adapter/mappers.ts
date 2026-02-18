import { IncomingHttpHeaders } from "http";
import {
  InvocationContext,
  HttpRequest,
  HttpResponseInit
} from "@azure/functions";
import { Request } from "express";
import { ParsedQs } from "qs";
import {
  IResponse,
  HttpStatusCodeEnum
} from "@pagopa/ts-commons/lib/responses";

import { CONTEXT_IDENTIFIER } from "../middlewares/context_middleware";

const CONTENT_TYPE_HEADER = "content-type";

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

  const body = req.body ? await req.json() : undefined;

  return {
    app: {
      // Mocking app.get for ContextMiddleware compatibility
      get: (key: string) => (key === CONTEXT_IDENTIFIER ? context : undefined)
    } as Partial<Request>["app"],
    body,
    header: ((field: string) =>
      headers[field.toLowerCase()] || undefined) as Request["header"],
    headers,
    method: String(req.method),
    params: req.params as Record<string, string>,
    query: query as ParsedQs,
    url: req.url
  };
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
    if (!this.headers[CONTENT_TYPE_HEADER]) {
      this.headers[CONTENT_TYPE_HEADER] = "application/json";
    }
    return this;
  }

  public send(body: unknown): this {
    // Needed for ResponseSuccessAccepted to work
    // https://github.com/pagopa/io-ts-commons/blob/a97327df37fd373a9d74454157832722f2f94adb/src/responses.ts#L171-L172
    if (
      typeof body === "number" &&
      Object.values(HttpStatusCodeEnum).includes(body)
    ) {
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

  const isJson = /json/i.test(
    mockExpressResponse.headers[CONTENT_TYPE_HEADER] ?? ""
  );
  const body = mockExpressResponse.body;

  return {
    headers: mockExpressResponse.headers,
    status: mockExpressResponse.statusCode,
    ...(isJson ? { jsonBody: body } : { body })
  } as HttpResponseInit;
};
