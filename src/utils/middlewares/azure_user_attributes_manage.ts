/*
 * A middle ware that extracts custom user attributes from the request, that support also MANAGE flow.
 */
import * as winston from "winston";

import * as E from "fp-ts/lib/Either";

import { isNone } from "fp-ts/lib/Option";

import { EmailString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import {
  IResponse,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal
} from "@pagopa/ts-commons/lib/responses";
import { Service, ServiceModel } from "../../models/service";
import { IRequestMiddleware } from "../request_middleware";
import { ResponseErrorQuery } from "../response";

// The user email will be passed in this header by the API Gateway
const HEADER_USER_EMAIL = "x-user-email";

const HEADER_USER_SUBSCRIPTION_KEY = "x-subscription-id";

/**
 * The attributes extracted from the user's "Note"
 */
export interface IAzureUserAttributes {
  readonly kind: "IAzureUserAttributes";
  // the email of the registered user
  readonly email: EmailString;
  // the service associated to the user
  readonly service: Service & { readonly version: NonNegativeInteger };
}

export type IAzureUserAttributesManage = Pick<
  IAzureUserAttributes,
  Exclude<keyof IAzureUserAttributes, "service">
>;

/**
 * A middleware that will extract custom user attributes from the request, that support also **MANAGE** flow.
 *
 * The middleware expects the following headers:
 *
 *   x-subscription-id:     The user's subscription id.
 *
 * In **LEGACY flow** is used to retrieve the associated Service.
 *
 * In **MANAGE flow** is used to check if its name starts with "MANAGE-".
 *
 * On success, the middleware provides an IUserAttributes.
 */
export const AzureUserAttributesManageMiddleware = (
  serviceModel?: ServiceModel
): IRequestMiddleware<
  | "IResponseErrorForbiddenNotAuthorized"
  | "IResponseErrorQuery"
  | "IResponseErrorInternal",
  IAzureUserAttributes | IAzureUserAttributesManage
> => async (
  request
): Promise<
  E.Either<
    IResponse<
      | "IResponseErrorInternal"
      | "IResponseErrorQuery"
      | "IResponseErrorForbiddenNotAuthorized"
    >,
    IAzureUserAttributes | IAzureUserAttributesManage
  >
> => {
  const errorOrUserEmail = EmailString.decode(
    request.header(HEADER_USER_EMAIL)
  );

  if (E.isLeft(errorOrUserEmail)) {
    return E.left<IResponse<"IResponseErrorInternal">, IAzureUserAttributes>(
      ResponseErrorInternal(
        `Missing, empty or invalid ${HEADER_USER_EMAIL} header`
      )
    );
  }

  const userEmail = errorOrUserEmail.right;

  const errorOrUserSubscriptionId = NonEmptyString.decode(
    request.header(HEADER_USER_SUBSCRIPTION_KEY)
  );

  if (E.isLeft(errorOrUserSubscriptionId)) {
    return E.left<IResponse<"IResponseErrorInternal">, IAzureUserAttributes>(
      ResponseErrorInternal(
        `Missing or empty ${HEADER_USER_SUBSCRIPTION_KEY} header`
      )
    );
  }

  const subscriptionId = errorOrUserSubscriptionId.right;

  if (!subscriptionId.startsWith("MANAGE-") && serviceModel) {
    // LEGACY Flow
    // serviceId equals subscriptionId
    const errorOrMaybeService = await serviceModel.findLastVersionByModelId([
      subscriptionId
    ])();

    if (E.isLeft(errorOrMaybeService)) {
      winston.error(
        `No service found for subscription|${subscriptionId}|${JSON.stringify(
          errorOrMaybeService.left
        )}`
      );
      return E.left<IResponse<"IResponseErrorQuery">, IAzureUserAttributes>(
        ResponseErrorQuery(
          `Error while retrieving the service tied to the provided subscription id`,
          errorOrMaybeService.left
        )
      );
    }

    const maybeService = errorOrMaybeService.right;

    if (isNone(maybeService)) {
      winston.error(
        `AzureUserAttributesMiddleware|Service not found|${subscriptionId}`
      );
      return E.left<
        IResponse<"IResponseErrorForbiddenNotAuthorized">,
        IAzureUserAttributes
      >(ResponseErrorForbiddenNotAuthorized);
    }

    const authInfo: IAzureUserAttributes = {
      email: userEmail,
      kind: "IAzureUserAttributes",
      service: maybeService.value
    };

    return E.right<
      IResponse<
        | "IResponseErrorForbiddenNotAuthorized"
        | "IResponseErrorQuery"
        | "IResponseErrorInternal"
      >,
      IAzureUserAttributes
    >(authInfo);
  } else {
    // MANAGE Flow
    const authInfo: IAzureUserAttributesManage = {
      email: userEmail,
      kind: "IAzureUserAttributes"
    };

    return E.right<
      IResponse<
        | "IResponseErrorForbiddenNotAuthorized"
        | "IResponseErrorQuery"
        | "IResponseErrorInternal"
      >,
      IAzureUserAttributesManage
    >(authInfo);
  }
};
