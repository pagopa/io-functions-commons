// eslint-disable @typescript-eslint/no-explicit-any

vi.mock("winston");

import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as nodemailer from "nodemailer";
import * as Mail from "nodemailer/lib/mailer";

import {
  MailUpTransport,
  SEND_TRANSACTIONAL_MAIL_ENDPOINT,
  SmtpAuthInfo,
} from "../mailup";
import { vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

// format required by nodemailer
const anEmailMessage: Mail.Options = {
  from: "foo <foo@example.com>",
  headers: {
    "X-Header": "value",
  },
  html: "lorem ipsum <b>html></b>",
  replyTo: "foobar@example.com",
  subject: "lorem ipsum",
  text: "lorem impsum",
  to: "bar <bar@example.com>",
};

// format required by MailUp APIs
const anEmailPayload = {
  ExtendedHeaders: [{ N: "X-Header", V: "value" }],
  From: { Email: "foo@example.com", Name: "foo" },
  Html: { Body: "lorem ipsum <b>html></b>" },
  ReplyTo: "foobar@example.com",
  Subject: "lorem ipsum",
  Text: "lorem impsum",
  To: [{ Email: "bar@example.com", Name: "bar" }],
};

const someCreds = pipe(
  SmtpAuthInfo.decode({
    Secret: "secret",
    Username: "username",
  }),
  E.getOrElseW(() => {
    throw new Error("Invalid SMTP credentials");
  }),
);

const aResponsePayload = {
  Code: "0",
  Message: "",
  Status: "200",
};

const mockFetch = <T>(status: number, json: T, ok = true) =>
  vi.fn().mockReturnValue(
    Promise.resolve({
      json: () => Promise.resolve(json),
      ok,
      status,
    }),
  );

describe("sendMail", () => {
  it("should get a success response from the API endpoint", async () => {
    const fetchAgent = mockFetch(200, aResponsePayload);
    const aNodemailerTransporter = nodemailer.createTransport(
      MailUpTransport({
        creds: someCreds,
        fetchAgent,
      }),
    );

    const response = await aNodemailerTransporter.sendMail(anEmailMessage);

    expect(fetchAgent).toHaveBeenCalledWith(SEND_TRANSACTIONAL_MAIL_ENDPOINT, {
      body: JSON.stringify({
        ...anEmailPayload,
        User: someCreds,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    expect(response).toEqual(aResponsePayload);
  });

  it("should fail on empty from address", async () => {
    const aNodemailerTransporter = nodemailer.createTransport(
      MailUpTransport({
        creds: someCreds,
        fetchAgent: mockFetch(200, aResponsePayload),
      }),
    );
    expect.assertions(1);
    try {
      await aNodemailerTransporter.sendMail({
        ...anEmailMessage,
        from: undefined,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it("should fail on malformed email payload", async () => {
    const aNodemailerTransporter = nodemailer.createTransport(
      MailUpTransport({
        creds: someCreds,
        fetchAgent: mockFetch(200, aResponsePayload),
      }),
    );
    expect.assertions(1);
    try {
      await aNodemailerTransporter.sendMail({
        ...anEmailMessage,
        subject: undefined,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it("should fail on empty destination address", async () => {
    const aNodemailerTransporter = nodemailer.createTransport(
      MailUpTransport({
        creds: someCreds,
        fetchAgent: mockFetch(200, aResponsePayload),
      }),
    );
    expect.assertions(1);
    try {
      await aNodemailerTransporter.sendMail({
        ...anEmailMessage,
        to: undefined,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it("should fail on network error", async () => {
    const fetchAgent = vi.fn().mockRejectedValueOnce("foo");
    const aNodemailerTransporter = nodemailer.createTransport(
      MailUpTransport({
        creds: someCreds,
        fetchAgent,
      }),
    );
    expect.assertions(2);
    try {
      await aNodemailerTransporter.sendMail(anEmailMessage);
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toContain("foo");
    }
  });

  it("should fail on fetch error", async () => {
    const fetchAgent = mockFetch(400, aResponsePayload, false);
    const aNodemailerTransporter = nodemailer.createTransport(
      MailUpTransport({
        creds: someCreds,
        fetchAgent,
      }),
    );
    expect.assertions(2);
    try {
      await aNodemailerTransporter.sendMail(anEmailMessage);
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toContain("400");
    }
  });

  it("should fail on API error", async () => {
    const fetchAgent = mockFetch(400, {
      Code: "-1",
      Message: "foobar",
      Status: "400",
    });
    const aNodemailerTransporter = nodemailer.createTransport(
      MailUpTransport({
        creds: someCreds,
        fetchAgent,
      }),
    );
    expect.assertions(2);
    try {
      await aNodemailerTransporter.sendMail(anEmailMessage);
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toContain("foobar");
    }
  });
});
