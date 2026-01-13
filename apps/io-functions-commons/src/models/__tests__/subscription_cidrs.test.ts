import { Container } from "@azure/cosmos";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";

import { CIDR } from "../../../generated/definitions/CIDR";
import { toAuthorizedCIDRs } from "../service";
import {
  RetrievedSubscriptionCIDRs,
  SubscriptionCIDRs,
  SubscriptionCIDRsModel,
} from "../subscription_cidrs";
import { vi } from "vitest";

const aSubscriptionCIDRs: SubscriptionCIDRs = {
  cidrs: toAuthorizedCIDRs([]),
  subscriptionId: "MANAGE-123" as NonEmptyString,
};

const anInvalidSubscriptionCIDRs: SubscriptionCIDRs = {
  ...aSubscriptionCIDRs,
  cidrs: new Set(["0.0"] as unknown as CIDR[]),
};

const anInvalidSubscriptionCIDRsID: SubscriptionCIDRs = {
  ...aSubscriptionCIDRs,
  subscriptionId: "" as NonEmptyString,
};

const aRetrievedSubscriptionCIDRs: RetrievedSubscriptionCIDRs = {
  ...aSubscriptionCIDRs,
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  id: "xyz" as NonEmptyString,
  kind: "IRetrievedSubscriptionCIDRs",
  version: 0 as NonNegativeInteger,
};

const mockFetchAll = vi.fn();
const mockGetAsyncIterator = vi.fn();
const mockCreate = vi.fn();
const mockUpsert = vi.fn();
const mockPatch = vi.fn();

const containerMock = {
  item: vi.fn((_, __) => ({
    patch: mockPatch,
  })),
  items: {
    create: mockCreate,
    query: vi.fn(() => ({
      fetchAll: mockFetchAll,
    })),
    readAll: vi.fn(() => ({
      fetchAll: mockFetchAll,
      getAsyncIterator: mockGetAsyncIterator,
    })),
    upsert: mockUpsert,
  },
} as unknown as Container;

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
        resource: { ...aRetrievedSubscriptionCIDRs },
      }),
    );
    const model = new SubscriptionCIDRsModel(containerMock);
    const result = await model.create({
      ...aSubscriptionCIDRs,
      kind: "INewSubscriptionCIDRs",
    })();
    expect(mockCreate).toBeCalledWith();
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a valid subscriptionId WHEN the client findLastVersionByModelId is called THEN return the retrieved subscriptionCIDRs", async () => {
    mockFetchAll.mockImplementationOnce(() =>
      Promise.resolve({
        resources: [aRetrievedSubscriptionCIDRs],
      }),
    );

    const model = new SubscriptionCIDRsModel(containerMock);

    const result = await model.findLastVersionByModelId([
      "subscriptionId" as NonEmptyString,
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
