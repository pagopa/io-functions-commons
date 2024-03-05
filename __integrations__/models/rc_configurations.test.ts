import * as E from "fp-ts/lib/Either";

import { createContext } from "./cosmos_utils";
import {
  RCConfiguration,
  RCConfigurationBase,
  RCConfigurationModel,
  RC_CONFIGURATION_MODEL_PK_FIELD
} from "../../src/models/rc_configuration";
import { NonEmptyString, Ulid } from "@pagopa/ts-commons/lib/strings";
import { HasPreconditionEnum } from "../../generated/definitions/HasPrecondition";

const aRemoteContentEnvironmentConfiguration = {
  baseUrl: "https://anydomain.anytld/api/v1/anyapi" as NonEmptyString,
  detailsAuthentication: {
    headerKeyName: "X-Functions-Key" as NonEmptyString,
    key: "anykey" as NonEmptyString,
    type: "API_KEY" as NonEmptyString
  }
};

const aRemoteContentConfigurationWithNoEnv: RCConfigurationBase = {
  userId: "aUserId" as NonEmptyString,
  configurationId: "01HMRBX079WA5SGYBQP1A7FSKH" as Ulid,
  name: "aName" as NonEmptyString,
  description: "a simple description" as NonEmptyString,
  hasPrecondition: HasPreconditionEnum.ALWAYS,
  disableLollipopFor: [],
  isLollipopEnabled: false
};

const aRemoteContentConfigurationWithTestEnv: RCConfiguration = {
  ...aRemoteContentConfigurationWithNoEnv,
  testEnvironment: {
    ...aRemoteContentEnvironmentConfiguration,
    testUsers: []
  }
};

describe("findAllLastVersionByConfigurationId", () => {
  test("should return a cosmos error if the array of configurationId is empty", async () => {
    const context = createContext(RC_CONFIGURATION_MODEL_PK_FIELD);
    await context.init();
    const model = new RCConfigurationModel(context.container);

    const r = await model.findAllLastVersionByConfigurationId([])();

    expect(E.isLeft(r)).toBe(true);
  });

  test("should return an array with length 1", async () => {
    const context = createContext(RC_CONFIGURATION_MODEL_PK_FIELD);
    await context.init();
    const model = new RCConfigurationModel(context.container);

    await model.create(aRemoteContentConfigurationWithTestEnv)();
    await model.upsert(aRemoteContentConfigurationWithNoEnv)();

    await model.create({
      ...aRemoteContentConfigurationWithTestEnv,
      configurationId: "01HMRBX079WA5SGYBQP1A7FSKK" as Ulid
    })();

    const r = await model.findAllLastVersionByConfigurationId([
      aRemoteContentConfigurationWithTestEnv.configurationId,
      "01HMRBX079WA5SGYBQP1A7FSKK" as Ulid
    ])();

    expect(E.isRight(r)).toBe(true);
    if (E.isRight(r)) {
      expect(r.right).toHaveLength(2);
      expect(
        r.right.find(i => i.configurationId === "01HMRBX079WA5SGYBQP1A7FSKH")
          ?.version
      ).toBe(1);
      expect(
        r.right.find(i => i.configurationId === "01HMRBX079WA5SGYBQP1A7FSKK")
          ?.version
      ).toBe(0);
    }
  });
});
