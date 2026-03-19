import * as E from "fp-ts/lib/Either";
import { NonEmptyString, Ulid } from "@pagopa/ts-commons/lib/strings";
import {
  RCConfiguration,
  RCConfigurationBase,
  RetrievedRCConfiguration
} from "../rc_configuration";
import { HasPreconditionEnum } from "../../../generated/definitions/v2/HasPrecondition";

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
  id: "01HMRBX079WA5SGYBQP1A7FSKH" as NonEmptyString,
  configurationId: "01HMRBX079WA5SGYBQP1A7FSKH" as Ulid,
  name: "aName" as NonEmptyString,
  description: "a simple description" as NonEmptyString,
  hasPrecondition: HasPreconditionEnum.ALWAYS,
  disableLollipopFor: [],
  isLollipopEnabled: false
};

const aRemoteContentConfigurationWithProdEnv: RCConfiguration = {
  ...aRemoteContentConfigurationWithNoEnv,
  prodEnvironment: aRemoteContentEnvironmentConfiguration
};

const aRetrievedRemoteContentConfigurationWithProdEnv: RetrievedRCConfiguration = {
  ...aRemoteContentConfigurationWithProdEnv,
  id: `${aRemoteContentConfigurationWithProdEnv.configurationId}` as NonEmptyString,
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};

const aRemoteContentConfigurationWithTestEnv: RCConfiguration = {
  ...aRemoteContentConfigurationWithNoEnv,
  testEnvironment: {
    ...aRemoteContentEnvironmentConfiguration,
    testUsers: []
  }
};

const aRetrievedRemoteContentConfigurationWithTestEnv: RetrievedRCConfiguration = {
  ...aRemoteContentConfigurationWithTestEnv,
  id: `${aRemoteContentConfigurationWithTestEnv.configurationId}` as NonEmptyString,
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};

const aRemoteContentConfigurationWithBothEnv: RCConfiguration = {
  ...aRemoteContentConfigurationWithNoEnv,
  prodEnvironment: aRemoteContentEnvironmentConfiguration,
  testEnvironment: {
    ...aRemoteContentEnvironmentConfiguration,
    testUsers: []
  }
};

const aRetrievedRemoteContentConfigurationWithBothEnv: RetrievedRCConfiguration = {
  ...aRemoteContentConfigurationWithBothEnv,
  id: `${aRemoteContentConfigurationWithProdEnv.configurationId}` as NonEmptyString,
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};

describe("RCConfiguration", () => {
  it("GIVEN a valid RCConfiguration object with test environment WHEN the object is decoded THEN the decode succeed", async () => {
    const result = RCConfiguration.decode(
      aRemoteContentConfigurationWithTestEnv
    );
    expect(E.isRight(result)).toBe(true);
  });

  it("GIVEN a retrieved RCConfiguration object with test environment WHEN the object is decoded THEN the decode succeed", async () => {
    const result = RCConfiguration.decode(
      aRetrievedRemoteContentConfigurationWithTestEnv
    );
    expect(E.isRight(result)).toBe(true);
  });

  it("GIVEN a valid RCConfiguration object with prod environment WHEN the object is decoded THEN the decode succeed", async () => {
    const result = RCConfiguration.decode(
      aRemoteContentConfigurationWithProdEnv
    );
    expect(E.isRight(result)).toBe(true);
  });

  it("GIVEN a retrieved RCConfiguration object with prod environment WHEN the object is decoded THEN the decode succeed", async () => {
    const result = RCConfiguration.decode(
      aRetrievedRemoteContentConfigurationWithProdEnv
    );
    expect(E.isRight(result)).toBe(true);
  });

  it("GIVEN a valid RCConfiguration object with both environments WHEN the object is decoded THEN the decode succeed", async () => {
    const result = RCConfiguration.decode(
      aRemoteContentConfigurationWithBothEnv
    );
    expect(E.isRight(result)).toBe(true);
  });

  it("GIVEN a retrieved RCConfiguration object with both environment WHEN the object is decoded THEN the decode succeed", async () => {
    const result = RCConfiguration.decode(
      aRetrievedRemoteContentConfigurationWithBothEnv
    );
    expect(E.isRight(result)).toBe(true);
  });
});
