import * as E from "fp-ts/lib/Either";
import { createContext } from "./cosmos_utils";
import {
  UserRCConfiguration,
  UserRCConfigurationModel,
  USER_RC_CONFIGURATIONS_MODEL_PK_FIELD
} from "../../src/models/user_rc_configuration";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

const aUserRCConfiguration: UserRCConfiguration = {
  userId: "aUserId" as NonEmptyString,
  id: "01HMRBX079WA5SGYBQP1A7FSKH" as NonEmptyString
};

const anotherUserRCConfiguration: UserRCConfiguration = {
  userId: "anotherUserId" as NonEmptyString,
  id: "01HMRBX079WA5SGYBQP1A7FSKK" as NonEmptyString
};

describe("findAllByUserId", () => {
  test("should return an array with length 2", async () => {
    const context = createContext(USER_RC_CONFIGURATIONS_MODEL_PK_FIELD);
    await context.init();
    const model = new UserRCConfigurationModel(context.container);

    await model.create(aUserRCConfiguration)();
    await model.create({
      ...aUserRCConfiguration,
      id: "01HMRBX079WA5SGYBQP1A7FSKN" as NonEmptyString
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
