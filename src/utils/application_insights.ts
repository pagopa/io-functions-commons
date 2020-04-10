import { Context } from "@azure/functions";
import * as appInsights from "applicationinsights";
import { DistributedTracingModes } from "applicationinsights";
// tslint:disable-next-line: no-submodule-imports
import { CorrelationContextManager } from "applicationinsights/out/AutoCollection/CorrelationContextManager";
import { agent } from "italia-ts-commons";
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
  isTracingDisabled?: boolean;
  cloudRole?: string;
  applicationVersion?: string;
}

/**
 * Internal usage, do not export
 */
function startAppInsights(
  instrumentationKey: string,
  config: IInsightsOptions &
    Partial<
      Pick<appInsights.TelemetryClient["config"], "httpAgent" | "httpsAgent">
    >
): appInsights.TelemetryClient {
  const ai = appInsights.setup(instrumentationKey);

  if (config.isTracingDisabled) {
    ai.setAutoCollectConsole(false)
      .setAutoCollectPerformance(false)
      .setAutoCollectDependencies(false)
      .setAutoCollectRequests(false)
      .setAutoDependencyCorrelation(false)
      .setSendLiveMetrics(false);
  }

  // @see https://github.com/Azure/azure-functions-host/issues/3747
  // @see https://github.com/Azure/azure-functions-nodejs-worker/pull/244
  ai.setDistributedTracingMode(DistributedTracingModes.AI_AND_W3C)
    // @see https://stackoverflow.com/questions/49438235/application-insights-metric-in-aws-lambda/49441135#49441135
    .setUseDiskRetryCaching(false)
    .start();

  appInsights.defaultClient.addTelemetryProcessor(
    removeQueryParamsPreprocessor
  );

  // Configure the data context of the telemetry client
  // refering to the current application version with a specific CloudRole

  if (config.applicationVersion !== undefined) {
    // tslint:disable-next-line: no-object-mutation
    appInsights.defaultClient.context.tags[
      appInsights.defaultClient.context.keys.applicationVersion
    ] = config.applicationVersion;
  }

  if (config.cloudRole !== undefined) {
    // tslint:disable-next-line: no-object-mutation
    appInsights.defaultClient.context.tags[
      appInsights.defaultClient.context.keys.cloudRole
    ] = config.cloudRole;
  }

  if (config.httpAgent !== undefined) {
    // tslint:disable-next-line: no-object-mutation
    appInsights.defaultClient.config.httpAgent = config.httpAgent;
  }

  if (config.httpsAgent !== undefined) {
    // tslint:disable-next-line: no-object-mutation
    appInsights.defaultClient.config.httpsAgent = config.httpsAgent;
  }

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

/**
 * Configure Application Insights default client
 * using settings taken from the environment:
 *
 * - setup tracing options
 * - setup cloudRole and version
 * - eventually setup http keeplive to prevent SNAT port exhaustion
 * - start application insights
 *
 * As the default client is a singleton shared between functions
 * you may want to prevent bootstrapping insights more than once
 * checking if appInsights.defaultClient id already set in the caller.
 *
 * To enable http agent keepalive set up these environment variables:
 * https://github.com/pagopa/io-ts-commons/blob/master/src/agent.ts#L11
 *
 * If you need to programmatically call Application Insights methods
 * set operationId = context.Tracecontext.traceparent to correlate
 * the call with the parent request.
 *
 */
export function initAppInsights(
  aiInstrumentationKey: string,
  env: typeof process.env = process.env,
  config?: IInsightsOptions
): ReturnType<typeof startAppInsights> {
  // @see https://github.com/pagopa/io-ts-commons/blob/master/src/agent.ts
  // @see https://docs.microsoft.com/it-it/azure/load-balancer/load-balancer-outbound-connections
  const agentOpts = agent.isFetchKeepaliveEnabled(env)
    ? {
        httpAgent: agent.newHttpAgent(agent.getKeepAliveAgentOptions(env)),
        httpsAgent: agent.newHttpsAgent(agent.getKeepAliveAgentOptions(env))
      }
    : {};

  // defaults to the name of the function app if not set in config
  const cloudRole = config?.cloudRole || env.WEBSITE_SITE_NAME;

  return startAppInsights(aiInstrumentationKey, {
    cloudRole,
    ...config,
    ...agentOpts
  });
}

const NANOSEC_PER_MILLISEC = 1e6;
const MILLISEC_PER_SEC = 1e3;

// tslint:disable-next-line: no-any
export function withAppInsightsContext<R>(context: Context, f: () => R): R {
  const correlationContext = CorrelationContextManager.generateContextObject(
    // it is not totally clear if this should be context.invocationId
    // @see https://github.com/Azure/azure-functions-host/issues/5170#issuecomment-553583362
    context.invocationId,
    context.invocationId,
    context.executionContext.functionName
  );
  return CorrelationContextManager.runWithContext(correlationContext, () => {
    return f();
  });
}

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
