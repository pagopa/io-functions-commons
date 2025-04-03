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
import { MaxAllowedPaymentAmount } from "../../../generated/definitions/v2/MaxAllowedPaymentAmount";
import {
  CommonServiceMetadata,
  NewService,
  RetrievedService,
  Service,
  ServiceMetadata,
  ServiceModel,
  SpecialServiceMetadata,
  StandardServiceMetadata,
  toAuthorizedCIDRs,
  toAuthorizedRecipients
} from "../service";
import { ServiceScopeEnum } from "../../../generated/definitions/v2/ServiceScope";
import { StandardServiceCategoryEnum } from "../../../generated/definitions/v2/StandardServiceCategory";
import { SpecialServiceCategoryEnum } from "../../../generated/definitions/v2/SpecialServiceCategory";

const aServiceId = "xyz" as NonEmptyString;
const anOrganizationFiscalCode = "01234567890" as OrganizationFiscalCode;

const aRawService: Service = {
  authorizedCIDRs: toAuthorizedCIDRs([]),
  authorizedRecipients: toAuthorizedRecipients([]),
  departmentName: "MyDept" as NonEmptyString,
  isVisible: true,
  maxAllowedPaymentAmount: 0 as MaxAllowedPaymentAmount,
  organizationFiscalCode: anOrganizationFiscalCode,
  organizationName: "MyOrg" as NonEmptyString,
  requireSecureChannels: false,
  serviceId: aServiceId,
  serviceName: "MyService" as NonEmptyString
};

const aRetrievedService: RetrievedService = {
  ...aRawService,
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  id: "xyz" as NonEmptyString,
  kind: "IRetrievedService",
  version: 0 as NonNegativeInteger
};

const mockFetchAll = jest.fn();
const mockGetAsyncIterator = jest.fn();
const mockCreate = jest.fn();

const containerMock = ({
  items: {
    readAll: jest.fn(() => ({
      fetchAll: mockFetchAll,
      getAsyncIterator: mockGetAsyncIterator
    })),
    create: mockCreate,
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
      expect(O.toUndefined(result.right)).toMatchObject(aRetrievedService);
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

const getAsyncIterable = <T>(pages: ReadonlyArray<ReadonlyArray<T>>) => ({
  [Symbol.asyncIterator]: async function* asyncGenerator() {
    let array = pages.map(_ => Promise.resolve(_));
    while (array.length) {
      yield { resources: await array.shift() };
    }
  }
});

describe("listLastVersionServices", () => {
  it("should return existing services", async () => {
    const nextServiceVersion = {
      ...aRetrievedService,
      version: aRetrievedService.version + 1
    };
    const anotherService = {
      ...aRetrievedService,
      serviceId: "anotherServiceId"
    };
    const expectedService = {
      ...nextServiceVersion,
      version: nextServiceVersion.version + 1
    };
    const asyncIterable = getAsyncIterable([
      [aRetrievedService, expectedService],
      [anotherService, nextServiceVersion]
    ]);
    mockGetAsyncIterator.mockReturnValueOnce(asyncIterable);
    const model = new ServiceModel(containerMock);

    const result = await model.listLastVersionServices()();
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.toUndefined(result.right)).toHaveLength(2);
      expect(O.toUndefined(result.right)).toMatchObject([
        expectedService,
        anotherService
      ]);
    }
  });
  it("should resolve to an empty value if no service is found", async () => {
    const asyncIterable = getAsyncIterable([[]]);
    mockGetAsyncIterator.mockReturnValueOnce(asyncIterable);

    const model = new ServiceModel(containerMock);

    const result = await model.listLastVersionServices()();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isNone(result.right)).toBeTruthy();
    }
  });
  it("should validate the retrieved object agains the model type", async () => {
    const asyncIterable = getAsyncIterable([[{}, aRetrievedService]]);
    mockGetAsyncIterator.mockReturnValueOnce(asyncIterable);

    const model = new ServiceModel(containerMock);

    const result = await model.listLastVersionServices()();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toBe("COSMOS_DECODING_ERROR");
    }
  });
});

describe("create", () => {
  it("category is required on create method", async () => {
    const serviceMetadata: ServiceMetadata = {
      scope: ServiceScopeEnum.LOCAL,
      category: StandardServiceCategoryEnum.STANDARD,
      customSpecialFlow: undefined
    };
    const aRawServiceWithMetadata: Service = {
      ...aRawService,
      serviceMetadata
    };
    mockCreate.mockImplementationOnce((_, __) =>
      Promise.resolve({
        resource: { ...aRetrievedService, serviceMetadata, id: _.id }
      })
    );
    const model = new ServiceModel(containerMock);
    const result = await model.create({
      ...aRawServiceWithMetadata,
      kind: "INewService"
    })();
    expect(mockCreate).toBeCalled();
    expect(mockCreate).toBeCalledWith(
      expect.objectContaining({
        serviceMetadata: expect.objectContaining({
          category: serviceMetadata.category
        })
      }),
      expect.anything()
    );
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toEqual({
        ...aRetrievedService,
        serviceMetadata,
        kind: "IRetrievedService",
        id: expect.any(String)
      });
    }
  });
});

describe("Special Service metadata types", () => {
  it("should decode services metadata without category as Standard Services metadata", async () => {
    const oldServiceMetadata: CommonServiceMetadata = {
      scope: ServiceScopeEnum.LOCAL
    };
    const asyncIterable = getAsyncIterable([
      [{ ...aRetrievedService, serviceMetadata: oldServiceMetadata }]
    ]);
    mockGetAsyncIterator.mockReturnValueOnce(asyncIterable);

    const model = new ServiceModel(containerMock);

    const result = await model.listLastVersionServices()();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      const values = O.toUndefined(result.right);
      expect(values).toHaveLength(1);
      if (values !== undefined) {
        expect(values[0]).toHaveProperty(
          "serviceMetadata.category",
          StandardServiceCategoryEnum.STANDARD
        );
      }
    }
  });

  it("should decode services metadata with category", async () => {
    const standardServiceMetadata: StandardServiceMetadata = {
      scope: ServiceScopeEnum.LOCAL,
      category: StandardServiceCategoryEnum.STANDARD,
      customSpecialFlow: undefined
    };

    const specialServiceMetadata: SpecialServiceMetadata = {
      scope: ServiceScopeEnum.LOCAL,
      category: SpecialServiceCategoryEnum.SPECIAL,
      customSpecialFlow: "custom-flow-name" as NonEmptyString
    };

    const anotherService = {
      ...aRetrievedService,
      serviceId: "anotherServiceId"
    };

    const asyncIterable = getAsyncIterable([
      [
        { ...aRetrievedService, serviceMetadata: standardServiceMetadata },
        { ...anotherService, serviceMetadata: specialServiceMetadata }
      ]
    ]);
    mockGetAsyncIterator.mockReturnValueOnce(asyncIterable);

    const model = new ServiceModel(containerMock);

    const result = await model.listLastVersionServices()();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      const values = O.toUndefined(result.right);
      expect(values).toHaveLength(2);
      if (values !== undefined) {
        expect(values[0]).toHaveProperty(
          "serviceMetadata",
          standardServiceMetadata
        );
        expect(values[1]).toHaveProperty(
          "serviceMetadata",
          specialServiceMetadata
        );
      }
    }
  });

  it("should require category on NewService type", () => {
    const aCommonServiceMetadata: CommonServiceMetadata = {
      scope: ServiceScopeEnum.LOCAL
    };

    const aNewServiceWithoutCategory: NewService = {
      ...aRawService,
      kind: "INewService",
      // @ts-expect-error
      serviceMetadata: aCommonServiceMetadata
    };

    const decodedValue = NewService.decode(aNewServiceWithoutCategory);
    expect(E.isRight(decodedValue)).toBeTruthy();

    const aServiceMetadata: ServiceMetadata = {
      scope: ServiceScopeEnum.LOCAL,
      category: SpecialServiceCategoryEnum.SPECIAL
    };

    const aNewServiceWithCategory: NewService = {
      ...aRawService,
      kind: "INewService",
      serviceMetadata: aServiceMetadata
    };

    const decodedValue2 = NewService.decode(aNewServiceWithoutCategory);
    expect(E.isRight(decodedValue2)).toBeTruthy();
  });
});
