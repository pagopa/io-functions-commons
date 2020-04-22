// tslint:disable:no-any

jest.mock("winston");

// tslint:disable-next-line:no-submodule-imports
import Mail = require("nodemailer/lib/mailer");

import * as nodemailer from "nodemailer";

import { MailUpTransport, SmtpAuthInfo } from "../mailup";

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetAllMocks();
});

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

// format required by MailUp APIs
const anEmailPayload = {
  ExtendedHeaders: [{ N: "X-Header", V: "value" }],
  From: { Email: "foo@example.com", Name: "foo" },
  Html: { Body: "lorem ipsum <b>html></b>" },
  ReplyTo: "foobar@example.com",
  Subject: "lorem ipsum",
  Text: "lorem impsum",
  To: [{ Email: "bar@example.com", Name: "bar" }]
};

const someCreds = SmtpAuthInfo.decode({
  Secret: "secret",
  Username: "username"
}).getOrElseL(() => {
  throw new Error("Invalid SMTP credentials");
});

const aResponsePayload = {
  Code: "0",
  Message: "",
  Status: "200"
};

const mockFetch = <T>(status: number, json: T) => {
  return (jest.fn(() => ({
    json: () => Promise.resolve(json),
    status,
    then: () => Promise.resolve(json)
  })) as unknown) as typeof fetch;
};

describe("sendMail", () => {
  it("should get a success response from the API endpoint", async () => {
    const aNodemailerTransporter = nodemailer.createTransport(
      MailUpTransport({
        creds: someCreds
      })
    );

    const response = await aNodemailerTransporter.sendMail(anEmailMessage);

    expect(mockFetch).toHaveBeenCalledWith({
      ...anEmailPayload,
      User: someCreds
    });
    expect(response).toEqual(aResponsePayload);
  });

  it("should fail on empty from address", async () => {
    const aNodemailerTransporter = nodemailer.createTransport(
      MailUpTransport({
        creds: someCreds,
        fetchAgent: mockFetch(200, aResponsePayload)
      })
    );
    expect.assertions(1);
    try {
      await aNodemailerTransporter.sendMail({
        ...anEmailMessage,
        from: undefined
      });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it("should fail on malformed email payload", async () => {
    const aNodemailerTransporter = nodemailer.createTransport(
      MailUpTransport({
        creds: someCreds,
        fetchAgent: mockFetch(200, aResponsePayload)
      })
    );
    expect.assertions(1);
    try {
      await aNodemailerTransporter.sendMail({
        ...anEmailMessage,
        subject: undefined
      });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it("should fail on empty destination address", async () => {
    const aNodemailerTransporter = nodemailer.createTransport(
      MailUpTransport({
        creds: someCreds,
        fetchAgent: mockFetch(200, aResponsePayload)
      })
    );
    expect.assertions(1);
    try {
      await aNodemailerTransporter.sendMail({
        ...anEmailMessage,
        to: undefined
      });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it("should fail on API error", async () => {
    const aNodemailerTransporter = nodemailer.createTransport(
      MailUpTransport({
        creds: someCreds,
        fetchAgent: mockFetch(500, aResponsePayload)
      })
    );
    expect.assertions(1);
    try {
      await aNodemailerTransporter.sendMail(anEmailMessage);
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });
});
