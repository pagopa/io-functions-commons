import { withAppInsightsContext } from "../application_insights";

// tslint:disable-next-line: no-submodule-imports
import { CorrelationContextManager } from "applicationinsights/out/AutoCollection/CorrelationContextManager";

describe("Wrap an handler with Application Insights context", () => {
  const CollerationContextSpy = jest.spyOn(
    CorrelationContextManager,
    "generateContextObject"
  );

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
    expect(CollerationContextSpy).toHaveBeenCalledWith("123", "123", "foo");
    expect(ret).toEqual("bar2");
  });
  it("should set traceId to traceparent.traceId", async () => {
    const handler = (a: string, b: number) => `${a}${b}`;
    const ret = withAppInsightsContext(
      {
        executionContext: {
          functionName: "foo"
        },
        invocationId: "123",
        traceContext: {
          traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"
        }
        // tslint:disable-next-line: no-any
      } as any,
      () => handler("bar", 2)
    );
    expect(CollerationContextSpy).toHaveBeenCalledWith(
      "0af7651916cd43dd8448eb211c80319c",
      "0af7651916cd43dd8448eb211c80319c",
      "foo"
    );
    expect(ret).toEqual("bar2");
  });
});
