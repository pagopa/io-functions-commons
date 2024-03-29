import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import fetch from "node-fetch";
import * as Mailer from "../../src/mailer";

import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";

const MAIL_FROM = "from@email.com";

const aMailhogConfig = pipe(
  Mailer.MailerConfig.decode({
    MAILHOG_HOSTNAME: process.env.MAILHOG_HOSTNAME || "localhost",
    MAIL_FROM,
    NODE_ENV: "development"
  }),
  E.getOrElseW(e => fail(readableReport(e)))
);

// pointing to an unreachable Mailhog server
const aMailhogDownConfig = pipe(
  Mailer.MailerConfig.decode({
    ...aMailhogConfig,
    MAILHOG_HOSTNAME: "localGhost"
  }),
  E.getOrElseW(e => fail(readableReport(e)))
);

// we cannot test a real sendgrid account for the moment
const aSendgridUnauthirizedConfig = pipe(
  Mailer.MailerConfig.decode({
    MAIL_FROM,
    NODE_ENV: "production",
    SENDGRID_API_KEY: "a-fake-apikey"
  }),
  E.getOrElseW(e => fail(readableReport(e)))
);

// we cannot test a real mailup account for the moment
const aMailupUnauthirizedConfig = pipe(
  Mailer.MailerConfig.decode({
    MAILUP_SECRET: "a-fake-secret",
    MAILUP_USERNAME: "a-fake-username",
    MAIL_FROM,
    NODE_ENV: "production"
  }),
  E.getOrElseW(e => fail(readableReport(e)))
);

const aMailMessage = {
  from: MAIL_FROM,
  subject: "my test email",
  text: "lorem ipsum",
  to: "example@email.com"
};

describe("Mailer", () => {
  it("should send mail to mailhog", async () => {
    const transporter = Mailer.getMailerTransporter(aMailhogConfig);

    const result = await Mailer.sendMail(transporter, aMailMessage)();
    // we use Mailhog exposed rest api to check if the message has been correctly delivered
    // https://github.com/mailhog/MailHog/blob/master/docs/APIv2/swagger-2.0.yaml
    const { items } = await fetch(
      `http://${aMailhogConfig.MAILHOG_HOSTNAME}:8025/api/v2/messages`
    ).then(e => e.json());

    expect(E.isRight(result)).toBe(true);
    // checks if any of the retrieved messages is the one we sent
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          Raw: expect.objectContaining({
            From: aMailMessage.from,
            To: [aMailMessage.to]
          })
        })
      ])
    );
  });

  it("should not throw if mailhog is unreachable", async () => {
    const transporter = Mailer.getMailerTransporter(aMailhogDownConfig);

    const result = await Mailer.sendMail(transporter, aMailMessage)();

    expect(E.isLeft(result)).toBe(true);
  });

  it("should not throw if sendigrid fails to authenticate", async () => {
    const transporter = Mailer.getMailerTransporter(
      aSendgridUnauthirizedConfig
    );

    const result = await Mailer.sendMail(transporter, aMailMessage)();

    expect(E.isLeft(result)).toBe(true);
  });

  it("should not throw if mailup fails to authenticate", async () => {
    const transporter = Mailer.getMailerTransporter(aMailupUnauthirizedConfig);

    const result = await Mailer.sendMail(transporter, aMailMessage)();

    expect(E.isLeft(result)).toBe(true);
  });
});
