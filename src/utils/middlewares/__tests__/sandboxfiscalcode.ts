// tslint:disable:no-any

import { isLeft, isRight } from "fp-ts/lib/Either";

import { SandboxFiscalCodeMiddleware } from "../sandboxfiscalcode";

describe("SandboxFiscalCodeMiddleware", () => {
  it("should respond with a validation error if the fiscal code does not respect the correct pattern", () => {
    const mockRequest = {
      params: {
        fiscalcode: "SPNDNL80A13Y555J"
      }
    };

    return SandboxFiscalCodeMiddleware(mockRequest as any).then(result => {
      expect(isLeft(result)).toBeTruthy();
      if (isLeft(result)) {
        expect(result.value.kind).toBe("IResponseErrorValidation");
      }
    });
  });

  it("should forward the fiscal code if it is valid", () => {
    const mockRequest = {
      params: {
        fiscalcode: "SPNDNL80A13Y555X"
      }
    };

    return SandboxFiscalCodeMiddleware(mockRequest as any).then(result => {
      expect(isRight(result)).toBeTruthy();
      if (isRight(result)) {
        expect<any>(result.value).toEqual(mockRequest.params.fiscalcode);
      }
    });
  });
});
