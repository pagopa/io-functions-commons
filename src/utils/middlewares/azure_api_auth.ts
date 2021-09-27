import * as t from "io-ts";
import * as E from "fp-ts/lib/Either";
import { fromNullable, isSome, Option, Some } from "fp-ts/lib/Option";

import {
  IResponse,
  IResponseErrorForbiddenAnonymousUser,
  IResponseErrorForbiddenNoAuthorizationGroups,
  IResponseErrorForbiddenNotAuthorized,
  ResponseErrorForbiddenAnonymousUser,
  ResponseErrorForbiddenNoAuthorizationGroups,
  ResponseErrorForbiddenNotAuthorized
} from "@pagopa/ts-commons/lib/responses";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
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
/* eslint-disable @typescript-eslint/naming-convention */
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
  ApiDebugRead = "ApiDebugRead",

  // messages: send messages with EU Covid Certificate access data
  ApiMessageWriteEUCovidCert = "ApiMessageWriteEUCovidCert",

  // messages: send messages with payee
  ApiMessageWriteWithPayee = "ApiMessageWriteWithPayee"
}
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Looks up a UserGroup by name
 */
const toUserGroup = (name: string): Option<UserGroup> =>
  fromNullable(UserGroup[name as keyof typeof UserGroup]);

/**
 * Azure authorization info
 */
export interface IAzureApiAuthorization {
  readonly kind: "IAzureApiAuthorization";
  readonly groups: ReadonlySet<UserGroup>;
  readonly userId: NonEmptyString;
  readonly subscriptionId: NonEmptyString;
}

/**
 * Returns an array of group names from a groups header.
 *
 * Expects a comma separated list of group names.
 */
const getGroupsFromHeader = (groupsHeader: string): ReadonlySet<UserGroup> =>
  new Set(
    groupsHeader
      .split(",")
      .map(v => toUserGroup(v))
      .filter(g => isSome(g))
      .map(g => (g as Some<UserGroup>).value)
  );

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
export const AzureApiAuthMiddleware = (
  allowedGroups: ReadonlySet<UserGroup>
): IRequestMiddleware<
  | "IResponseErrorForbiddenNotAuthorized"
  | "IResponseErrorForbiddenAnonymousUser"
  | "IResponseErrorForbiddenNoAuthorizationGroups",
  IAzureApiAuthorization
> => (
  request
): Promise<
  E.Either<
    IResponse<
      | "IResponseErrorForbiddenNotAuthorized"
      | "IResponseErrorForbiddenAnonymousUser"
      | "IResponseErrorForbiddenNoAuthorizationGroups"
    >,
    IAzureApiAuthorization
  >
> =>
  new Promise(resolve => {
    // get Azure userId and subscriptionId from the headers
    // these headers get added by the Azure API Manager gateway
    const errorOrUserId = NonEmptyString.decode(request.header("x-user-id"));

    const errorOrSubscriptionId = NonEmptyString.decode(
      request.header("x-subscription-id")
    );

    if (E.isLeft(errorOrUserId) || E.isLeft(errorOrSubscriptionId)) {
      // we cannot proceed unless we cannot associate the request to a
      // valid user and a subscription
      return resolve(
        E.left<AzureApiAuthMiddlewareErrorResponses, IAzureApiAuthorization>(
          ResponseErrorForbiddenAnonymousUser
        )
      );
    }

    const userId = errorOrUserId.right;
    const subscriptionId = errorOrSubscriptionId.right;

    // to correctly process the request, we must associate the correct
    // authorizations to the user that made the request; to do so, we
    // need to extract the groups associated to the authenticated user
    // from the x-user-groups header, generated by the Azure API Management
    // proxy.
    const errorOrGroupsHeader = NonEmptyString.decode(
      request.header("x-user-groups")
    );

    // extract the groups from the header
    const maybeGroups = pipe(errorOrGroupsHeader, E.map(getGroupsFromHeader));

    if (E.isLeft(maybeGroups) || maybeGroups.right.size === 0) {
      // the user as no valid authorization groups assigned
      return resolve(
        E.left<
          | IResponseErrorForbiddenNotAuthorized
          | IResponseErrorForbiddenAnonymousUser
          | IResponseErrorForbiddenNoAuthorizationGroups,
          IAzureApiAuthorization
        >(ResponseErrorForbiddenNoAuthorizationGroups)
      );
    }

    // now we have some valid groups that the users is part of
    const groups = maybeGroups.right;

    // helper that checks whether the user is part of a specific group
    const userHasOneGroup = (name: UserGroup): boolean => groups.has(name);

    // whether the user is part of at least an allowed group
    const userHasAnyAllowedGroup =
      Array.from(allowedGroups).findIndex(userHasOneGroup) > -1;

    if (!userHasAnyAllowedGroup) {
      // the user is not allowed here
      return resolve(
        E.left<AzureApiAuthMiddlewareErrorResponses, IAzureApiAuthorization>(
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
      E.right<AzureApiAuthMiddlewareErrorResponses, IAzureApiAuthorization>(
        authInfo
      )
    );
  });

type AzureAllowBodyPayloadMiddlewareErrorResponses =
  | IResponseErrorForbiddenNoAuthorizationGroups
  | IResponseErrorForbiddenNotAuthorized;

/**
 * A middleware that allow a specific payload to be provided only by a specific set of user groups
 *
 * The middleware expects the following headers:
 *
 *   x-user-groups:   A comma separated list of names of Azure API Groups
 *
 * On success, the middleware just lets the request to continue,
 * on failure it triggers a ResponseErrorForbidden.
 *
 * @param pattern a codec that matches the payload pattern to restrict access to
 * @param allowedGroups a set of user groups to allow provided payload
 *
 */
export const AzureAllowBodyPayloadMiddleware = <S, A>(
  pattern: t.Type<A, S>,
  allowedGroups: ReadonlySet<UserGroup>
): IRequestMiddleware<
  | "IResponseErrorForbiddenNotAuthorized"
  | "IResponseErrorForbiddenNoAuthorizationGroups",
  void
> => async (
  request
): Promise<E.Either<AzureAllowBodyPayloadMiddlewareErrorResponses, void>> =>
  pipe(
    E.of<AzureAllowBodyPayloadMiddlewareErrorResponses, unknown>(request.body),
    E.chain(payload =>
      pipe(
        pattern.decode(payload),
        E.fold(
          // if pattern does not match payload, just skip the middleware
          _ => E.right(void 0),
          _ =>
            pipe(
              NonEmptyString.decode(request.header("x-user-groups")),
              E.mapLeft(_errors => ResponseErrorForbiddenNoAuthorizationGroups),
              E.map(getGroupsFromHeader),
              // check if current user belongs to at least one of the allowed groups
              E.map(userGroups =>
                Array.from(allowedGroups).some(e => userGroups.has(e))
              ),
              E.chainW(isInGroup =>
                isInGroup
                  ? E.right(void 0)
                  : E.left(ResponseErrorForbiddenNotAuthorized)
              )
            )
        )
      )
    )
  );
