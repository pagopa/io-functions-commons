import * as appInsights from "applicationinsights";
import { Millisecond } from "italia-ts-commons/lib/units";

interface IInsightsRequestData {
  baseType: "RequestData";
  baseData: {
    ver: number;
    properties: {};
    measurements: {};
    id: string;
    name: string;
    url: string;
    source?: string;
    duration: string;
    responseCode: string;
    success: boolean;
  };
}

export interface IInsightsOptions {
  isTracingEnabled: boolean;
  cloudRole: string;
  version: string;
}

/**
 * App Insights is initialized to collect the following informations:
 * - Incoming API calls
 * - Server performance information (CPU, RAM)
 * - Unandled Runtime Exceptions
 * - Outcoming API Calls (dependencies)
 * - Realtime API metrics
 */
export function startAppInsights(
  instrumentationKey: string,
  config: IInsightsOptions &
    Partial<
      Pick<appInsights.TelemetryClient["config"], "httpAgent" | "httpsAgent">
    >
): appInsights.TelemetryClient {
  const ai = appInsights
    .setup(instrumentationKey)
    .setAutoDependencyCorrelation(config.isTracingEnabled)
    .setAutoCollectRequests(config.isTracingEnabled)
    .setAutoCollectPerformance(config.isTracingEnabled)
    .setAutoCollectExceptions(config.isTracingEnabled)
    .setAutoCollectDependencies(config.isTracingEnabled)
    .setAutoCollectConsole(config.isTracingEnabled)
    .setSendLiveMetrics(config.isTracingEnabled)
    // see https://stackoverflow.com/questions/49438235/application-insights-metric-in-aws-lambda/49441135#49441135
    .setUseDiskRetryCaching(false);

  appInsights.defaultClient.addTelemetryProcessor(
    removeQueryParamsPreprocessor
  );

  // Configure the data context of the telemetry client
  // refering to the current application version with a specific CloudRole

  // tslint:disable-next-line: no-object-mutation
  appInsights.defaultClient.context.tags[
    appInsights.defaultClient.context.keys.applicationVersion
  ] = config.version;

  // tslint:disable-next-line: no-object-mutation
  appInsights.defaultClient.context.tags[
    appInsights.defaultClient.context.keys.cloudRole
  ] = config.cloudRole;

  if (config.httpAgent !== undefined) {
    // tslint:disable-next-line: no-object-mutation
    appInsights.defaultClient.config.httpAgent = config.httpAgent;
  }

  if (config.httpsAgent !== undefined) {
    // tslint:disable-next-line: no-object-mutation
    appInsights.defaultClient.config.httpsAgent = config.httpsAgent;
  }

  ai.start();
  return appInsights.defaultClient;
}

export function removeQueryParamsPreprocessor(
  envelope: appInsights.Contracts.Envelope,
  _?: {
    [name: string]: unknown;
  }
): boolean {
  if (envelope.data.baseType === "RequestData") {
    const originalUrl = (envelope.data as IInsightsRequestData).baseData.url;
    // tslint:disable-next-line: no-object-mutation
    (envelope.data as IInsightsRequestData).baseData.url = originalUrl.split(
      "?"
    )[0];
  }
  return true;
}

const NANOSEC_PER_MILLISEC = 1e6;
const MILLISEC_PER_SEC = 1e3;

/**
 * Small helper function that gets the difference in milliseconds
 * from an initial time obtained calling process.hrtime().
 * Used when profiling code.
 */
// tslint:disable-next-line:readonly-array
export function diffInMilliseconds(startHrtime: [number, number]): Millisecond {
  const diff = process.hrtime(startHrtime);
  return (diff[0] * MILLISEC_PER_SEC +
    diff[1] / NANOSEC_PER_MILLISEC) as Millisecond;
}
