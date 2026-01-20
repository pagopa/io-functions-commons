// eslint-disable no-empty, no-empty-function

import { Either } from "fp-ts/lib/Either";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";

import {
  MailerConfig,
  MailhogMailerConfig,
  MailupMailerConfig,
  MultiTrasnsportMailerConfig,
  SendgridMailerConfig,
  SMTPMailerConfig,
} from "../config";

const aMailFrom = "example@test.com";

const noop = () => {};
const expectRight = <L, R>(e: Either<L, R>, t: (r: R) => void = noop) =>
  pipe(
    e,
    E.fold(
      (l) =>
        fail(`Expecting right, received left. Value: ${JSON.stringify(l)}`),
      (r) => t(r),
    ),
  );

const expectLeft = <L, R>(e: Either<L, R>, t: (l: L) => void = noop) =>
  pipe(
    e,
    E.fold(
      (l) => t(l),
      (r) =>
        fail(`Expecting left, received right. Value: ${JSON.stringify(r)}`),
    ),
  );

const aSendgridConf1 = {
  MAIL_FROM: aMailFrom,
  NODE_ENV: "production",
  SENDGRID_API_KEY: "a-sg-key",
};

const aSendgridConf2 = {
  MAIL_FROM: aMailFrom,
  MAILUP_SECRET: "a-mu-secret",
  MAILUP_USERNAME: "a-mu-username",
  NODE_ENV: "production",
  SENDGRID_API_KEY: "a-sg-key",
};

const aMailupConf = {
  MAIL_FROM: aMailFrom,
  MAILUP_SECRET: "a-mu-secret",
  MAILUP_USERNAME: "a-mu-username",
  NODE_ENV: "production",
};

const aMailhogConf = {
  MAIL_FROM: aMailFrom,
  MAILHOG_HOSTNAME: "a-mh-host",
  NODE_ENV: "dev",
};

const anSMTPWithoutAuthConfig = {
  MAIL_FROM: aMailFrom,
  NODE_ENV: "production",

  SMTP_HOSTNAME: "localhost",
  SMTP_PORT: "1025",
  SMTP_SECURE: "true",
  SMTP_USE_POOL: "true",
};

const anSMTPWithAuthConfig = {
  ...anSMTPWithoutAuthConfig,
  SMTP_PASS: "aPass",
  SMTP_USER: "aUser",
};

const aTransport = {
  password: "abc".repeat(5),
  transport: "transport-name",
  username: "t-username",
};
const aRawTrasport = [
  aTransport.transport,
  aTransport.username,
  aTransport.password,
].join(":");

const aMultiTransport = {
  MAIL_FROM: aMailFrom,
  MAIL_TRANSPORTS: [aRawTrasport, aRawTrasport].join(";"),
  NODE_ENV: "production",
};

describe("MailerConfig", () => {
  it("should decode SMPT configuration without authentication", () => {
    const rawConf = anSMTPWithoutAuthConfig;
    const result = MailerConfig.decode(rawConf);

    expectRight(result, (value) => {
      expect(SMTPMailerConfig.is(value)).toBe(true);
      expect(result).toMatchObject(
        E.right({
          SMTP_PASS: undefined,
          SMTP_USER: undefined,
        }),
      );
    });
  });

  it("should decode SMTP configuration with authentication", () => {
    const rawConf = anSMTPWithAuthConfig;
    const result = MailerConfig.decode(rawConf);

    expectRight(result, (value) => {
      expect(SMTPMailerConfig.is(value)).toBe(true);
      expect(result).toMatchObject(
        E.right({ SMTP_PASS: "aPass", SMTP_USER: "aUser" }),
      );
    });
  });

  it("should decode configuration for sendgrid", () => {
    const rawConf = {
      MAIL_FROM: aMailFrom,
      NODE_ENV: "production",
      SENDGRID_API_KEY: "a-sg-key",
    };
    const result = MailerConfig.decode(rawConf);

    expectRight(result, (value) => {
      expect(value.SENDGRID_API_KEY).toBe("a-sg-key");
      expect(SendgridMailerConfig.is(value)).toBe(true);
    });
  });

  it("should decode configuration for sendgrid even if mailup conf is passed", () => {
    const rawConf = {
      MAIL_FROM: aMailFrom,
      MAILUP_SECRET: "a-mu-secret",
      MAILUP_USERNAME: "a-mu-username",
      NODE_ENV: "production",
      SENDGRID_API_KEY: "a-sg-key",
    };
    const result = MailerConfig.decode(rawConf);

    expectRight(result, (value) => {
      expect(value.SENDGRID_API_KEY).toBe("a-sg-key");
      expect(SendgridMailerConfig.is(value)).toBe(true);
    });
  });

  it("should decode configuration for mailup", () => {
    const rawConf = {
      MAIL_FROM: aMailFrom,
      MAILUP_SECRET: "a-mu-secret",
      MAILUP_USERNAME: "a-mu-username",
      NODE_ENV: "production",
    };
    const result = MailerConfig.decode(rawConf);

    expectRight(result, (value) => {
      expect(value.MAILUP_USERNAME).toBe("a-mu-username");
      expect(value.MAILUP_SECRET).toBe("a-mu-secret");
      expect(MailupMailerConfig.is(value)).toBe(true);
    });
  });

  it("should decode configuration with multi transport", () => {
    const result = MailerConfig.decode(aMultiTransport);

    expectRight(result, (value) => {
      expect(value.MAIL_TRANSPORTS).toEqual([aTransport, aTransport]);
      expect(MultiTrasnsportMailerConfig.is(value)).toBe(true);
    });
  });

  it("should decode configuration for mailhog", () => {
    const result = MailerConfig.decode(aMailhogConf);

    expectRight(result, (value) => {
      expect(value.MAILHOG_HOSTNAME).toBe("a-mh-host");
      expect(MailhogMailerConfig.is(value)).toBe(true);
    });
  });

  it("should require mailhog if not in prod", () => {
    const rawConf = {
      MAIL_FROM: aMailFrom,
      NODE_ENV: "dev",
    };
    const result = MailerConfig.decode(rawConf);

    expectLeft(result);
  });

  it("should require at least on transporter if in prod", () => {
    const rawConf = {
      MAIL_FROM: aMailFrom,
      NODE_ENV: "production",
    };
    const result = MailerConfig.decode(rawConf);

    expectLeft(result);
  });

  it("should not allow mailhog if in prod", () => {
    const rawConf = {
      MAIL_FROM: aMailFrom,
      MAILHOG_HOSTNAME: "a-mh-host",
      NODE_ENV: "production",
    };
    const result = MailerConfig.decode(rawConf);

    expectLeft(result);
  });

  it("should not decode configuration with empty transport", () => {
    const rawConf = {
      MAIL_FROM: aMailFrom,
      MAIL_TRANSPORTS: "",
      NODE_ENV: "production",
    };
    const result = MailerConfig.decode(rawConf);

    expectLeft(result);
  });

  it("should not decode configuration when no transporter is specified", () => {
    const rawConf = {
      MAIL_FROM: aMailFrom,
    };
    const result = MailerConfig.decode(rawConf);

    expectLeft(result);
  });

  it("should not decode ambiguos configuration", () => {
    const withMailUp = {
      MAILUP_SECRET: "a-mu-secret",
      MAILUP_USERNAME: "a-mu-username",
    };
    const withSendGrid = {
      SENDGRID_API_KEY: "a-sg-key",
    };
    const withMultiTransport = {
      MAIL_TRANSPORTS: "a-trasnport-name",
    };
    const base = {
      MAIL_FROM: aMailFrom,
      NODE_ENV: "production",
    };

    const examples: readonly any[] = [
      // the following configuration is not ambiguos as sendgrid would override mailup anyway
      // see here for the rationale: https://github.com/pagopa/io-functions-admin/pull/89#commitcomment-42917672
      // { ...base, ...withMailUp, ...withSendGrid },
      { ...base, ...withMultiTransport, ...withSendGrid },
      { ...base, ...withMailUp, ...withMultiTransport },
      { ...base, ...withMailUp, ...withSendGrid, ...withMultiTransport },
    ];

    examples.map(MailerConfig.decode).forEach((_) => expectLeft(_));
  });

  it.each`
    name             | conf
    ${"mailup"}      | ${aMailupConf}
    ${"sendgrid(1)"} | ${aSendgridConf1}
    ${"sendgrid(2)"} | ${aSendgridConf2}
    ${"multi"}       | ${aMultiTransport}
    ${"mailhog"}     | ${aMailhogConf}
    ${"smtp(1)"}     | ${anSMTPWithoutAuthConfig}
    ${"smtp(2)"}     | ${anSMTPWithAuthConfig}
  `("should match $name with one and one only config type", ({ conf }) => {
    const decoded = MailerConfig.decode(conf);
    expectRight(decoded, (value) => {
      // iterate config types to be sure that one and one only matches the decoded value
      expect(
        [
          MailhogMailerConfig,
          MailupMailerConfig,
          MultiTrasnsportMailerConfig,
          SendgridMailerConfig,
          SMTPMailerConfig,
        ].filter((x) => x.is(value)).length,
      ).toBe(1);
    });
  });
});
