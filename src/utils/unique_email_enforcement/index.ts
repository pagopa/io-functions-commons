import { EmailString, FiscalCode } from "@pagopa/ts-commons/lib/strings";

import * as t from "io-ts";

export const ProfileEmail = t.type({
  email: EmailString,
  fiscalCode: FiscalCode
});

export type ProfileEmail = t.TypeOf<typeof ProfileEmail>;

export interface IProfileEmailReader {
  readonly list: (filter: EmailString) => AsyncIterableIterator<ProfileEmail>;
}

export interface IProfileEmailWriter {
  readonly delete: (p: ProfileEmail) => Promise<void>;
  readonly insert: (p: ProfileEmail) => Promise<void>;
}

type ProfileEmailWriterErrorCause =
  | "ENTITY_NOT_FOUND"
  | "DUPLICATE_ENTITY"
  | "STORAGE_ERROR";

export class ProfileEmailWriterError extends Error {
  name = "ProfileEmailWriterError";
  cause: ProfileEmailWriterErrorCause;

  constructor(message: string, cause: ProfileEmailWriterErrorCause) {
    super(message);
    this.cause = cause;
  }

  static is(u: unknown): u is ProfileEmailWriterError {
    return u instanceof Error && u.name === "ProfileEmailWriterError";
  }
}

// Checks if the given e-mail is already taken
// profileEmails returns all the ProfileEmail records that shares
// the same e-mail. If count(records) >= 1 then the e-mail is already taken.
export const isEmailAlreadyTaken = (email: EmailString) => async ({
  profileEmails
}: {
  readonly profileEmails: IProfileEmailReader;
}): Promise<boolean> => {
  const emails = profileEmails.list(email);
  try {
    const item = await emails.next();
    return item.done === false;
  } catch (cause) {
    throw new Error("unable to obtain taken emails from storage");
  }
};
