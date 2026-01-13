/* eslint-disable @typescript-eslint/no-invalid-void-type */
import {
  HttpStatusCodeEnum,
  IResponse,
  ResponseErrorGeneric,
} from "@pagopa/ts-commons/lib/responses";
import * as express from "express";

import { asyncIteratorToArray } from "./async";
import { CosmosErrors } from "./cosmosdb_model";

/**
 * Interface for a response describing a database error.
 */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IResponseErrorQuery extends IResponse<"IResponseErrorQuery"> {}
/**
 * Interface for a successful response returning a json object.
 */
export interface IResponseSuccessJsonIterator<T>
  extends IResponse<"IResponseSuccessJsonIterator"> {
  readonly apply: (
    response: express.Response,
  ) => Promise<express.Response | IResponseErrorQuery | void>;
  readonly value: T; // needed to discriminate from other T subtypes
}

export interface IResponseSuccessPageIdBasedIterator<T>
  extends IResponse<"IResponseSuccessPageIdBasedIterator"> {
  readonly apply: (
    response: express.Response,
  ) => Promise<express.Response | IResponseErrorQuery | void>;
  readonly value: T; // needed to discriminate from other T subtypes
}

/**
 * A response that consumes and return the Cosmosdb iterator as a json array
 * or an error in case of any failure occurs querying the database.
 *
 * TODO: pagination
 * TODO: make it stream the iterator instead of consumind it all at once
 */
export function ResponseJsonIterator<T>(
  i: AsyncIterator<T>,
): IResponseSuccessJsonIterator<T> {
  return {
    apply: (res) =>
      asyncIteratorToArray(i).then((documents) => {
        const kindlessDocuments = documents.map((d) =>
          Object.assign(Object.assign({}, d), { kind: undefined }),
        );
        return res.status(200).json({
          items: kindlessDocuments,
          page_size: kindlessDocuments.length,
        });
      }),
    kind: "IResponseSuccessJsonIterator",
    value: {} as T,
  };
}

/**
 * Returns a response describing a database error.
 *
 * @param detail The error message
 * @param error  The QueryError object
 */
export const ResponseErrorQuery = (
  detail: string,
  error: CosmosErrors,
): IResponseErrorQuery => ({
  ...ResponseErrorGeneric(
    HttpStatusCodeEnum.HTTP_STATUS_500,
    `Query error (${error.kind})$` +
      (error.kind === "COSMOS_ERROR_RESPONSE"
        ? ` (${error.error.code}/${error.error.message})`
        : ""),
    detail,
  ),
  kind: "IResponseErrorQuery",
});
