import * as E from "fp-ts/lib/Either";
import { NonEmptyString, Ulid } from "@pagopa/ts-commons/lib/strings";
import { ServiceId } from "../../../generated/definitions/ServiceId";
import {
  RemoteContentConfigurationBase,
  RemoteContentConfiguration,
  RetrievedRemoteContentConfiguration
} from "../remote_content";
import { Has_preconditionEnum } from "../../../generated/definitions/ThirdPartyData";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";

const aRemoteContentEnvironmentConfiguration = {
  baseUrl: "https://anydomain.anytld/api/v1/anyapi" as NonEmptyString,
  detailsAuthentication: {
    headerKeyName: "X-Functions-Key" as NonEmptyString,
    key: "anykey" as NonEmptyString,
    type: "API_KEY" as NonEmptyString
  }
};

const aRemoteContentConfigurationWithNoEnv: RemoteContentConfigurationBase = {
  userId: "aUserId" as NonEmptyString,
  configurationId: "01HMRBX079WA5SGYBQP1A7FSKH" as Ulid,
  name: "aName" as NonEmptyString,
  description: "a simple description" as NonEmptyString,
  hasPrecondition: Has_preconditionEnum.ALWAYS,
  serviceId: "01GQQZ9HF5GAPRVKJM1VDAVFHM" as ServiceId,
  disableLollipopFor: [],
  isLollipopEnabled: false
};

const aRemoteContentConfigurationWithProdEnv: RemoteContentConfiguration = {
  ...aRemoteContentConfigurationWithNoEnv,
  prodEnvironment: aRemoteContentEnvironmentConfiguration
};

const aRetrievedRemoteContentConfigurationWithProdEnv: RetrievedRemoteContentConfiguration = {
  ...aRemoteContentConfigurationWithProdEnv,
  id: `${aRemoteContentConfigurationWithProdEnv.configurationId}-${"0".repeat(
    16
  )}` as NonEmptyString,
  version: 0 as NonNegativeInteger,
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};

const aRemoteContentConfigurationWithTestEnv: RemoteContentConfiguration = {
  ...aRemoteContentConfigurationWithNoEnv,
  testEnvironment: {
    ...aRemoteContentEnvironmentConfiguration,
    testUsers: []
  }
};

const aRetrievedRemoteContentConfigurationWithTestEnv: RetrievedRemoteContentConfiguration = {
  ...aRemoteContentConfigurationWithTestEnv,
  id: `${aRemoteContentConfigurationWithTestEnv.configurationId}-${"0".repeat(
    16
  )}` as NonEmptyString,
  version: 0 as NonNegativeInteger,
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};

const aRemoteContentConfigurationWithBothEnv: RemoteContentConfiguration = {
  ...aRemoteContentConfigurationWithNoEnv,
  prodEnvironment: aRemoteContentEnvironmentConfiguration,
  testEnvironment: {
    ...aRemoteContentEnvironmentConfiguration,
    testUsers: []
  }
};

const aRetrievedRemoteContentConfigurationWithBothEnv: RetrievedRemoteContentConfiguration = {
  ...aRemoteContentConfigurationWithBothEnv,
  id: `${aRemoteContentConfigurationWithProdEnv.configurationId}-${"0".repeat(
    16
  )}` as NonEmptyString,
  version: 0 as NonNegativeInteger,
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};

describe("remote_content", () => {
  it("GIVEN a valid remote_content object with test environment WHEN the object is decoded THEN the decode succeed", async () => {
    const result = RemoteContentConfiguration.decode(
      aRemoteContentConfigurationWithTestEnv
    );
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a retrieved remote_content object with test environment WHEN the object is decoded THEN the decode succeed", async () => {
    const result = RemoteContentConfiguration.decode(
      aRetrievedRemoteContentConfigurationWithTestEnv
    );
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a valid remote_content object with prod environment WHEN the object is decoded THEN the decode succeed", async () => {
    const result = RemoteContentConfiguration.decode(
      aRemoteContentConfigurationWithProdEnv
    );
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a retrieved remote_content object with prod environment WHEN the object is decoded THEN the decode succeed", async () => {
    const result = RemoteContentConfiguration.decode(
      aRetrievedRemoteContentConfigurationWithProdEnv
    );
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a valid remote_content object with both environments WHEN the object is decoded THEN the decode succeed", async () => {
    const result = RemoteContentConfiguration.decode(
      aRemoteContentConfigurationWithBothEnv
    );
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a retrieved remote_content object with both environment WHEN the object is decoded THEN the decode succeed", async () => {
    const result = RemoteContentConfiguration.decode(
      aRetrievedRemoteContentConfigurationWithBothEnv
    );
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a not valid remote_content object with no environments WHEN the object is decoded THEN the decode fail", async () => {
    const result = RemoteContentConfiguration.decode(
      aRemoteContentConfigurationWithNoEnv
    );
    expect(E.isLeft(result)).toBeTruthy();
  });
});
