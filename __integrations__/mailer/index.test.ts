import { readableReport } from "italia-ts-commons/lib/reporters";
import * as Mailer from "../../src/mailer";

const MAIL_FROM = "from@email.com";

const aMailhogConfig = Mailer.MailerConfig.decode({
  MAILHOG_HOSTNAME: process.env.MAILHOG_HOSTNAME || "localhost",
  MAIL_FROM,
  NODE_ENV: "development"
}).getOrElseL(e => fail(readableReport(e)));

// pointing to an unreachable Mailhog server
const aMailhogDownConfig = Mailer.MailerConfig.decode({
  ...aMailhogConfig,
  MAILHOG_HOSTNAME: "localGhost"
}).getOrElseL(e => fail(readableReport(e)));

// we cannot test a real sendgrid account for the moment
const aSendgridUnauthirizedConfig = Mailer.MailerConfig.decode({
  MAIL_FROM,
  NODE_ENV: "production",
  SENDGRID_API_KEY: "a-fake-apikey"
}).getOrElseL(e => fail(readableReport(e)));

// we cannot test a real mailup account for the moment
const aMailupUnauthirizedConfig = Mailer.MailerConfig.decode({
  MAILUP_SECRET: "a-fake-secret",
  MAILUP_USERNAME: "a-fake-username",
  MAIL_FROM,
  NODE_ENV: "production"
}).getOrElseL(e => fail(readableReport(e)));

const aMailMessage = {
  from: MAIL_FROM,
  subject: "my test email",
  text: "lorem ipsum",
  to: "example@email.com"
};

describe("Mailer", () => {
  it("should send mail to mailhog", async () => {
    const transporter = Mailer.getMailerTransporter(aMailhogConfig);

    const result = await Mailer.sendMail(transporter, aMailMessage).run();

    expect(result.value).toBe(true);
    expect(result.isRight()).toBe(true);
    // TODO: try to check mailhog inbox for the message
  });

  it("should not throw if mailhog is unreachable", async () => {
    const transporter = Mailer.getMailerTransporter(aMailhogDownConfig);

    const result = await Mailer.sendMail(transporter, aMailMessage).run();

    expect(result.isLeft()).toBe(true);
  });

  it("should not throw if sendigrid fails to authenticate", async () => {
    const transporter = Mailer.getMailerTransporter(
      aSendgridUnauthirizedConfig
    );

    const result = await Mailer.sendMail(transporter, aMailMessage).run();

    expect(result.isLeft()).toBe(true);
  });

  it("should not throw if mailup fails to authenticate", async () => {
    const transporter = Mailer.getMailerTransporter(aMailupUnauthirizedConfig);

    const result = await Mailer.sendMail(transporter, aMailMessage).run();

    expect(result.isLeft()).toBe(true);
  });
});
