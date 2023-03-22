import { TelemetryClient } from "applicationinsights";
import * as w from "winston";
import * as Transport from "winston-transport";

export class ApplicationInsightTransport extends Transport {
  constructor(
    private readonly telemetryClient: TelemetryClient,
    private readonly eventNamePrefix: string,
    options?: Transport.TransportStreamOptions
  ) {
    super(options);
    this.level = options?.level ?? "info";
  }

  public log(
    { level, ...properties }: w.LogEntry,
    callback: (err: Error | undefined, cont: boolean) => void
  ): void {
    if (!this.silent) {
      this.telemetryClient.trackEvent({
        name: `${this.eventNamePrefix}.${level}.${properties?.name ??
          "global"}`.toLowerCase(),
        properties,
        tagOverrides: { samplingEnabled: "false" }
      });
    }
    callback(undefined, true);
  }
}

export const withApplicationInsight = (
  telemetryClient: TelemetryClient,
  eventNamePrefix: string
): w.transport =>
  new ApplicationInsightTransport(telemetryClient, eventNamePrefix);
