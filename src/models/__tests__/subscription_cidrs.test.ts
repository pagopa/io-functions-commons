import { Container } from "@azure/cosmos";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import { CIDR } from "../../../generated/definitions/v2/CIDR";
import { toAuthorizedCIDRs } from "../service";
import {
  SubscriptionCIDRs,
  SubscriptionCIDRsModel,
  RetrievedSubscriptionCIDRs
} from "../subscription_cidrs";

const aSubscriptionCIDRs: SubscriptionCIDRs = {
  subscriptionId: "MANAGE-123" as NonEmptyString,
  cidrs: toAuthorizedCIDRs([])
};

const anInvalidSubscriptionCIDRs: SubscriptionCIDRs = {
  ...aSubscriptionCIDRs,
  cidrs: new Set((["0.0"] as unknown) as CIDR[])
};

const anInvalidSubscriptionCIDRsID: SubscriptionCIDRs = {
  ...aSubscriptionCIDRs,
  subscriptionId: "" as NonEmptyString
};

const aRetrievedSubscriptionCIDRs: RetrievedSubscriptionCIDRs = {
  ...aSubscriptionCIDRs,
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  id: "xyz" as NonEmptyString,
  kind: "IRetrievedSubscriptionCIDRs",
  version: 0 as NonNegativeInteger
};

const mockFetchAll = jest.fn();
const mockGetAsyncIterator = jest.fn();
const mockCreate = jest.fn();
const mockUpsert = jest.fn();
const mockPatch = jest.fn();

const containerMock = ({
  items: {
    readAll: jest.fn(() => ({
      fetchAll: mockFetchAll,
      getAsyncIterator: mockGetAsyncIterator
    })),
    create: mockCreate,
    query: jest.fn(() => ({
      fetchAll: mockFetchAll
    })),
    upsert: mockUpsert
  },
  item: jest.fn((_, __) => ({
    patch: mockPatch
  }))
} as unknown) as Container;

describe("Authorized CIDRs", () => {
  it("GIVEN a valid subscriptionCIDRs object WHEN the object is decoded THEN the decode succeed", async () => {
    const result = SubscriptionCIDRs.decode(aSubscriptionCIDRs);
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a invalid subscriptionCIDRs object WHEN the object is decoded THEN the decode fails", async () => {
    const result = SubscriptionCIDRs.decode(anInvalidSubscriptionCIDRs);
    expect(E.isLeft(result)).toBeTruthy();
  });

  it("GIVEN a invalid id WHEN the object is decode THEN the decode fails", async () => {
    const result = SubscriptionCIDRs.decode(anInvalidSubscriptionCIDRsID);
    expect(E.isLeft(result)).toBeTruthy();
  });

  it("GIVEN a valid subscriptionCIDRs WHEN the client CREATE is called THEN the create return a Right", async () => {
    mockCreate.mockImplementationOnce((_, __) =>
      Promise.resolve({
        resource: { ...aRetrievedSubscriptionCIDRs }
      })
    );
    const model = new SubscriptionCIDRsModel(containerMock);
    const result = await model.create({
      ...aSubscriptionCIDRs,
      kind: "INewSubscriptionCIDRs"
    })();
    expect(mockCreate).toBeCalled();
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a valid subscriptionId WHEN the client findLastVersionByModelId is called THEN return the retrieved subscriptionCIDRs", async () => {
    mockFetchAll.mockImplementationOnce(() =>
      Promise.resolve({
        resources: [aRetrievedSubscriptionCIDRs]
      })
    );

    const model = new SubscriptionCIDRsModel(containerMock);

    const result = await model.findLastVersionByModelId([
      "subscriptionId" as NonEmptyString
    ])();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBeTruthy();
      if (O.isSome(result.right)) {
        expect(result.right.value).toStrictEqual(aRetrievedSubscriptionCIDRs);
      }
    }
  });
});
