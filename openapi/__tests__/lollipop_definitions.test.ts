import { AssertionRef } from "../../generated/definitions/lollipop/AssertionRef";
import { AssertionType } from "../../generated/definitions/lollipop/AssertionType";

import * as E from "fp-ts/Either";

describe("AssertionRef - decode", () => {
  it("should decode a valid sha256 assertionRef", () => {
    const val = "sha256-p1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c";

    const res = AssertionRef.decode(val);

    expect(res).toMatchObject(E.right(val));
  });

  it("should decode a valid sha384 assertionRef", () => {
    const val =
      "sha384-pMtZXFXooOW9T0xcE5ahZzpBoIRiwKW2A_OPbVsrTg60f_PyAUIeV0iZUyP19FS-";

    const res = AssertionRef.decode(val);

    expect(res).toMatchObject(E.right(val));
  });

  it("should decode a valid sha512 assertionRef", () => {
    const val =
      "sha512-qL3u8hwNQp3HuSWdRQr6LFasiedDrUx-fL1n88zH60kj7iUeCpbT4aQ9cZJ3Qkjm4tSuFpBDhhGxqUd5OPQkUA";

    const res = AssertionRef.decode(val);

    expect(res).toMatchObject(E.right(val));
  });

  it("should not decode a valid assertionRef", () => {
    const val = "sha256-!1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c";

    const res = AssertionRef.decode(val);

    expect(res).toMatchObject(E.left(expect.any(Array)));
  });
});

describe("AssertionRef - is", () => {
  it("should check a valid sha256 assertionRef", () => {
    const val = "sha256-p1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c";

    const res = AssertionRef.is(val);
    expect(res).toEqual(true);
  });

  it("should check a valid sha384 assertionRef", () => {
    const val =
      "sha384-pMtZXFXooOW9T0xcE5ahZzpBoIRiwKW2A_OPbVsrTg60f_PyAUIeV0iZUyP19FS-";

    const res = AssertionRef.is(val);
    expect(res).toEqual(true);
  });

  it("should decode a valid sha512 assertionRef", () => {
    const val =
      "sha512-qL3u8hwNQp3HuSWdRQr6LFasiedDrUx-fL1n88zH60kj7iUeCpbT4aQ9cZJ3Qkjm4tSuFpBDhhGxqUd5OPQkUA";

    const res = AssertionRef.is(val);
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
