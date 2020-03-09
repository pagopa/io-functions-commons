import { isLeft, left, right } from "fp-ts/lib/Either";
import { fromNullable, isSome, Option, Some } from "fp-ts/lib/Option";

import {
  IResponseErrorForbiddenAnonymousUser,
  IResponseErrorForbiddenNoAuthorizationGroups,
  IResponseErrorForbiddenNotAuthorized,
  ResponseErrorForbiddenAnonymousUser,
  ResponseErrorForbiddenNoAuthorizationGroups,
  ResponseErrorForbiddenNotAuthorized
} from "italia-ts-commons/lib/responses";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { IRequestMiddleware } from "../request_middleware";

/*
 * A middle ware that extracts authentication information from the
 * request.
 */

/**
 * Enumerates all supported Azure user groups.
 *
 * Each groups is named after a Scope.
 * A Scope associates an Access Type to a Resource.
 */
export enum UserGroup {
  // API management users: get, list, create user's subscriptions and groups
  ApiUserAdmin = "ApiUserAdmin",

  // profiles: read limited profile (without addresses)
  ApiLimitedProfileRead = "ApiLimitedProfileRead",
  // profiles: read full profile (with addresses)
  ApiFullProfileRead = "ApiFullProfileRead",
  // profiles: create and update full profile
  ApiProfileWrite = "ApiProfileWrite",
  // profiles: create development profile
  ApiDevelopmentProfileWrite = "ApiDevelopmentProfileWrite",

  // services: read services attributes
  ApiServiceRead = "ApiServiceRead",
  // services: list services
  ApiServiceList = "ApiServiceList",
  // services: create and update services
  ApiServiceWrite = "ApiServiceWrite",

  // services: read services attributes (public API)
  ApiPublicServiceRead = "ApiPublicServiceRead",

  // services: read services attributes (public API)
  ApiPublicServiceList = "ApiPublicServiceList",

  // services: list services that notified a specific recipient
  ApiServiceByRecipientQuery = "ApiServiceByRecipientQuery",

  // messages: read sent message
  ApiMessageRead = "ApiMessageRead",
  // messages: send messages
  ApiMessageWrite = "ApiMessageWrite",
  // messages: send messages only to authorized receipts (used for trial)
  ApiLimitedMessageWrite = "ApiLimitedMessageWrite",
  // messages: ability to set default address when sending a message
  ApiMessageWriteDefaultAddress = "ApiMessageWriteDefaultAddress",
  // messages: list all messages for any recipient
  ApiMessageList = "ApiMessageList",

  // subscriptions: read access to the subscriptions feed
  ApiSubscriptionsFeedRead = "ApiSubscriptionsFeedRead",

  // info: read system information
  ApiInfoRead = "ApiInfoRead",

  // debug endpoint
  ApiDebugRead = "ApiDebugRead"
}

/**
 * Looks up a UserGroup by name
 */
function toUserGroup(name: string): Option<UserGroup> {
  return fromNullable(UserGroup[name as keyof typeof UserGroup]);
}

/**
 * Azure authorization info
 */
export interface IAzureApiAuthorization {
  readonly kind: "IAzureApiAuthorization";
  readonly groups: Set<UserGroup>;
  readonly userId: NonEmptyString;
  readonly subscriptionId: NonEmptyString;
}

/**
 * Returns an array of group names from a groups header.
 *
 * Expects a comma separated list of group names.
 */
function getGroupsFromHeader(groupsHeader: string): Set<UserGroup> {
  return new Set(
    groupsHeader
      .split(",")
      .map(v => toUserGroup(v))
      .filter(g => isSome(g))
      .map(g => (g as Some<UserGroup>).value)
  );
}

type AzureApiAuthMiddlewareErrorResponses =
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorForbiddenAnonymousUser
  | IResponseErrorForbiddenNoAuthorizationGroups;

/**
 * A middleware that will extract the Azure API Management authentication
 * information from the request.
 *
 * The middleware expects the following headers:
 *
 *   x-user-groups:   A comma separated list of names of Azure API Groups
 *
 * On success, the middleware generates an IAzureApiAuthorization, on failure
 * it triggers a ResponseErrorForbidden.
 *
 */
export function AzureApiAuthMiddleware(
  allowedGroups: Set<UserGroup>
): IRequestMiddleware<
  | "IResponseErrorForbiddenNotAuthorized"
  | "IResponseErrorForbiddenAnonymousUser"
  | "IResponseErrorForbiddenNoAuthorizationGroups",
  IAzureApiAuthorization
> {
  return request =>
    new Promise(resolve => {
      // get Azure userId and subscriptionId from the headers
      // these headers get added by the Azure API Manager gateway
      const errorOrUserId = NonEmptyString.decode(request.header("x-user-id"));

      const errorOrSubscriptionId = NonEmptyString.decode(
        request.header("x-subscription-id")
      );

      if (isLeft(errorOrUserId) || isLeft(errorOrSubscriptionId)) {
        // we cannot proceed unless we cannot associate the request to a
        // valid user and a subscription
        return resolve(
          left<AzureApiAuthMiddlewareErrorResponses, IAzureApiAuthorization>(
            ResponseErrorForbiddenAnonymousUser
          )
        );
      }

      const userId = errorOrUserId.value;
      const subscriptionId = errorOrSubscriptionId.value;

      // to correctly process the request, we must associate the correct
      // authorizations to the user that made the request; to do so, we
      // need to extract the groups associated to the authenticated user
      // from the x-user-groups header, generated by the Azure API Management
      // proxy.
      const errorOrGroupsHeader = NonEmptyString.decode(
        request.header("x-user-groups")
      );

      // extract the groups from the header
      const maybeGroups = errorOrGroupsHeader.map(getGroupsFromHeader);

      if (isLeft(maybeGroups) || maybeGroups.value.size === 0) {
        // the user as no valid authorization groups assigned
        return resolve(
          left<
            | IResponseErrorForbiddenNotAuthorized
            | IResponseErrorForbiddenAnonymousUser
            | IResponseErrorForbiddenNoAuthorizationGroups,
            IAzureApiAuthorization
          >(ResponseErrorForbiddenNoAuthorizationGroups)
        );
      }

      // now we have some valid groups that the users is part of
      const groups = maybeGroups.value;

      // helper that checks whether the user is part of a specific group
      const userHasOneGroup = (name: UserGroup) => groups.has(name);

      // whether the user is part of at least an allowed group
      const userHasAnyAllowedGroup =
        Array.from(allowedGroups).findIndex(userHasOneGroup) > -1;

      if (!userHasAnyAllowedGroup) {
        // the user is not allowed here
        return resolve(
          left<AzureApiAuthMiddlewareErrorResponses, IAzureApiAuthorization>(
            ResponseErrorForbiddenNotAuthorized
          )
        );
      }

      // the user is allowed here
      const authInfo: IAzureApiAuthorization = {
        groups,
        kind: "IAzureApiAuthorization",
        subscriptionId,
        userId
      };

      resolve(
        right<AzureApiAuthMiddlewareErrorResponses, IAzureApiAuthorization>(
          authInfo
        )
      );
    });
}
