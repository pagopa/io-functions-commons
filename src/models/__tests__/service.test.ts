/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable sonarjs/no-identical-functions */

import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";

import { Container } from "@azure/cosmos";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import {
  NonEmptyString,
  OrganizationFiscalCode
} from "@pagopa/ts-commons/lib/strings";
import { MaxAllowedPaymentAmount } from "../../../generated/definitions/MaxAllowedPaymentAmount";
import {
  RetrievedService,
  ServiceModel,
  toAuthorizedCIDRs,
  toAuthorizedRecipients
} from "../service";

const aServiceId = "xyz" as NonEmptyString;
const anOrganizationFiscalCode = "01234567890" as OrganizationFiscalCode;

const aRetrievedService: RetrievedService = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  authorizedCIDRs: toAuthorizedCIDRs([]),
  authorizedRecipients: toAuthorizedRecipients([]),
  departmentName: "MyDept" as NonEmptyString,
  id: "xyz" as NonEmptyString,
  isVisible: true,
  kind: "IRetrievedService",
  maxAllowedPaymentAmount: 0 as MaxAllowedPaymentAmount,
  organizationFiscalCode: anOrganizationFiscalCode,
  organizationName: "MyOrg" as NonEmptyString,
  requireSecureChannels: false,
  serviceId: aServiceId,
  serviceName: "MyService" as NonEmptyString,
  version: 0 as NonNegativeInteger
};

const mockFetchAll = jest.fn();

const containerMock = ({
  items: {
    create: jest.fn(),
    query: jest.fn(() => ({
      fetchAll: mockFetchAll
    }))
  }
} as unknown) as Container;

describe("findOneServiceById", () => {
  it("should return an existing service", async () => {
    mockFetchAll.mockImplementationOnce(() =>
      Promise.resolve({
        resources: [aRetrievedService]
      })
    );

    const model = new ServiceModel(containerMock);

    const result = await model.findOneByServiceId("id" as NonEmptyString)();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBeTruthy();
      // use JSON.stringify because of a jest matcher bug ref. https://github.com/facebook/jest/issues/8475
      expect(JSON.stringify(O.toUndefined(result.right))).toEqual(
        JSON.stringify(aRetrievedService)
      );
    }
  });

  it("should resolve to an empty value if no service is found", async () => {
    mockFetchAll.mockImplementationOnce(() =>
      Promise.resolve({
        resources: undefined
      })
    );

    const model = new ServiceModel(containerMock);

    const result = await model.findOneByServiceId("id" as NonEmptyString)();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isNone(result.right)).toBeTruthy();
    }
  });

  it("should validate the retrieved object agains the model type", async () => {
    mockFetchAll.mockImplementationOnce(() =>
      Promise.resolve({
        resources: [{}]
      })
    );

    const model = new ServiceModel(containerMock);

    const result = await model.findOneByServiceId("id" as NonEmptyString)();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toBe("COSMOS_DECODING_ERROR");
    }
  });
});

describe("listLastVersionServices", () => {
  it("should return existing services", async () => {
    const expectedService = {...aRetrievedService, version: aRetrievedService.version + 1};
    mockFetchAll.mockImplementationOnce(() => Promise.resolve({
      resources: [aRetrievedService, expectedService]
    }))
    const model = new ServiceModel(containerMock);

    const result = await model.listLastVersionServices().run();
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      // use JSON.stringify because of a jest matcher bug ref. https://github.com/facebook/jest/issues/8475
      expect(result.value.toUndefined()).toHaveLength(1);
      expect(JSON.stringify(result.value.toUndefined())).toEqual(JSON.stringify([expectedService]));
    }
  });
  it("should resolve to an empty value if no service is found", async () => {
    mockFetchAll.mockImplementationOnce(() =>
      Promise.resolve({
        resources: undefined
      })
    );

    const model = new ServiceModel(containerMock);

    const result = await model.listLastVersionServices().run();

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isNone()).toBeTruthy();
    }
  });
  it("should validate the retrieved object agains the model type", async () => {
    mockFetchAll.mockImplementationOnce(() =>
      Promise.resolve({
        resources: [{}, aRetrievedService]
      })
    );

    const model = new ServiceModel(containerMock);

    const result = await model.listLastVersionServices().run();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toBe("COSMOS_DECODING_ERROR");
    }
  });
});
