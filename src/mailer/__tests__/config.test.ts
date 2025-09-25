// eslint-disable no-empty, no-empty-function

import { Either } from "fp-ts/lib/Either";
import * as E from "fp-ts/lib/Either";
import {
  MailerConfig,
  MailhogMailerConfig,
  MailupMailerConfig,
  MultiTrasnsportMailerConfig,
  SendgridMailerConfig,
  SMTPMailerConfig
} from "../config";
import { pipe } from "fp-ts/lib/function";

const aMailFrom = "example@test.com";

const noop = () => {};
const expectRight = <L, R>(e: Either<L, R>, t: (r: R) => void = noop) =>
  pipe(
    e,
    E.fold(
      l => fail(`Expecting right, received left. Value: ${JSON.stringify(l)}`),
      r => t(r)
    )
  );

const expectLeft = <L, R>(e: Either<L, R>, t: (l: L) => void = noop) =>
  pipe(
    e,
    E.fold(
      l => t(l),
      r => fail(`Expecting left, received right. Value: ${JSON.stringify(r)}`)
    )
  );

const aSendgridConf1 = {
  MAIL_FROM: aMailFrom,
  NODE_ENV: "production",
  SENDGRID_API_KEY: "a-sg-key"
};

const aSendgridConf2 = {
  MAIL_FROM: aMailFrom,
  NODE_ENV: "production",
  SENDGRID_API_KEY: "a-sg-key",
  MAILUP_USERNAME: "a-mu-username",
  MAILUP_SECRET: "a-mu-secret"
};

const aMailupConf = {
  MAIL_FROM: aMailFrom,
  NODE_ENV: "production",
  MAILUP_USERNAME: "a-mu-username",
  MAILUP_SECRET: "a-mu-secret"
};

const aMailhogConf = {
  MAIL_FROM: aMailFrom,
  NODE_ENV: "dev",
  MAILHOG_HOSTNAME: "a-mh-host"
};

const aTransport = {
  password: "abc".repeat(5),
  transport: "transport-name",
  username: "t-username"
};
const aRawTrasport = [
  aTransport.transport,
  aTransport.username,
  aTransport.password
].join(":");

const aMultiTransport = {
  MAIL_FROM: aMailFrom,
  NODE_ENV: "production",
  MAIL_TRANSPORTS: [aRawTrasport, aRawTrasport].join(";")
};

describe("MailerConfig", () => {
  it("should decode SMPT configuration without authentication", () => {
    const rawConf = {
      MAIL_FROM: aMailFrom,
      NODE_ENV: "production",

      SMTP_HOSTNAME: "localhost",
      SMTP_PORT: "1025",
      SMTP_SECURE: "true"
    };
    const result = MailerConfig.decode(rawConf);

    expectRight(result, value => {
      expect(SMTPMailerConfig.is(value)).toBe(true);
    });
  });

  it("should decode SMPT configuration without authentication", () => {
    const rawConf = {
      MAIL_FROM: aMailFrom,
      NODE_ENV: "production",

      SMTP_HOSTNAME: "localhost",
      SMTP_PORT: "1025",
      SMTP_SECURE: "true"
    };
    const result = MailerConfig.decode(rawConf);

    expectRight(result, value => {
      expect(SMTPMailerConfig.is(value)).toBe(true);
    });
  });

  it("should decode configuration for sendgrid", () => {
    const rawConf = {
      MAIL_FROM: aMailFrom,
      NODE_ENV: "production",
      SENDGRID_API_KEY: "a-sg-key"
    };
    const result = MailerConfig.decode(rawConf);

    expectRight(result, value => {
      expect(value.SENDGRID_API_KEY).toBe("a-sg-key");
      expect(SendgridMailerConfig.is(value)).toBe(true);
    });
  });

  it("should decode configuration for sendgrid even if mailup conf is passed", () => {
    const rawConf = {
      MAIL_FROM: aMailFrom,
      NODE_ENV: "production",
      SENDGRID_API_KEY: "a-sg-key",
      MAILUP_USERNAME: "a-mu-username",
      MAILUP_SECRET: "a-mu-secret"
    };
    const result = MailerConfig.decode(rawConf);

    expectRight(result, value => {
      expect(value.SENDGRID_API_KEY).toBe("a-sg-key");
      expect(SendgridMailerConfig.is(value)).toBe(true);
    });
  });

  it("should decode configuration for mailup", () => {
    const rawConf = {
      MAIL_FROM: aMailFrom,
      NODE_ENV: "production",
      MAILUP_USERNAME: "a-mu-username",
      MAILUP_SECRET: "a-mu-secret"
    };
    const result = MailerConfig.decode(rawConf);

    expectRight(result, value => {
      expect(value.MAILUP_USERNAME).toBe("a-mu-username");
      expect(value.MAILUP_SECRET).toBe("a-mu-secret");
      expect(MailupMailerConfig.is(value)).toBe(true);
    });
  });

  it("should decode configuration with multi transport", () => {
    const result = MailerConfig.decode(aMultiTransport);

    expectRight(result, value => {
      expect(value.MAIL_TRANSPORTS).toEqual([aTransport, aTransport]);
      expect(MultiTrasnsportMailerConfig.is(value)).toBe(true);
    });
  });

  it("should decode configuration for mailhog", () => {
    const result = MailerConfig.decode(aMailhogConf);

    expectRight(result, value => {
      expect(value.MAILHOG_HOSTNAME).toBe("a-mh-host");
      expect(MailhogMailerConfig.is(value)).toBe(true);
    });
  });

  it("should require mailhog if not in prod", () => {
    const rawConf = {
      MAIL_FROM: aMailFrom,
      NODE_ENV: "dev"
    };
    const result = MailerConfig.decode(rawConf);

    expectLeft(result);
  });

  it("should require at least on transporter if in prod", () => {
    const rawConf = {
      MAIL_FROM: aMailFrom,
      NODE_ENV: "production"
    };
    const result = MailerConfig.decode(rawConf);

    expectLeft(result);
  });

  it("should not allow mailhog if in prod", () => {
    const rawConf = {
      MAIL_FROM: aMailFrom,
      NODE_ENV: "production",
      MAILHOG_HOSTNAME: "a-mh-host"
    };
    const result = MailerConfig.decode(rawConf);

    expectLeft(result);
  });

  it("should not decode configuration with empty transport", () => {
    const rawConf = {
      MAIL_FROM: aMailFrom,
      NODE_ENV: "production",
      MAIL_TRANSPORTS: ""
    };
    const result = MailerConfig.decode(rawConf);

    expectLeft(result);
  });

  it("should not decode configuration when no transporter is specified", () => {
    const rawConf = {
      MAIL_FROM: aMailFrom
    };
    const result = MailerConfig.decode(rawConf);

    expectLeft(result);
  });

  it("should not decode ambiguos configuration", () => {
    const withMailUp = {
      MAILUP_USERNAME: "a-mu-username",
      MAILUP_SECRET: "a-mu-secret"
    };
    const withSendGrid = {
      SENDGRID_API_KEY: "a-sg-key"
    };
    const withMultiTransport = {
      MAIL_TRANSPORTS: "a-trasnport-name"
    };
    const base = {
      MAIL_FROM: aMailFrom,
      NODE_ENV: "production"
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const examples: ReadonlyArray<any> = [
      // the following configuration is not ambiguos as sendgrid would override mailup anyway
      // see here for the rationale: https://github.com/pagopa/io-functions-admin/pull/89#commitcomment-42917672
      // { ...base, ...withMailUp, ...withSendGrid },
      { ...base, ...withMultiTransport, ...withSendGrid },
      { ...base, ...withMailUp, ...withMultiTransport },
      { ...base, ...withMailUp, ...withSendGrid, ...withMultiTransport }
    ];

    examples.map(MailerConfig.decode).forEach(_ => expectLeft(_));
  });

  it.each`
    name             | conf
    ${"mailup"}      | ${aMailupConf}
    ${"sendgrid(1)"} | ${aSendgridConf1}
    ${"sendgrid(2)"} | ${aSendgridConf2}
    ${"multi"}       | ${aMultiTransport}
    ${"mailhog"}     | ${aMailhogConf}
  `("should match $name with one and one only config type", ({ conf }) => {
    const decoded = MailerConfig.decode(conf);
    expectRight(decoded, value => {
      // iterate config types to be sure that one and one only matches the decoded value
      expect(
        [
          MailhogMailerConfig,
          MailupMailerConfig,
          MultiTrasnsportMailerConfig,
          SendgridMailerConfig
        ].filter(x => x.is(value)).length
      ).toBe(1);
    });
  });
});
