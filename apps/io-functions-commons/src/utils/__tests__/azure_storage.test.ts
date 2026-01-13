import { isLeft, isRight } from "fp-ts/lib/Either";
import { isNone } from "fp-ts/lib/Option";
import * as t from "io-ts";

import {
  BlobNotFoundCode,
  getBlobAsObject,
  getBlobAsText,
  getBlobAsTextWithError,
} from "../azure_storage";
import { GenericCode } from "../azure_storage";
import { vi } from "vitest";

const TestObject = t.interface({
  prop: t.string,
});

type TestObject = t.TypeOf<typeof TestObject>;

const blobServiceMock = {
  getBlobToText: vi.fn((_, __, ___, f) => {
    f({
      code: BlobNotFoundCode,
    });
  }),
};

describe("getBlobAsText", () => {
  it("should return None on BlobNotFound error", async () => {
    const errorOrMaybeText = await getBlobAsText(
      blobServiceMock as any,
      undefined as any,
      undefined as any,
    );

    expect(isRight(errorOrMaybeText)).toBe(true);
    if (isRight(errorOrMaybeText)) {
      const maybeText = errorOrMaybeText.right;
      expect(isNone(maybeText)).toBe(true);
    }
  });
});

describe("getBlobAsTextWithError", () => {
  it("should return a left with a BlobNotFound as code on BlobNotFound error", async () => {
    const errorOrMaybeText = await getBlobAsTextWithError(
      blobServiceMock as any,
      undefined as any,
    )("dummy_id")();

    expect(isLeft(errorOrMaybeText)).toBeTruthy();
    if (isLeft(errorOrMaybeText)) {
      expect(errorOrMaybeText.left).toEqual(
        expect.objectContaining({ code: BlobNotFoundCode }),
      );
    }
  });

  it("should return a left with a GenericCode as code on error", async () => {
    blobServiceMock.getBlobToText.mockImplementationOnce((_, __, ___, f) => {
      f({
        code: GenericCode,
      });
    });
    const errorOrMaybeText = await getBlobAsTextWithError(
      blobServiceMock as any,
      undefined as any,
    )("dummy_id")();

    expect(isLeft(errorOrMaybeText)).toBeTruthy();
    if (isLeft(errorOrMaybeText)) {
      expect(errorOrMaybeText.left).toEqual(
        expect.objectContaining({ code: GenericCode }),
      );
    }
  });
});

describe("getBlobAsObject", () => {
  it("should return None on BlobNotFound error", async () => {
    const errorOrMaybeObject = await getBlobAsObject(
      TestObject,
      blobServiceMock as any,
      undefined as any,
      undefined as any,
    );

    expect(isRight(errorOrMaybeObject)).toBe(true);
    if (isRight(errorOrMaybeObject)) {
      const maybeObject = errorOrMaybeObject.right;
      expect(isNone(maybeObject)).toEqual(true);
    }
  });
});
