// tslint:disable: no-duplicate-string

import { fromNullable } from "fp-ts/lib/Option";
import {
  createMailTransporter,
  MailerTransporter,
  MultiTransport,
  sendMail,
  Transport
} from "../transports";

// format required by nodemailer
const anEmailMessage: MailerTransporter.Options = {
  from: "foo <foo@example.com>",
  headers: {
    "X-Header": "value"
  },
  html: "lorem ipsum <b>html></b>",
  replyTo: "foobar@example.com",
  subject: "lorem ipsum",
  text: "lorem impsum",
  to: "bar <bar@example.com>"
};

describe("MultiTransport", () => {
  it("should not be created with no transports", () => {
    expect(MultiTransport([])).not.toBeDefined();
  });

  it("should send all emails through one transport", async () => {
    const oneTransport: Transport = {
      name: "t1",
      send: jest.fn((mail, cb) => cb(null, { ok: true })),
      version: "0.1"
    };
    const transport = fromNullable(
      MultiTransport([oneTransport])
    ).getOrElseL(() => fail("cannot create multi transport"));
    const multi = createMailTransporter(transport);

    const result = await Promise.all(
      new Array(3).fill(0).map(_ => multi.sendMail(anEmailMessage))
    );

    expect(result).toHaveLength(3);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          selectedTransportName: "t1",
          selectedTransportVersion: "0.1"
        })
      ])
    );
    expect(oneTransport.send).toHaveBeenCalledTimes(3);
  });

  it("should send emails through three transports", async () => {
    const t1: Transport = {
      name: "t1",
      send: jest.fn((mail, cb) => cb(null, { ok: true })),
      version: "0.1"
    };

    const t2: Transport = {
      name: "t2",
      send: jest.fn((mail, cb) => cb(null, { ok: true })),
      version: "0.1"
    };

    const t3: Transport = {
      name: "t3",
      send: jest.fn((mail, cb) => cb(null, { ok: true })),
      version: "0.1"
    };

    const transport = fromNullable(
      MultiTransport([t1, t2, t3])
    ).getOrElseL(() => fail("cannot create multi transport"));
    const multi = createMailTransporter(transport);

    const result = await Promise.all(
      new Array(100).fill(0).map(_ => multi.sendMail(anEmailMessage))
    );

    expect(result).toHaveLength(100);
    expect(t1.send).toHaveBeenCalled();
    expect(t2.send).toHaveBeenCalled();
    expect(t3.send).toHaveBeenCalled();
  });

  it("should no add extra info", async () => {
    const oneTransport: Transport = {
      name: "t1",
      send: jest.fn((_, cb) => cb(null, true)),
      version: "0.1"
    };

    const transport = fromNullable(
      MultiTransport([oneTransport])
    ).getOrElseL(() => fail("cannot create multi transport"));
    const multi = createMailTransporter(transport);

    const result = await multi.sendMail(anEmailMessage);

    expect(result).toEqual(true);
  });
});

describe("sendMail", () => {
  const aSendMailError = Error();
  const sendMailMock = jest.fn((_, f) => f(aSendMailError, undefined));
  const transporterMock = ({
    sendMail: sendMailMock
  } as unknown) as MailerTransporter;
  const aSentMessageInfo = {
    sent: true
  };

  it("should call transporter.sendMail with the right parameters", async () => {
    const options = {
      from: "email@example.com"
    };

    await sendMail(transporterMock, options).run();

    expect(transporterMock.sendMail).toBeCalledWith(
      options,
      expect.any(Function)
    );
  });

  it("should return the error returned by transporter.sendMail", async () => {
    sendMailMock.mockImplementationOnce((_, f) => f(aSendMailError, undefined));

    const result = await sendMail(transporterMock, {}).run();

    expect(result.isLeft()).toBe(true);
  });

  it("should return the value returned by transporter.sendMail", async () => {
    sendMailMock.mockImplementationOnce((_, f) => f(null, aSentMessageInfo));

    const result = await sendMail(transporterMock, {}).run();

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value).toEqual(aSentMessageInfo);
    }
  });
});
