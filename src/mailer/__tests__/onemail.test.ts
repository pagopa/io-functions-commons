// eslint-disable @typescript-eslint/no-explicit-any

jest.mock("winston");

import * as Mail from "nodemailer/lib/mailer";

import * as nodemailer from "nodemailer";

import { OneMailTransport, SEND_HIGH_PRIORITY_EMAIL_PATH } from "../onemail";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetAllMocks();
});

const aBaseUrl = "https://onemail.example.com" as NonEmptyString;
const anApiKey = "an-api-key" as NonEmptyString;
const aTenantName = "a-tenant" as NonEmptyString;

// format required by nodemailer
const anEmailMessage: Mail.Options = {
  from: "foo <foo@example.com>",
  headers: {
    "X-Header": "value"
  },
  html: "lorem ipsum <b>html></b>",
  subject: "lorem ipsum",
  text: "lorem impsum",
  to: "bar <bar@example.com>"
};

// format required by OneMail high-priority API
const anEmailPayload = {
  emailContent: {
    html: "lorem ipsum <b>html></b>",
    subject: "lorem ipsum",
    text: "lorem impsum"
  },
  extendedHeaders: [{ N: "X-Header", V: "value" }],
  from: { email: "foo@example.com", name: "foo" },
  to: { email: "bar@example.com", name: "bar" }
};

const aSuccessResponse = {
  requestId: "a-request-id"
};

const anOptions = {
  apiKey: anApiKey,
  baseUrl: aBaseUrl,
  tenantName: aTenantName
};

const mockFetch = <T>(status: number, json: T, ok = true) =>
  jest.fn().mockReturnValue(
    Promise.resolve({
      json: () => Promise.resolve(json),
      ok,
      status
    })
  );

describe("OneMailTransport#sendMail", () => {
  it("should get a success response from the API endpoint", async () => {
    const fetchAgent = mockFetch(202, aSuccessResponse);
    const aNodemailerTransporter = nodemailer.createTransport(
      OneMailTransport({
        ...anOptions,
        fetchAgent
      })
    );

    const response = await aNodemailerTransporter.sendMail(anEmailMessage);

    expect(fetchAgent).toHaveBeenCalledWith(
      `${aBaseUrl}${SEND_HIGH_PRIORITY_EMAIL_PATH}`,
      {
        body: JSON.stringify(anEmailPayload),
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anApiKey,
          "x-tenant-name": aTenantName
        },
        method: "POST"
      }
    );
    expect(response).toEqual(
      expect.objectContaining({ requestId: aSuccessResponse.requestId })
    );
  });

  it("should append the dryRun query param when enabled", async () => {
    const fetchAgent = mockFetch(202, aSuccessResponse);
    const aNodemailerTransporter = nodemailer.createTransport(
      OneMailTransport({
        ...anOptions,
        dryRun: true,
        fetchAgent
      })
    );

    await aNodemailerTransporter.sendMail(anEmailMessage);

    expect(fetchAgent).toHaveBeenCalledWith(
      `${aBaseUrl}${SEND_HIGH_PRIORITY_EMAIL_PATH}?dryRun=true`,
      expect.anything()
    );
  });

  it("should fail on empty from address", async () => {
    const aNodemailerTransporter = nodemailer.createTransport(
      OneMailTransport({
        ...anOptions,
        fetchAgent: mockFetch(202, aSuccessResponse)
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

  it("should fail on empty subject", async () => {
    const aNodemailerTransporter = nodemailer.createTransport(
      OneMailTransport({
        ...anOptions,
        fetchAgent: mockFetch(202, aSuccessResponse)
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
      OneMailTransport({
        ...anOptions,
        fetchAgent: mockFetch(202, aSuccessResponse)
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

  it("should fail when multiple recipients are provided", async () => {
    const aNodemailerTransporter = nodemailer.createTransport(
      OneMailTransport({
        ...anOptions,
        fetchAgent: mockFetch(202, aSuccessResponse)
      })
    );
    expect.assertions(2);
    try {
      await aNodemailerTransporter.sendMail({
        ...anEmailMessage,
        to: ["bar <bar@example.com>", "baz <baz@example.com>"]
      });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toContain("single recipient");
    }
  });

  it("should fail when attachments are provided", async () => {
    const aNodemailerTransporter = nodemailer.createTransport(
      OneMailTransport({
        ...anOptions,
        fetchAgent: mockFetch(202, aSuccessResponse)
      })
    );
    expect.assertions(2);
    try {
      await aNodemailerTransporter.sendMail({
        ...anEmailMessage,
        attachments: [{ filename: "lorem.txt", content: "lorem ipsum" }]
      });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toContain("attachments");
    }
  });

  it("should fail on network error", async () => {
    const fetchAgent = jest.fn().mockRejectedValueOnce("foo");
    const aNodemailerTransporter = nodemailer.createTransport(
      OneMailTransport({
        ...anOptions,
        fetchAgent
      })
    );
    expect.assertions(2);
    try {
      await aNodemailerTransporter.sendMail(anEmailMessage);
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toContain("foo");
    }
  });

  it("should fail on non-2xx response", async () => {
    const fetchAgent = mockFetch(400, aSuccessResponse, false);
    const aNodemailerTransporter = nodemailer.createTransport(
      OneMailTransport({
        ...anOptions,
        fetchAgent
      })
    );
    expect.assertions(2);
    try {
      await aNodemailerTransporter.sendMail(anEmailMessage);
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toContain("400");
    }
  });

  it("should fail when the response cannot be decoded", async () => {
    const fetchAgent = mockFetch(202, { unexpected: "shape" });
    const aNodemailerTransporter = nodemailer.createTransport(
      OneMailTransport({
        ...anOptions,
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
