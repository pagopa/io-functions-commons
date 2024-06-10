/* eslint-disable @typescript-eslint/no-explicit-any */

import * as t from "io-ts";

import { isRight, isLeft } from "fp-ts/lib/Either";
import { isSome, isNone } from "fp-ts/lib/Option";

import {
  BlobNotFoundCode,
  getBlobAsObject,
  getBlobAsText,
  getBlobAsTextWithError,
  getBlobFromContainerAsTextWithError
} from "../azure_storage";

import { GenericCode } from "../azure_storage";
import { PassThrough } from "stream";
import {
  BlobClient,
  BlobDownloadResponseParsed,
  ContainerClient
} from "@azure/storage-blob";

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

const mockedReadableStreamBody = new PassThrough();

interface getBlobContainerMockParams {
  readableStreamBody?: NodeJS.ReadableStream;
  errorCode?: string;
}
const throwErrorCode = "throw";
const getBlobContainerMock = (params?: getBlobContainerMockParams) =>
  (({
    getBlobClient: jest.fn(
      _ =>
        (({
          download: async () => {
            if (params?.errorCode === throwErrorCode) {
              throw "internal error";
            }
            return ({
              errorCode: params?.errorCode,
              readableStreamBody: params?.readableStreamBody
            } as unknown) as BlobDownloadResponseParsed;
          }
        } as unknown) as BlobClient)
    )
  } as unknown) as ContainerClient);

describe("getBlobAsText", () => {
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

describe("getBlobAsTextWithError", () => {
  it("should return a left with a BlobNotFound as code on BlobNotFound error", async () => {
    const errorOrMaybeText = await getBlobAsTextWithError(
      blobServiceMock as any,
      undefined as any
    )("dummy_id")();

    expect(isLeft(errorOrMaybeText)).toBeTruthy();
    if (isLeft(errorOrMaybeText)) {
      expect(errorOrMaybeText.left).toEqual(
        expect.objectContaining({ code: BlobNotFoundCode })
      );
    }
  });

  it("should return a left with a GenericCode as code on error", async () => {
    blobServiceMock.getBlobToText.mockImplementationOnce((_, __, ___, f) => {
      f({
        code: GenericCode
      });
    });
    const errorOrMaybeText = await getBlobAsTextWithError(
      blobServiceMock as any,
      undefined as any
    )("dummy_id")();

    expect(isLeft(errorOrMaybeText)).toBeTruthy();
    if (isLeft(errorOrMaybeText)) {
      expect(errorOrMaybeText.left).toEqual(
        expect.objectContaining({ code: GenericCode })
      );
    }
  });
});

describe("getBlobFromContainerAsTextWithError", () => {
  it("should return a left with a BlobNotFound as code on BlobNotFound error", async () => {
    const errorOrMaybeText = await getBlobFromContainerAsTextWithError(
      getBlobContainerMock({ errorCode: BlobNotFoundCode })
    )("dummy_id")();

    expect(isLeft(errorOrMaybeText)).toBeTruthy();
    if (isLeft(errorOrMaybeText)) {
      expect(errorOrMaybeText.left).toEqual({
        code: BlobNotFoundCode,
        message: `Blob storage: Error code ${BlobNotFoundCode}.`
      });
    }
  });

  it("should return a left with a GenericCode as code and empty response message on empty response stream", async () => {
    const errorOrMaybeText = await getBlobFromContainerAsTextWithError(
      getBlobContainerMock({})
    )("dummy_id")();

    expect(isLeft(errorOrMaybeText)).toBeTruthy();
    if (isLeft(errorOrMaybeText)) {
      expect(errorOrMaybeText.left).toEqual({
        code: GenericCode,
        message: "Blob storage: Empty response body."
      });
    }
  });

  it("should return a left with a GenericCode as code and an internal error on call error", async () => {
    const errorOrMaybeText = await getBlobFromContainerAsTextWithError(
      getBlobContainerMock({ errorCode: throwErrorCode })
    )("dummy_id")();

    expect(isLeft(errorOrMaybeText)).toBeTruthy();
    if (isLeft(errorOrMaybeText)) {
      expect(errorOrMaybeText.left).toEqual({
        code: GenericCode,
        message: "Blob storage: Internal error."
      });
    }
  });

  it("should return a right with the result when blob stream is available", async () => {
    // wait a little and trigger response body stream
    setTimeout(() => {
      mockedReadableStreamBody.emit("data", '{prop:"value"}');
      mockedReadableStreamBody.end();
      mockedReadableStreamBody.destroy();
    }, 100);

    const errorOrMaybeText = await getBlobFromContainerAsTextWithError(
      getBlobContainerMock({ readableStreamBody: mockedReadableStreamBody })
    )("dummy_id")();

    expect(isRight(errorOrMaybeText)).toBeTruthy();
    if (isRight(errorOrMaybeText)) {
      expect(isSome(errorOrMaybeText.right)).toBe(true);
      if (isSome(errorOrMaybeText.right)) {
        expect(errorOrMaybeText.right.value).toBe('{prop:"value"}');
      }
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
