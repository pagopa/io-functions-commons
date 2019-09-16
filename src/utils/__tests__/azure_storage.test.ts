/* tslint:disable: no-any */

import * as t from "io-ts";

import { isRight } from "fp-ts/lib/Either";
import { isNone } from "fp-ts/lib/Option";

import {
  BlobNotFoundCode,
  getBlobAsObject,
  getBlobAsText
} from "../azure_storage";

const TestObject = t.interface({
  prop: t.string
});

type TestObject = t.TypeOf<typeof TestObject>;

const blobServiceMock = {
  getBlobToText: jest.fn((_, __, ___, f) => {
    f({
      code: BlobNotFoundCode
    });
  })
};

describe("getBlobAsText", () => {
  it("should return None on BlobNotFound error", async () => {
    const errorOrMaybeText = await getBlobAsText(
      blobServiceMock as any,
      undefined as any,
      undefined as any
    );

    expect(isRight(errorOrMaybeText)).toBe(true);
    if (isRight(errorOrMaybeText)) {
      const maybeText = errorOrMaybeText.value;
      expect(isNone(maybeText)).toBe(true);
    }
  });
});

describe("getBlobAsObject", () => {
  it("should return None on BlobNotFound error", async () => {
    const errorOrMaybeObject = await getBlobAsObject(
      TestObject,
      blobServiceMock as any,
      undefined as any,
      undefined as any
    );

    expect(isRight(errorOrMaybeObject)).toBe(true);
    if (isRight(errorOrMaybeObject)) {
      const maybeObject = errorOrMaybeObject.value;
      expect(isNone(maybeObject)).toEqual(true);
    }
  });
});
