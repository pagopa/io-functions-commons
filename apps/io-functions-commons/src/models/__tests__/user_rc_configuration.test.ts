import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";

import {
  RetrievedUserRCConfiguration,
  UserRCConfiguration,
} from "../user_rc_configuration";

const aUserRCConfiguration: UserRCConfiguration = {
  id: "01HMRBX079WA5SGYBQP1A7FSKH" as NonEmptyString,
  userId: "aUserId" as NonEmptyString,
};

const aRetrievedUserRCConfiguration: RetrievedUserRCConfiguration = {
  ...aUserRCConfiguration,
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
};

describe("UserRCConfiguration", () => {
  it("GIVEN a valid UserRCConfiguration object WHEN the object is decoded THEN the decode succeed", async () => {
    const result = UserRCConfiguration.decode(aUserRCConfiguration);
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a retrieved RC object with test environment WHEN the object is decoded THEN the decode succeed", async () => {
    const result = UserRCConfiguration.decode(aRetrievedUserRCConfiguration);
    expect(E.isRight(result)).toBeTruthy();
  });
});
