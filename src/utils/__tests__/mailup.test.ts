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

const mockFetch = (status: number, json: unknown, ok = true) => {
  const mockResponse = Promise.resolve({
    json: () => Promise.resolve(json),
    ok,
    status
  });
  return (jest.fn(() => mockResponse) as unknown) as typeof fetch;
};

describe("sendMail", () => {
  it("should get a success response from the API endpoint", async () => {
    const fetchAgent = mockFetch(200, aResponsePayload);
    const aNodemailerTransporter = nodemailer.createTransport(
      MailUpTransport({
        creds: someCreds,
        fetchAgent
      })
    );

    const response = await aNodemailerTransporter.sendMail(anEmailMessage);

    expect(fetchAgent).toHaveBeenCalledWith(
      "https://send.mailup.com/API/v2.0/messages/sendmessage",
      {
        body: JSON.stringify({
          ...anEmailPayload,
          User: someCreds
        }),
        method: "POST"
      }
    );
    expect(response).toEqual(aResponsePayload);
  });

  it("should fail on empty from address", async () => {
    const fetchAgent = mockFetch(200, aResponsePayload);
    const aNodemailerTransporter = nodemailer.createTransport(
      MailUpTransport({
        creds: someCreds,
        fetchAgent
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
    const fetchAgent = mockFetch(200, aResponsePayload);
    const aNodemailerTransporter = nodemailer.createTransport(
      MailUpTransport({
        creds: someCreds,
        fetchAgent
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
    const fetchAgent = mockFetch(200, aResponsePayload);
    const aNodemailerTransporter = nodemailer.createTransport(
      MailUpTransport({
        creds: someCreds,
        fetchAgent
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
    const fetchAgent = mockFetch(500, aResponsePayload, false);
    const aNodemailerTransporter = nodemailer.createTransport(
      MailUpTransport({
        creds: someCreds,
        fetchAgent
      })
    );
    expect.assertions(1);
    try {
      await aNodemailerTransporter.sendMail(anEmailMessage);
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it("should fail on invalid response payload", async () => {
    const fetchAgent = mockFetch(200, {});
    const aNodemailerTransporter = nodemailer.createTransport(
      MailUpTransport({
        creds: someCreds,
        fetchAgent
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
