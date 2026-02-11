/**
 * Shared test helpers for Azure Functions v4 Express Adapter tests
 */

import {
  InvocationContext,
  HttpRequest,
  HttpRequestInit
} from "@azure/functions";

/**
 * Creates a mock InvocationContext for testing
 */
export const createMockContext = (): InvocationContext =>
  (({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    log: jest.fn()
  } as unknown) as InvocationContext);

/**
 * Creates a mock HttpRequest for testing.
 * Uses the real HttpRequest constructor with sensible defaults.
 */
export const createMockRequest = (init?: HttpRequestInit): HttpRequest => {
  const defaultInit: HttpRequestInit = {
    method: init?.body ? "POST" : "GET",
    url: "http://localhost/test",
    params: {}
  };

  return new HttpRequest({ ...defaultInit, ...init });
};
