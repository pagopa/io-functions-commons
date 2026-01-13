import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";

import {
  USER_RC_CONFIGURATIONS_MODEL_PK_FIELD,
  UserRCConfiguration,
  UserRCConfigurationModel,
} from "../../src/models/user_rc_configuration";
import { createContext } from "./cosmos_utils";

const aUserRCConfiguration: UserRCConfiguration = {
  id: "01HMRBX079WA5SGYBQP1A7FSKH" as NonEmptyString,
  userId: "aUserId" as NonEmptyString,
};

const anotherUserRCConfiguration: UserRCConfiguration = {
  id: "01HMRBX079WA5SGYBQP1A7FSKK" as NonEmptyString,
  userId: "anotherUserId" as NonEmptyString,
};

describe("findAllByUserId", () => {
  test("should return an array with length 2", async () => {
    const context = createContext(USER_RC_CONFIGURATIONS_MODEL_PK_FIELD);
    await context.init();
    const model = new UserRCConfigurationModel(context.container);

    await model.create(aUserRCConfiguration)();
    await model.create({
      ...aUserRCConfiguration,
      id: "01HMRBX079WA5SGYBQP1A7FSKN" as NonEmptyString,
    })();
    await model.create(anotherUserRCConfiguration)();

    const r = await model.findAllByUserId(aUserRCConfiguration.userId)();

    expect(E.isRight(r)).toBe(true);
    if (E.isRight(r)) expect(r.right).toHaveLength(2);
  });

  test("should return an empty array", async () => {
    const context = createContext(USER_RC_CONFIGURATIONS_MODEL_PK_FIELD);
    await context.init();
    const model = new UserRCConfigurationModel(context.container);

    const r = await model.findAllByUserId(aUserRCConfiguration.userId)();

    expect(E.isRight(r)).toBe(true);
    if (E.isRight(r)) expect(r.right).toHaveLength(0);
  });
});
