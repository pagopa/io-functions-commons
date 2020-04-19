import { Context } from "@azure/functions";
// tslint:disable-next-line: no-submodule-imports
import { CorrelationContextManager } from "applicationinsights/out/AutoCollection/CorrelationContextManager";
// tslint:disable-next-line: no-submodule-imports
import Traceparent = require("applicationinsights/out/Library/Traceparent");
import { fromNullable } from "fp-ts/lib/Option";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

/**
 * Wraps a function handler with a telemetry context,
 * useful in case you want to set correlation id.
 */
export function withAppInsightsContext<R>(context: Context, f: () => R): R {
  // @see https://github.com/Azure/azure-functions-host/issues/5170#issuecomment-553583362
  const traceId = fromNullable(context.traceContext).fold(
    context.invocationId,
    tc =>
      NonEmptyString.decode(tc.traceparent).fold(
        _ => context.invocationId,
        _ => new Traceparent(_).traceId
      )
  );
  const correlationContext = CorrelationContextManager.generateContextObject(
    traceId,
    traceId,
    context.executionContext.functionName
  );
  return CorrelationContextManager.runWithContext(correlationContext, () => {
    return f();
  });
}
