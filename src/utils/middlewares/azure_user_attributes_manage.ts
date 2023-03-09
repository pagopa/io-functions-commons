/*
 * A middleware that extracts custom user attributes from the request, that supports MANAGE flow.
 */
import * as E from "fp-ts/lib/Either";

import { EmailString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import {
  IResponse,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal
} from "@pagopa/ts-commons/lib/responses";
import winston = require("winston");
import { isNone } from "fp-ts/lib/Option";
import { IRequestMiddleware } from "../request_middleware";
import { SubscriptionCIDRsModel } from "../../models/subscription_cidrs";
import { ResponseErrorQuery } from "../response";
import { CIDR } from "../../../generated/definitions/CIDR";
import { IAzureUserAttributes } from "./azure_user_attributes";

// The user email will be passed in this header by the API Gateway
const HEADER_USER_EMAIL = "x-user-email";

const HEADER_USER_SUBSCRIPTION_KEY = "x-subscription-id";

/**
 * The attributes extracted from the user's "Note"
 */
export type IAzureUserAttributesManage = Omit<
  IAzureUserAttributes,
  "service" | "kind"
> & {
  readonly kind: "IAzureUserAttributesManage";
  // authorized source CIDRs
  readonly authorizedCIDRs: ReadonlySet<CIDR>;
};

/**
 * A middleware that will extract custom user attributes from the request, that supports **MANAGE** flow.
 *
 * The middleware expects the following header:
 *
 * *x-subscription-id*: The user's subscription id.
 *
 * Used to check if its name starts with *'MANAGE-'*.
 *
 * On success, the middleware provides an *IAzureUserAttributesManage*.
 */
export const AzureUserAttributesManageMiddleware = (
  subscriptionCIDRsModel: SubscriptionCIDRsModel
): IRequestMiddleware<
  | "IResponseErrorForbiddenNotAuthorized"
  | "IResponseErrorQuery"
  | "IResponseErrorInternal",
  IAzureUserAttributesManage
> => async (
  request
): Promise<
  E.Either<
    IResponse<
      | "IResponseErrorForbiddenNotAuthorized"
      | "IResponseErrorQuery"
      | "IResponseErrorInternal"
    >,
    IAzureUserAttributesManage
  >
> => {
  const errorOrUserEmail = EmailString.decode(
    request.header(HEADER_USER_EMAIL)
  );

  if (E.isLeft(errorOrUserEmail)) {
    return E.left<
      IResponse<"IResponseErrorInternal">,
      IAzureUserAttributesManage
    >(
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
    return E.left<
      IResponse<"IResponseErrorInternal">,
      IAzureUserAttributesManage
    >(
      ResponseErrorInternal(
        `Missing or empty ${HEADER_USER_SUBSCRIPTION_KEY} header`
      )
    );
  }

  const subscriptionId = errorOrUserSubscriptionId.right;

  if (subscriptionId.startsWith("MANAGE-")) {
    // MANAGE Flow
    const errorOrMaybeAuthorizedCIDRs = await subscriptionCIDRsModel.findLastVersionByModelId(
      [subscriptionId]
    )();

    if (E.isLeft(errorOrMaybeAuthorizedCIDRs)) {
      winston.error(
        `No CIDRs found for subscription|${subscriptionId}|${JSON.stringify(
          errorOrMaybeAuthorizedCIDRs.left
        )}`
      );
      return E.left<
        IResponse<"IResponseErrorQuery">,
        IAzureUserAttributesManage
      >(
        ResponseErrorQuery(
          `Error while retrieving CIDRs tied to the provided subscription id`,
          errorOrMaybeAuthorizedCIDRs.left
        )
      );
    }

    const maybeAuthorizedCIDRs = errorOrMaybeAuthorizedCIDRs.right;

    if (isNone(maybeAuthorizedCIDRs)) {
      winston.error(
        `IAzureUserAttributesManage|CIDRs not found|${subscriptionId}`
      );
      return E.left<
        IResponse<"IResponseErrorInternal">,
        IAzureUserAttributesManage
      >(ResponseErrorInternal(`Missing CIDRs for ${subscriptionId}`));
    }

    const authInfo: IAzureUserAttributesManage = {
      authorizedCIDRs: maybeAuthorizedCIDRs.value.cidrs,
      email: userEmail,
      kind: "IAzureUserAttributesManage"
    };

    return E.right<
      IResponse<
        "IResponseErrorForbiddenNotAuthorized" | "IResponseErrorInternal"
      >,
      IAzureUserAttributesManage
    >(authInfo);
  } else {
    return E.left<
      IResponse<"IResponseErrorForbiddenNotAuthorized">,
      IAzureUserAttributesManage
    >(ResponseErrorForbiddenNotAuthorized);
  }
};
