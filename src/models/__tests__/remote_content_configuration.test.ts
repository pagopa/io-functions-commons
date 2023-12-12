import * as E from "fp-ts/lib/Either";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { ServiceId } from "../../../generated/definitions/ServiceId";
import {
  RemoteContentConfigurationBase,
  RemoteContentConfiguration,
  RetrievedRemoteContentConfiguration
} from "../remote_content_configuration";
import { Has_preconditionEnum } from "../../../generated/definitions/ThirdPartyData";

const aRemoteContentEnvironmentConfiguration = {
  baseUrl: "https://anydomain.anytld/api/v1/anyapi" as NonEmptyString,
  detailsAuthentication: {
    headerKeyName: "X-Functions-Key" as NonEmptyString,
    key: "anykey" as NonEmptyString,
    type: "API_KEY" as NonEmptyString
  }
};

const aRemoteContentConfigurationWithNoEnv: RemoteContentConfigurationBase = {
  id: "anyid" as NonEmptyString,
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
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};

describe("remote_content_config", () => {
  it("GIVEN a valid remote_content_config object with test environment WHEN the object is decoded THEN the decode succeed", async () => {
    const result = RemoteContentConfiguration.decode(
      aRemoteContentConfigurationWithTestEnv
    );
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a retrieved remote_content_config object with test environment WHEN the object is decoded THEN the decode succeed", async () => {
    const result = RemoteContentConfiguration.decode(
      aRetrievedRemoteContentConfigurationWithTestEnv
    );
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a valid remote_content_config object with prod environment WHEN the object is decoded THEN the decode succeed", async () => {
    const result = RemoteContentConfiguration.decode(
      aRemoteContentConfigurationWithProdEnv
    );
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a retrieved remote_content_config object with prod environment WHEN the object is decoded THEN the decode succeed", async () => {
    const result = RemoteContentConfiguration.decode(
      aRetrievedRemoteContentConfigurationWithProdEnv
    );
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a valid remote_content_config object with both environments WHEN the object is decoded THEN the decode succeed", async () => {
    const result = RemoteContentConfiguration.decode(
      aRemoteContentConfigurationWithBothEnv
    );
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a retrieved remote_content_config object with both environment WHEN the object is decoded THEN the decode succeed", async () => {
    const result = RemoteContentConfiguration.decode(
      aRetrievedRemoteContentConfigurationWithBothEnv
    );
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a not valid remote_content_config object with no environments WHEN the object is decoded THEN the decode fail", async () => {
    const result = RemoteContentConfiguration.decode(
      aRemoteContentConfigurationWithNoEnv
    );
    expect(E.isLeft(result)).toBeTruthy();
  });
});
