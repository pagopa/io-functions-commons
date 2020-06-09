import * as nodemailer from "nodemailer";

// tslint:disable-next-line:no-submodule-imports
import Mail = require("nodemailer/lib/mailer");

import { MultiTransport } from "../nodemailer";

// format required by nodemailer
const anEmailMessage: Mail.Options = {
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
    expect(MultiTransport({ transports: [] })).toBeUndefined();
  });

  it("should send all emails through one transport", async () => {
    const oneTransport: nodemailer.Transport = {
      name: "t1",
      send: jest.fn((mail, cb) => cb(null, { ok: true })),
      version: "0.1"
    };

    const multi = nodemailer.createTransport(
      MultiTransport({ transports: [oneTransport] })
    );

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
    const t1: nodemailer.Transport = {
      name: "t1",
      send: jest.fn((mail, cb) => cb(null, { ok: true })),
      version: "0.1"
    };

    const t2: nodemailer.Transport = {
      name: "t2",
      send: jest.fn((mail, cb) => cb(null, { ok: true })),
      version: "0.1"
    };

    const t3: nodemailer.Transport = {
      name: "t3",
      send: jest.fn((mail, cb) => cb(null, { ok: true })),
      version: "0.1"
    };

    const multi = nodemailer.createTransport(
      MultiTransport({ transports: [t1, t2, t3] })
    );

    const result = await Promise.all(
      new Array(100).fill(0).map(_ => multi.sendMail(anEmailMessage))
    );

    expect(result).toHaveLength(100);
    expect(t1.send).toHaveBeenCalled();
    expect(t2.send).toHaveBeenCalled();
    expect(t3.send).toHaveBeenCalled();
  });

  it("should no add extra info", async () => {
    const oneTransport: nodemailer.Transport = {
      name: "t1",
      send: jest.fn((_, cb) => cb(null, true)),
      version: "0.1"
    };

    const multi = nodemailer.createTransport(
      MultiTransport({ transports: [oneTransport] })
    );

    const result = await multi.sendMail(anEmailMessage);

    expect(result).toEqual(true);
  });
});
