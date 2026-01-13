import { TelemetryClient } from "applicationinsights";
import * as w from "winston";
import * as Transport from "winston-transport";

export class ApplicationInsightTransport extends Transport {
  constructor(
    private readonly telemetryClient: TelemetryClient,
    private readonly eventNamePrefix: string,
    options?: Transport.TransportStreamOptions,
  ) {
    super(options);
    this.level = options?.level ?? "info";
  }

  public log(
    { level, name, ...properties }: w.LogEntry,
    callback: (err: Error | undefined, cont: boolean) => void,
  ): void {
    if (!this.silent) {
      this.telemetryClient.trackEvent({
        name: `${this.eventNamePrefix}.${level}.${
          name ?? "global"
        }`.toLowerCase(),
        // Warning: this entries operations is needed becouse winston add three Symbol properties to meta object given to log method: we want to strip this additional properties
        // https://github.com/winstonjs/winston/tree/v3.8.2#streams-objectmode-and-info-objects
        properties: Object.entries(properties).reduce(
          (acc, [k, v]) => (typeof k === "symbol" ? acc : { ...acc, [k]: v }),
          {} as Record<string, unknown>,
        ),
        tagOverrides: { samplingEnabled: "false" },
      });
    }
    callback(undefined, true);
  }
}

export const withApplicationInsight = (
  telemetryClient: TelemetryClient,
  eventNamePrefix: string,
): w.transport =>
  new ApplicationInsightTransport(telemetryClient, eventNamePrefix);
