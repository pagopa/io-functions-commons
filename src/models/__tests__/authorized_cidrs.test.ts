import { Container } from "@azure/cosmos";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import { CIDR } from "../../../generated/definitions/CIDR";
import {
  AuthorizedCIDRs,
  AuthorizedCIDRsModel,
  RetrievedAuthorizedCIDRs
} from "../authorized_cidrs";

const anAuthorizedCIDRs: AuthorizedCIDRs = {
  id: "MANAGE-123" as NonEmptyString,
  cidrs: new Set((["0.0.0.0"] as unknown) as CIDR[])
};

const anInvalidAuthorizedCIDRs: AuthorizedCIDRs = {
  ...anAuthorizedCIDRs,
  cidrs: new Set((["0.0"] as unknown) as CIDR[])
};

const anInvalidAuthorizedCIDRsID: AuthorizedCIDRs = {
  ...anAuthorizedCIDRs,
  id: "" as NonEmptyString
};

const aRetrievedAuthorizedCIDRs: RetrievedAuthorizedCIDRs = {
  ...anAuthorizedCIDRs,
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
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
  it("GIVEN a valid authorizedCIDRs object WHEN the object is decode THEN the decode succeed", async () => {
    const result = AuthorizedCIDRs.decode(anAuthorizedCIDRs);
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a invalid authorizedCIDRs object WHEN the object is decode THEN the decode fails", async () => {
    const result = AuthorizedCIDRs.decode(anInvalidAuthorizedCIDRs);
    expect(E.isLeft(result)).toBeTruthy();
  });

  it("GIVEN a invalid id WHEN the object is decode THEN the decode fails", async () => {
    const result = AuthorizedCIDRs.decode(anInvalidAuthorizedCIDRsID);
    expect(E.isLeft(result)).toBeTruthy();
  });

  it("GIVEN a valid authorizedCIDRs WHEN the client CREATE is called THEN the create return a Right", async () => {
    mockCreate.mockImplementationOnce((_, __) =>
      Promise.resolve({
        resource: { ...aRetrievedAuthorizedCIDRs }
      })
    );
    const model = new AuthorizedCIDRsModel(containerMock);
    const result = await model.create(anAuthorizedCIDRs)();
    expect(mockCreate).toBeCalled();
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a valid authorizedCIDRs WHEN the client UPSERT is called THEN the upsert return a Right", async () => {
    mockUpsert.mockImplementationOnce((_, __) =>
      Promise.resolve({
        resource: { ...aRetrievedAuthorizedCIDRs }
      })
    );
    const model = new AuthorizedCIDRsModel(containerMock);
    const result = await model.upsert(anAuthorizedCIDRs)();
    expect(mockUpsert).toBeCalled();
    expect(E.isRight(result)).toBeTruthy();
  });

  it("GIVEN a valid cidrs list WHEN the client PATCH is called THEN the upsert return a Right", async () => {
    mockPatch.mockImplementationOnce((_, __) =>
      Promise.resolve({
        resource: { ...aRetrievedAuthorizedCIDRs }
      })
    );
    const model = new AuthorizedCIDRsModel(containerMock);
    const result = await model.patch([anAuthorizedCIDRs.id], {
      cidrs: anAuthorizedCIDRs.cidrs
    })();
    expect(mockPatch).toBeCalled();
    expect(E.isRight(result)).toBeTruthy();
  });
});
