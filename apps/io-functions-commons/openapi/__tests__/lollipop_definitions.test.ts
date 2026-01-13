import * as E from "fp-ts/Either";

import { aFiscalCode } from "../../__mocks__/mocks";
import { AssertionFileName } from "../../generated/definitions/lollipop/AssertionFileName";
import { AssertionRef } from "../../generated/definitions/lollipop/AssertionRef";
import { AssertionType } from "../../generated/definitions/lollipop/AssertionType";

const aSha256AssertionRef =
  "sha256-p1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c";
const aSha384AssertionRef =
  "sha384-pMtZXFXooOW9T0xcE5ahZzpBoIRiwKW2A_OPbVsrTg60f_PyAUIeV0iZUyP19FS-";
const aSha512AssertionRef =
  "sha512-qL3u8hwNQp3HuSWdRQr6LFasiedDrUx-fL1n88zH60kj7iUeCpbT4aQ9cZJ3Qkjm4tSuFpBDhhGxqUd5OPQkUA";

describe("AssertionRef - decode", () => {
  it("should decode a valid sha256 assertionRef", () => {
    const res = AssertionRef.decode(aSha256AssertionRef);

    expect(res).toMatchObject(E.right(aSha256AssertionRef));
  });

  it("should decode a valid sha384 assertionRef", () => {
    const res = AssertionRef.decode(aSha384AssertionRef);

    expect(res).toMatchObject(E.right(aSha384AssertionRef));
  });

  it("should decode a valid sha512 assertionRef", () => {
    const res = AssertionRef.decode(aSha512AssertionRef);

    expect(res).toMatchObject(E.right(aSha512AssertionRef));
  });

  it("should not decode a valid assertionRef", () => {
    const val = "sha256-!1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c";

    const res = AssertionRef.decode(val);

    expect(res).toMatchObject(E.left(expect.any(Array)));
  });
});

describe("AssertionRef - is", () => {
  it("should check a valid sha256 assertionRef", () => {
    const res = AssertionRef.is(aSha256AssertionRef);
    expect(res).toEqual(true);
  });

  it("should check a valid sha384 assertionRef", () => {
    const res = AssertionRef.is(aSha384AssertionRef);
    expect(res).toEqual(true);
  });

  it("should decode a valid sha512 assertionRef", () => {
    const res = AssertionRef.is(aSha512AssertionRef);
    expect(res).toEqual(true);
  });

  it("should not check a valid assertionRef", () => {
    const val = "sha256-!1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c";

    const res = AssertionRef.is(val);

    expect(res).toEqual(false);
  });
});

describe("AssertionType - decode", () => {
  it("should decode a valid assertion type", () => {
    const val = "OIDC";

    const res = AssertionType.decode(val);
    expect(res).toMatchObject(E.right(val));
  });

  it("should not decode a valid assertionRef", () => {
    const val = "INVALID";

    const res = AssertionType.decode(val);
    expect(res).toMatchObject(E.left(expect.any(Array)));
  });
});

describe("AssertionType - is", () => {
  it("should check a valid sha256 assertionRef", () => {
    const val = "SAML";

    const res = AssertionType.is(val);
    expect(res).toEqual(true);
  });

  it("should not check a valid assertionRef", () => {
    const val = "INVALID";

    const res = AssertionType.is(val);
    expect(res).toEqual(false);
  });
});

describe("AssertionFileName - decode", () => {
  it("should decode a valid AssertionFileName with sha256 AssertionRef", () => {
    const val = `${aFiscalCode}-${aSha256AssertionRef}`;

    const res = AssertionFileName.decode(val);
    expect(res).toMatchObject(E.right(val));
  });

  it("should decode a valid AssertionFileName with sha384 AssertionRef", () => {
    const val = `${aFiscalCode}-${aSha384AssertionRef}`;

    const res = AssertionFileName.decode(val);
    expect(res).toMatchObject(E.right(val));
  });

  it("should decode a valid AssertionFileName with sha512 AssertionRef", () => {
    const val = `${aFiscalCode}-${aSha512AssertionRef}`;

    const res = AssertionFileName.decode(val);
    expect(res).toMatchObject(E.right(val));
  });

  it("should not decode an invalid AssertionFileName", () => {
    const val = "INVALID";

    const res = AssertionType.decode(val);
    expect(res).toMatchObject(E.left(expect.any(Array)));
  });
});

describe("AssertionFileName - is", () => {
  it("should check a valid AssertionFileName with sha256 AssertionRef", () => {
    const val = `${aFiscalCode}-${aSha256AssertionRef}`;

    const res = AssertionFileName.is(val);
    expect(res).toBeTruthy();
  });

  it("should check a valid AssertionFileName with sha384 AssertionRef", () => {
    const val = `${aFiscalCode}-${aSha384AssertionRef}`;

    const res = AssertionFileName.is(val);
    expect(res).toBeTruthy();
  });

  it("should check a valid AssertionFileName with sha512 AssertionRef", () => {
    const val = `${aFiscalCode}-${aSha512AssertionRef}`;

    const res = AssertionFileName.is(val);
    expect(res).toBeTruthy();
  });

  it("should not check an invalid AssertionFileName", () => {
    const val = "INVALID";

    const res = AssertionType.is(val);
    expect(res).toBeFalsy();
  });
});
