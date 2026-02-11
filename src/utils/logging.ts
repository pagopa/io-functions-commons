import { InvocationContext } from "@azure/functions";
import { LogEntry } from "winston";
import * as Transport from "winston-transport";

/**
 * Returns the InvocationContext logging function matching the provided logging level
 * In Azure Functions v4, context.log is a simple function without sub-methods
 */
const getLoggerForLevel = (
  context: InvocationContext,
  level: string
  // eslint-disable-next-line @typescript-eslint/array-type
): ((...args: readonly unknown[]) => void) => {
  switch (level) {
    case "debug":
      return context.debug;
    case "info":
      return context.info;
    case "warn":
      return context.warn;
    case "error":
      return context.error;
    default:
      // eslint-disable-next-line @typescript-eslint/array-type
      return (...args: readonly unknown[]): void =>
        context.info(`[${level}] `, ...args);
  }
};

/**
 * A custom Winston Transport that logs to the Azure Functions context
 */
export class AzureContextTransport extends Transport {
  /**
   * @param getContextLogger A function that returns the `log` method in the InvocationContext
   * @param options Extra transport options
   */
  constructor(
    private readonly getContextLogger: () => InvocationContext | undefined,
    options: Transport.TransportStreamOptions
  ) {
    super(options);
    this.level = options.level || "info";
  }

  public log(
    { level, message }: LogEntry,
    callback: (err: Error | undefined, cont: boolean) => void
  ): void {
    if (this.silent) {
      return callback(undefined, true);
    }
    const contextLogger = this.getContextLogger();
    if (contextLogger !== undefined) {
      getLoggerForLevel(contextLogger, level)(message);
    }
    callback(undefined, true);
  }
}
