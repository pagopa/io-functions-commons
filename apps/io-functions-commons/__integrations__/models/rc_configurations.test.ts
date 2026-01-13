import { NonEmptyString, Ulid } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";

import { HasPreconditionEnum } from "../../generated/definitions/HasPrecondition";
import {
  RC_CONFIGURATION_MODEL_PK_FIELD,
  RCConfiguration,
  RCConfigurationBase,
  RCConfigurationModel,
} from "../../src/models/rc_configuration";
import { createContext } from "./cosmos_utils";

const aRemoteContentEnvironmentConfiguration = {
  baseUrl: "https://anydomain.anytld/api/v1/anyapi" as NonEmptyString,
  detailsAuthentication: {
    headerKeyName: "X-Functions-Key" as NonEmptyString,
    key: "anykey" as NonEmptyString,
    type: "API_KEY" as NonEmptyString,
  },
};

const aRemoteContentConfigurationWithNoEnv: RCConfigurationBase = {
  configurationId: "01HMRBX079WA5SGYBQP1A7FSKH" as Ulid,
  description: "a simple description" as NonEmptyString,
  disableLollipopFor: [],
  hasPrecondition: HasPreconditionEnum.ALWAYS,
  id: "01HMRBX079WA5SGYBQP1A7FSKH" as NonEmptyString,
  isLollipopEnabled: false,
  name: "aName" as NonEmptyString,
  userId: "aUserId" as NonEmptyString,
};

const aRemoteContentConfigurationWithTestEnv: RCConfiguration = {
  ...aRemoteContentConfigurationWithNoEnv,
  testEnvironment: {
    ...aRemoteContentEnvironmentConfiguration,
    testUsers: [],
  },
};

describe("findAllLastVersionByConfigurationId", () => {
  test("should return an empty array if the array of configurationId is empty", async () => {
    const context = createContext(RC_CONFIGURATION_MODEL_PK_FIELD);
    await context.init();
    const model = new RCConfigurationModel(context.container);

    const r = await model.findAllByConfigurationId([])();

    expect(E.isRight(r)).toBe(true);
    if (E.isRight(r)) expect(r.right).toHaveLength(0);
  });

  test("should return an array with length 1", async () => {
    const context = createContext(RC_CONFIGURATION_MODEL_PK_FIELD);
    await context.init();
    const model = new RCConfigurationModel(context.container);

    await model.create(aRemoteContentConfigurationWithTestEnv)();
    await model.upsert(aRemoteContentConfigurationWithNoEnv)();

    await model.create({
      ...aRemoteContentConfigurationWithTestEnv,
      configurationId: "01HMRBX079WA5SGYBQP1A7FSKK" as Ulid,
    })();

    const r = await model.findAllByConfigurationId([
      aRemoteContentConfigurationWithTestEnv.configurationId,
      "01HMRBX079WA5SGYBQP1A7FSKK" as Ulid,
    ])();

    expect(E.isRight(r)).toBe(true);
    if (E.isRight(r)) {
      expect(r.right).toHaveLength(2);
    }
  });
});
