import * as appInsights from "applicationinsights";
import { Configuration } from "applicationinsights";
import {
  initAppInsights,
  removeQueryParamsPreprocessor,
  withAppInsightsContext
} from "../application_insights";

describe("Create an App Insights Telemetry Client", () => {
  const mockSetAutoCollectRequests = jest.fn();
  const mockSetAutoCollectPerformance = jest.fn();
  const mockSetAutoCollectExceptions = jest.fn();
  const mockSetAutoCollectDependencies = jest.fn();
  const mockSetAutoCollectConsole = jest.fn();
  const mockSetAutoDependencyCorrelation = jest.fn();
  const mockSetDistributedTracingMode = jest.fn();
  const mockSetUseDiskRetryCaching = jest.fn();
  const mockSetSendLiveMetrics = jest.fn();
  const mockStart = jest.fn();

  const mockedConfiguration: Configuration = {
    setAutoCollectConsole: mockSetAutoCollectConsole,
    setAutoCollectDependencies: mockSetAutoCollectDependencies,
    setAutoCollectExceptions: mockSetAutoCollectExceptions,
    setAutoCollectPerformance: mockSetAutoCollectPerformance,
    setAutoCollectRequests: mockSetAutoCollectRequests,
    setAutoDependencyCorrelation: mockSetAutoDependencyCorrelation,
    setDistributedTracingMode: mockSetDistributedTracingMode,
    setSendLiveMetrics: mockSetSendLiveMetrics,
    setUseDiskRetryCaching: mockSetUseDiskRetryCaching,
    start: mockStart
  };

  mockSetAutoCollectConsole.mockImplementation(() => mockedConfiguration);
  mockSetAutoCollectDependencies.mockImplementation(() => mockedConfiguration);
  mockSetAutoCollectExceptions.mockImplementation(() => mockedConfiguration);
  mockSetAutoCollectPerformance.mockImplementation(() => mockedConfiguration);
  mockSetAutoCollectRequests.mockImplementation(() => mockedConfiguration);
  mockSetAutoDependencyCorrelation.mockImplementation(
    () => mockedConfiguration
  );
  mockSetDistributedTracingMode.mockImplementation(() => mockedConfiguration);
  mockSetUseDiskRetryCaching.mockImplementation(() => mockedConfiguration);

  const mockSetup = jest
    .spyOn(appInsights, "setup")
    // tslint:disable-next-line: no-any
    .mockImplementation(() => mockedConfiguration as any);
  const mockAddTelemetryProcessor = jest.fn();

  const expectedTelemetryClient = {
    addTelemetryProcessor: mockAddTelemetryProcessor,
    context: {
      keys: {
        applicationVersion: "ai.application.ver",
        cloudRole: "ai.cloud.role"
      },
      tags: {}
    }
  };

  // Override defaultClient readonly property for testing purpose
  Object.defineProperty(appInsights, "defaultClient", {
    value: expectedTelemetryClient
  });

  const expectedAppInsightsKey = "SECRET-KEY";

  it("should create a new App Insights Telemetry Client with tracing enabled", () => {
    // tslint:disable-next-line: no-unused-expression
    const telemetryClient = initAppInsights(
      expectedAppInsightsKey,
      {},
      {
        applicationVersion: "1.1.1",
        cloudRole: "ai.role"
      }
    );
    expect(mockSetup).toBeCalledWith(expectedAppInsightsKey);
    expect(mockSetAutoDependencyCorrelation).not.toBeCalled();
    expect(mockAddTelemetryProcessor).toBeCalledWith(
      removeQueryParamsPreprocessor
    );
    expect(telemetryClient).toEqual(expectedTelemetryClient);
  });

  it("should create a new App Insights Telemetry Client with tracing disabled", () => {
    // tslint:disable-next-line: no-unused-expression
    const telemetryClient = initAppInsights(
      expectedAppInsightsKey,
      {},
      {
        applicationVersion: "1.1.1",
        cloudRole: "ai.role",
        isTracingDisabled: true
      }
    );
    expect(mockSetup).toBeCalledWith(expectedAppInsightsKey);
    expect(mockSetAutoDependencyCorrelation).toBeCalledWith(false);
    expect(mockAddTelemetryProcessor).toBeCalledWith(
      removeQueryParamsPreprocessor
    );
    expect(telemetryClient).toEqual(expectedTelemetryClient);
  });
});

describe("Wrap an handler with Application Insights context", () => {
  it("should return the handler value", async () => {
    const handler = (a: string, b: number) => `${a}${b}`;
    const ret = withAppInsightsContext(
      {
        executionContext: {
          functionName: "foo"
        },
        invocationId: "123"
        // tslint:disable-next-line: no-any
      } as any,
      () => handler("bar", 2)
    );
    expect(ret).toEqual("bar2");
  });
});

describe("Custom Telemetry Preprocessor", () => {
  it("should remove query params from http requests", () => {
    const expectedUrl = "https://test-url.com";
    const testValidEnvelope = {
      data: {
        baseData: {
          duration: 1,
          id: "ID",
          measurements: {},
          name: "GET /test",
          properties: {},
          responseCode: 200,
          success: true,
          url: `${expectedUrl}?param1=true&param2=false`,
          ver: 1
        },
        baseType: "RequestData"
      }
    };
    removeQueryParamsPreprocessor(
      (testValidEnvelope as unknown) as appInsights.Contracts.Envelope
    );
    expect(testValidEnvelope.data.baseData.url).toEqual(expectedUrl);
  });
});
