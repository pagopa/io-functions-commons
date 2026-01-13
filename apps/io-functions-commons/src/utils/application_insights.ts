import { Context } from "@azure/functions";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { CorrelationContextManager } from "applicationinsights/out/AutoCollection/CorrelationContextManager";
import Traceparent from "applicationinsights/out/Library/Traceparent";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";

/**
 * Wraps a function handler with a telemetry context,
 * useful in case you want to set correlation id.
 */
export const withAppInsightsContext = <R>(context: Context, f: () => R): R => {
  // @see https://github.com/Azure/azure-functions-host/issues/5170#issuecomment-553583362
  const traceId = pipe(
    O.fromNullable(context.traceContext),
    O.fold(
      () => context.invocationId,
      (tc) =>
        pipe(
          NonEmptyString.decode(tc.traceparent),
          E.fold(
            (_) => context.invocationId,
            (traceParentAsString) =>
              new Traceparent(traceParentAsString).traceId,
          ),
        ),
    ),
  );
  const correlationContext = CorrelationContextManager.generateContextObject(
    traceId,
    traceId,
    context.executionContext.functionName,
  );
  return CorrelationContextManager.runWithContext(correlationContext, () =>
    f(),
  );
};
