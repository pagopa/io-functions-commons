import { EmailString, FiscalCode } from "@pagopa/ts-commons/lib/strings";

import * as t from "io-ts";

export const ProfileEmail = t.type({
  email: EmailString,
  fiscalCode: FiscalCode
});

export type ProfileEmail = t.TypeOf<typeof ProfileEmail>;

export interface ProfileEmailReader {
  profileEmails(email: EmailString): AsyncIterableIterator<ProfileEmail>;
}

export interface ProfileEmailWriter {
  delete(p: ProfileEmail): Promise<void>;
  insert(p: ProfileEmail): Promise<void>;
}

interface IsEmailAlreadyTakenDependencies {
  readonly profileEmailReader: ProfileEmailReader;
}

// Checks if the given e-mail is already taken
// profileEmails returns all the ProfileEmail records that shares
// the same e-mail. If count(records) > 1 then the e-mail is already taken.
export const isEmailAlreadyTaken = (email: EmailString) => async ({
  profileEmailReader: { profileEmails }
}: IsEmailAlreadyTakenDependencies): Promise<boolean> => {
  let count = 0;
  for await (const _ of profileEmails(email)) {
    if (++count > 1) {
      return true;
    }
  }
  return false;
};
