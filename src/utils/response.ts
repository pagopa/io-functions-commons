import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import {
  HttpStatusCodeEnum,
  IResponse,
  ResponseErrorGeneric
} from "@pagopa/ts-commons/lib/responses";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { withoutUndefinedValues } from "@pagopa/ts-commons/lib/types";
import * as express from "express";
import { fromNullable } from "fp-ts/lib/Option";
import { asyncIteratorToArray } from "./async";
import { CosmosErrors } from "./cosmosdb_model";
import { fillPage } from "./paging";

/**
 * Interface for a successful response returning a json object.
 */
export interface IResponseSuccessJsonIterator<T>
  extends IResponse<"IResponseSuccessJsonIterator"> {
  readonly value: T; // needed to discriminate from other T subtypes
  readonly apply: (
    response: express.Response
  ) => Promise<void | IResponseErrorQuery | express.Response>;
}
export interface IResponseSuccessPageIdBasedIterator<T>
  extends IResponse<"IResponseSuccessPageIdBasedIterator"> {
  readonly value: T; // needed to discriminate from other T subtypes
  readonly apply: (
    response: express.Response
  ) => Promise<void | IResponseErrorQuery | express.Response>;
}

/**
 * A response that consumes and return the Cosmosdb iterator as a json array
 * or an error in case of any failure occurs querying the database.
 *
 * TODO: pagination
 * TODO: make it stream the iterator instead of consumind it all at once
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function ResponseJsonIterator<T>(
  i: AsyncIterator<T>
): IResponseSuccessJsonIterator<T> {
  return {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    apply: res =>
      asyncIteratorToArray(i).then(documents => {
        const kindlessDocuments = documents.map(d =>
          Object.assign(Object.assign({}, d), { kind: undefined })
        );
        return res.status(200).json({
          items: kindlessDocuments,
          page_size: kindlessDocuments.length
        });
      }),
    kind: "IResponseSuccessJsonIterator",
    value: {} as T
  };
}

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function ResponsePageIdBasedIterator<
  T extends { readonly id: NonEmptyString }
>(
  i: AsyncIterator<T, T>,
  requestedPageSize: NonNegativeInteger
): IResponseSuccessPageIdBasedIterator<T> {
  return {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    apply: res =>
      fillPage(i, requestedPageSize).then(page => {
        const kindlessDocuments = page.values;
        return res.status(200).json(
          withoutUndefinedValues({
            items: kindlessDocuments,
            items_size: kindlessDocuments.length,
            next:
              page.done === true
                ? undefined
                : fromNullable(kindlessDocuments[kindlessDocuments.length - 1])
                    .map(e => e.id)
                    .toUndefined(),
            prev: fromNullable(kindlessDocuments[0])
              .map(e => e.id)
              .toUndefined()
          })
        );
      }),
    kind: "IResponseSuccessPageIdBasedIterator",
    value: {} as T
  };
}

/**
 * Interface for a response describing a database error.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IResponseErrorQuery extends IResponse<"IResponseErrorQuery"> {}

/**
 * Returns a response describing a database error.
 *
 * @param detail The error message
 * @param error  The QueryError object
 */
export const ResponseErrorQuery = (
  detail: string,
  error: CosmosErrors
): IResponseErrorQuery => ({
  ...ResponseErrorGeneric(
    HttpStatusCodeEnum.HTTP_STATUS_500,
    `Query error (${error.kind})$` +
      (error.kind === "COSMOS_ERROR_RESPONSE"
        ? ` (${error.error.code}/${error.error.message})`
        : ""),
    detail
  ),
  kind: "IResponseErrorQuery"
});
