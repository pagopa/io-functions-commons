/* tslint:disable: no-any */

import * as t from "io-ts";

import { isRight } from "fp-ts/lib/Either";
import { isSome } from "fp-ts/lib/Option";

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
  getBlobToText: jest.fn((_, __, f) => {
    f({
      code: BlobNotFoundCode
    });
  })
};

describe("getBlobAsText", () => {
  it("should return the default value on BlobNotFound error", async () => {
    const errorOrMaybeText = await getBlobAsText(
      blobServiceMock as any,
      undefined as any,
      undefined as any,
      "default"
    );

    expect(isRight(errorOrMaybeText)).toBe(true);
    if (isRight(errorOrMaybeText)) {
      const maybeText = errorOrMaybeText.value;
      expect(isSome(maybeText)).toBe(true);

      if (isSome(maybeText)) {
        const text = maybeText.value;
        expect(text).toBe("default");
      }
    }
  });
});

describe("getBlobAsObject", () => {
  it("should return the default value on BlobNotFound error", async () => {
    const defaultValue: TestObject = {
      prop: "default"
    };

    const errorOrObject = await getBlobAsObject(
      TestObject,
      blobServiceMock as any,
      undefined as any,
      undefined as any,
      defaultValue
    );

    expect(isRight(errorOrObject)).toBe(true);
    if (isRight(errorOrObject)) {
      const object = errorOrObject.value;
      expect(object).toEqual(defaultValue);
    }
  });
});
