// tslint:disable: no-any

import { isLeft, isRight } from "fp-ts/lib/Either";

import { sendMail } from "../email";

describe("sendMail", () => {
  it("should call transporter.sendMail with the right parameters", async () => {
    const transporterMock = {
      sendMail: jest.fn((_, f) => f(Error, undefined))
    };
    const options = {
      from: "email@example.com"
    };

    await sendMail(transporterMock as any, options);

    expect(transporterMock.sendMail).toBeCalledWith(
      options,
      expect.any(Function)
    );
  });

  it("should return the error returned by transporter.sendMail", async () => {
    const errorMock = Error();
    const transporterMock = {
      sendMail: jest.fn((_, f) => f(errorMock, undefined))
    };

    const result = await sendMail(transporterMock as any, {});

    expect(isLeft(result)).toBe(true);
  });

  it("should return the value returned by transporter.sendMail", async () => {
    const resultMock = {
      sent: true
    };
    const transporterMock = {
      sendMail: jest.fn((_, f) => f(undefined, resultMock))
    };

    const result = await sendMail(transporterMock as any, {});

    expect(isRight(result)).toBe(true);
    if (isRight(result)) {
      expect(result.value).toEqual(resultMock);
    }
  });
});
