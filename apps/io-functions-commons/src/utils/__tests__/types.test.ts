import { right } from "fp-ts/lib/Either";
import * as t from "io-ts";

import { wrapWithKind } from "../types";

describe("WithKind", () => {
  const DummyT = t.interface({
    n: t.number,
    s: t.string,
  });

  const KindedDummyT = wrapWithKind(DummyT, "DummyT" as const);

  const dummy = {
    n: 1,
    s: "x",
  };

  const kindedDummy = {
    ...dummy,
    kind: "DummyT" as const,
  };

  it("should add kind while decoding", () => {
    expect(KindedDummyT.decode(dummy)).toEqual(right(kindedDummy));
  });

  it("should remove kind while encoding", () => {
    expect(KindedDummyT.encode(kindedDummy)).toEqual(dummy);
  });

  it("should guard type", () => {
    expect(KindedDummyT.is(kindedDummy)).toBeTruthy();
  });

  // it should decode to the right type
  // eslint-disable-next-line sonar/no-dead-store
  const _: t.Validation<{
    kind: "DummyT";
    n: number;
    s: string;
  }> = KindedDummyT.decode(kindedDummy);
});
