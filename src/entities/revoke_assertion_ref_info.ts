/**
 * Describe the entity sent through LolliPoP revoke queue
 */

import * as t from "io-ts";

import { AssertionRef } from "../../generated/definitions/lollipop/AssertionRef";

export const RevokeAssertionRefInfo = t.interface({
  assertion_ref: AssertionRef
});

export type RevokeAssertionRefInfo = t.TypeOf<typeof RevokeAssertionRefInfo>;
