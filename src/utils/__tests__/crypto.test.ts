import {
  generateDigestHeader,
  CONTENT_DIGEST_CONSTANTS,
  toHash
} from "../crypto";

describe("toHash", () => {
  it("shoudl be able to generate a SHA256 hash", () => {
    const payload: string = '{"hello": "world"}';
    const expectedSha256Hash =
      "5f8f04f6a3a892aaabbddb6cf273894493773960d4a325b105fee46eef4304f1";
    const actual = toHash(payload);
    expect(actual).toEqual(expectedSha256Hash);
  });
});

describe("Content-Digest", () => {
  test("should be able to generate for SHA256 cipher", () => {
    const request: string = '{"hello": "world"}';
    const requestBuffer: Buffer = Buffer.from(request);
    const expected: string =
      "sha-256=:X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=:";

    const actual = generateDigestHeader(
      requestBuffer,
      CONTENT_DIGEST_CONSTANTS.SHA_256
    );

    expect(actual).toBe(expected);
  });

  test("should be able to generate for SHA512 cipher", () => {
    const request: string = '{"hello": "world"}';
    const requestBuffer: Buffer = Buffer.from(request);
    const expected: string =
      "sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:";

    const actual = generateDigestHeader(
      requestBuffer,
      CONTENT_DIGEST_CONSTANTS.SHA_512
    );

    expect(actual).toBe(expected);
  });
});
