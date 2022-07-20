/* eslint-disable @typescript-eslint/no-explicit-any */

import * as t from "io-ts";

import { isRight } from "fp-ts/lib/Either";
import { isNone } from "fp-ts/lib/Option";

import {
  BlobNotFoundCode,
  getBlobAsObject,
  getBlobAsText,
  getBlobAsTextWithError
} from "../azure_storage";

import { createBlobService } from "azure-storage";

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
  it("IT -> should return None on BlobNotFound error", async () => {
    const STORAGE_CONNECTION_STRING =
      "DefaultEndpointsProtocol=https;AccountName=iomocktest;AccountKey=qw/9pReSlzvYdfJ8n7cNsXiaq12u9WXRgiMPRtYs8BC0mShAgvCEplbK7/Avd1k/LPAzBvZd6jBOqksrEMtTrg==;EndpointSuffix=core.windows.net";
    const blobService = createBlobService(STORAGE_CONNECTION_STRING);
    const errorOrMaybeText = await getBlobAsTextWithError(
      blobService,
      "message-content",
      "NOT_EXISTING.json"
    )();

    console.log("AAAA: " + JSON.stringify(errorOrMaybeText));
  });

  it("should return None on BlobNotFound error", async () => {
    const errorOrMaybeText = await getBlobAsText(
      blobServiceMock as any,
      undefined as any,
      undefined as any
    );

    expect(isRight(errorOrMaybeText)).toBe(true);
    if (isRight(errorOrMaybeText)) {
      const maybeText = errorOrMaybeText.right;
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
      const maybeObject = errorOrMaybeObject.right;
      expect(isNone(maybeObject)).toEqual(true);
    }
  });
});
