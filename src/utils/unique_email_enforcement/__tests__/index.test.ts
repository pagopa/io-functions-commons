import { describe, test, expect } from "@jest/globals";

import { EmailString, FiscalCode } from "@pagopa/ts-commons/lib/strings";

import { isEmailAlreadyTaken } from "../index";

const mocks = {
  email: "citizen@email.test.pagopa.it" as EmailString
};

function generateProfileEmails(count: number) {
  return async function*(email: EmailString) {
    for (let i = 0; i < count; i++) {
      yield { email, fiscalCode: "X" as FiscalCode };
    }
  };
}

describe("isEmailAlreadyTaken", () => {
  test.each([
    {
      entries: 0,
      expected: false
    },
    {
      entries: 1,
      expected: true
    },
    {
      entries: 100,
      expected: true
    },
    {
      entries: 2,
      expected: true
    }
  ])(
    `${mocks.email} is used by $entries profiles, so isEmailAlreadyTaken should be $expected`,
    ({ entries, expected }) => {
      const result = isEmailAlreadyTaken(mocks.email)({
        profileEmailReader: {
          listProfileEmails: generateProfileEmails(entries)
        }
      });
      expect(result).resolves.toBe(expected);
    }
  );
});
