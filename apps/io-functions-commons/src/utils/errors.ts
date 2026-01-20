/**
 * Contains Error types,
 * used to clarify the intent of a throw
 * and useful inside unit tests.
 */

export enum ErrorTypes {
  // message is expired, it couldn't be delivered withing the TTL

  ExpiredError = "ExpiredError",

  // a permanent error while processing the message (operation cannot be retried)

  PermanentError = "PermanentError",

  // a recipient error, either the profile is non existent or the sender isn't
  // allowed by the recipient

  RecipientError = "RecipientError",

  // a temporary error while processing the message (operation can be retried)

  TransientError = "TransientError",

  // triggered when an unknown error gets catched

  UnknownError = "UnknownError",
}

interface IRuntimeError<T extends ErrorTypes> {
  readonly cause?: Error;
  readonly kind: T;
  readonly message: string;
}

const RuntimeError =
  <T extends ErrorTypes>(
    kind: T,
  ): ((message: string, cause?: Error) => IRuntimeError<T>) =>
  (message: string, cause?: Error): IRuntimeError<T> => ({
    cause,
    kind,
    message,
  });

export type TransientError = IRuntimeError<ErrorTypes.TransientError>;
export const TransientError = RuntimeError(ErrorTypes.TransientError);

export type PermanentError = IRuntimeError<ErrorTypes.PermanentError>;
export const PermanentError = RuntimeError(ErrorTypes.PermanentError);

export type UnknownError = IRuntimeError<ErrorTypes.UnknownError>;
export const UnknownError = RuntimeError(ErrorTypes.UnknownError);

export type ExpiredError = IRuntimeError<ErrorTypes.ExpiredError>;
export const ExpiredError = RuntimeError(ErrorTypes.ExpiredError);

export type RecipientError = IRuntimeError<ErrorTypes.RecipientError>;
export const RecipientError = RuntimeError(ErrorTypes.RecipientError);

/**
 * Construct a RuntimeError from an object.
 * Useful in try / catch blocks where the object caught is untyped.
 */

export const toRuntimeError = (error: any): RuntimeError =>
  // eslint-disable-next-line no-prototype-builtins
  error && ErrorTypes.hasOwnProperty(error.kind)
    ? error
    : UnknownError(
        error instanceof Error && error.message
          ? error.message
          : JSON.stringify(error),
        error instanceof Error ? error : undefined,
      );

export type RuntimeError =
  | ExpiredError
  | PermanentError
  | RecipientError
  | TransientError
  | UnknownError;

export const isTransientError = (
  error: RuntimeError,
): error is TransientError =>
  error.kind && error.kind === ErrorTypes.TransientError;

export const isExpiredError = (error: RuntimeError): error is ExpiredError =>
  error.kind && error.kind === ErrorTypes.ExpiredError;

export const isRecipientError = (error: RuntimeError): error is ExpiredError =>
  error.kind && error.kind === ErrorTypes.RecipientError;
