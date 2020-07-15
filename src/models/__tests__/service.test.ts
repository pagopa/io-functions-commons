/* tslint:disable:no-any */
/* tslint:disable:no-identical-functions */

import { isLeft, isRight } from "fp-ts/lib/Either";

import { Container } from "@azure/cosmos";
import { NonNegativeInteger } from "italia-ts-commons/lib/numbers";
import {
  NonEmptyString,
  OrganizationFiscalCode
} from "italia-ts-commons/lib/strings";
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

describe("findOneServiceById", () => {
  it("should return an existing service", async () => {
    const containerMock = ({
      items: {
        create: jest.fn(),
        query: jest.fn(_ => ({
          fetchAll: jest.fn(_ =>
            Promise.resolve({
              resources: [aRetrievedService]
            })
          )
        }))
      }
    } as unknown) as Container;

    const model = new ServiceModel(containerMock);

    const result = await model.findOneByServiceId("id" as NonEmptyString).run();

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(aRetrievedService);
    }
  });

  it("should resolve to an empty value if no service is found", async () => {
    const containerMock = ({
      items: {
        create: jest.fn(),
        query: jest.fn(_ => ({
          fetchAll: jest.fn(_ =>
            Promise.resolve({
              resources: []
            })
          )
        }))
      }
    } as unknown) as Container;

    const model = new ServiceModel(containerMock);

    const result = await model.findOneByServiceId("id" as NonEmptyString).run();

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isNone()).toBeTruthy();
    }
  });

  it("should validate the retrieved object agains the model type", async () => {
    const containerMock = ({
      items: {
        create: jest.fn(),
        query: jest.fn(_ => ({
          fetchAll: jest.fn(_ =>
            Promise.resolve({
              resources: [{}]
            })
          )
        }))
      }
    } as unknown) as Container;

    const model = new ServiceModel(containerMock);

    const result = await model.findOneByServiceId("id" as NonEmptyString).run();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toBe("COSMOS_DECODING_ERROR");
    }
  });
});
