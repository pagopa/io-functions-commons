import { Context } from "@azure/functions";
import { LogEntry } from "winston";
import * as Transport from "winston-transport";

/**
 * Returns the Context logging function matching the provided logging level
 */
const getLoggerForLevel = (
  logger: Context["log"],
  level: string
  // eslint-disable-next-line @typescript-eslint/array-type
): ((...args: readonly unknown[]) => void) => {
  switch (level) {
    case "debug":
      return logger.verbose;
    case "info":
      return logger.info;
    case "warn":
      return logger.warn;
    case "error":
      return logger.error;
    default:
      // eslint-disable-next-line @typescript-eslint/array-type
      return (...args: readonly unknown[]): void =>
        logger.info(`[${level}] `, ...args);
  }
};

/**
 * A custom Winston Transport that logs to the Azure Functions context
 */
export class AzureContextTransport extends Transport {
  /**
   * @param getContextLogger A function that returns the `log` method in the Context
   * @param options Extra transport options
   */
  constructor(
    private readonly getContextLogger: () => Context["log"] | undefined,
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
