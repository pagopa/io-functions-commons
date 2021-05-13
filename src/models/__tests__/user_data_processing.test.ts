/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable sonarjs/no-identical-functions */

import { isLeft, isRight } from "fp-ts/lib/Either";
import { toString } from "fp-ts/lib/function";

import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode } from "../../../generated/definitions/FiscalCode";

import { Container, FeedResponse, ResourceResponse, User } from "@azure/cosmos";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { UserDataProcessingChoiceEnum } from "../../../generated/definitions/UserDataProcessingChoice";
import { UserDataProcessingStatusEnum } from "../../../generated/definitions/UserDataProcessingStatus";
import {
  makeUserDataProcessingId,
  NewUserDataProcessing,
  RetrievedUserDataProcessing,
  UserDataProcessing,
  UserDataProcessingId,
  UserDataProcessingModel
} from "../user_data_processing";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const aUserDataProcessingChoice = UserDataProcessingChoiceEnum.DOWNLOAD;
const aUserDataProcessingStatus = UserDataProcessingStatusEnum.PENDING;
const aModelId = makeUserDataProcessingId(
  aUserDataProcessingChoice,
  aFiscalCode
);
const aDate = new Date();

const aRetrievedUserDataProcessing: RetrievedUserDataProcessing = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  choice: aUserDataProcessingChoice,
  createdAt: aDate,
  fiscalCode: aFiscalCode,
  id: (aModelId as unknown) as NonEmptyString,
  kind: "IRetrievedUserDataProcessing",
  status: aUserDataProcessingStatus,
  userDataProcessingId: aModelId,
  version: 0 as NonNegativeInteger
};

const aUserDataProcessing: UserDataProcessing = {
  choice: aUserDataProcessingChoice,
  createdAt: aDate,
  fiscalCode: aFiscalCode,
  status: aUserDataProcessingStatus,
  updatedAt: aDate,
  userDataProcessingId: aModelId
};

const aNewUserDataProcessing: NewUserDataProcessing = {
  ...aUserDataProcessing,
  kind: "INewUserDataProcessing"
};

const someMetadata = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};

describe("createOrUpdateByNewOne", () => {
  it("should upsert an existing user data processing", async () => {
    const containerMock = ({
      items: {
        create: jest.fn().mockResolvedValueOnce(
          new ResourceResponse(
            {
              ...aNewUserDataProcessing,
              ...someMetadata,
              // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
              id: aModelId + "1",
              test: "anUpdatedUserDataProcessing",
              version: 1
            },
            {},
            200,
            200
          )
        ),
        query: jest.fn(() => ({
          fetchAll: jest.fn(() =>
            Promise.resolve(
              new FeedResponse([aRetrievedUserDataProcessing], {}, false)
            )
          )
        }))
      }
    } as unknown) as Container;

    const model = new UserDataProcessingModel(containerMock);

    const result = await model
      .createOrUpdateByNewOne(aUserDataProcessing)
      .run();

    result.fold(
      err => {
        // @ts-ignore
        console.log(err.error);
        fail(
          `Failed createOrUpdateByNewOne, kind: ${err.kind}, reason: ${
            err.kind === "COSMOS_DECODING_ERROR"
              ? readableReport(err.error)
              : "unknown"
          }`
        );
      },
      value => {
        expect(value.updatedAt).toEqual(aNewUserDataProcessing.createdAt);
        expect(value.userDataProcessingId).toEqual(
          `${aNewUserDataProcessing.userDataProcessingId}`
        );
      }
    );
  });

  it("should return a CosmosErrors in case of errors", async () => {
    const containerMock = ({
      items: {
        create: jest.fn().mockRejectedValueOnce({ code: 500 }),
        query: jest.fn(() => ({
          fetchAll: jest.fn(() =>
            Promise.resolve({
              resources: [aRetrievedUserDataProcessing]
            })
          )
        }))
      }
    } as unknown) as Container;

    const model = new UserDataProcessingModel(containerMock);

    const result = await model
      .createOrUpdateByNewOne(aNewUserDataProcessing)
      .run();

    expect(containerMock.items.create).toHaveBeenCalledTimes(1);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value.kind).toEqual("COSMOS_ERROR_RESPONSE");
    }
  });
});

describe("UserDataProcessingId", () => {
  it("should decode a valid id", () => {
    const id = `${aFiscalCode}-${UserDataProcessingChoiceEnum.DELETE}`;
    const decoded = UserDataProcessingId.decode(id)
      .mapLeft(readableReport)
      .getOrElseL(err =>
        fail(`Cannot decode UserDataProcessingId, id: ${id}, err: ${err}`)
      );

    expect(id).toBe(decoded);
    expect(UserDataProcessingId.is(id)).toBe(true);
  });

  // eslint-disable sonar/no-nested-template-literals
  it.each`
    name                        | value
    ${"with wrong separator"}   | ${aFiscalCode + "--" + UserDataProcessingChoiceEnum.DELETE}
    ${"with wrong fiscal code"} | ${"wrong-" + UserDataProcessingChoiceEnum.DELETE}
    ${"with wrong choice"}      | ${aFiscalCode + "-wrong"}
  `("should not decode an invalid id $name", ({ value }) => {
    const result = UserDataProcessingId.decode(value);

    expect(result.isRight()).toBeFalsy();
  });
});

describe("makeUserDataProcessingId", () => {
  it("should create an id with valid values", () => {
    const result = makeUserDataProcessingId(
      UserDataProcessingChoiceEnum.DOWNLOAD,
      aFiscalCode
    );

    expect(UserDataProcessingId.is(result)).toBeTruthy();
  });

  it("should not create an id with invalid values", () => {
    const lazy = () =>
      makeUserDataProcessingId(
        // @ts-ignore
        "wrong choice",
        // @ts-ignore
        "wrong fiscal code"
      );

    expect(lazy).toThrow();
  });
});

describe("userDataProcessing", () => {
  it.each`
    value
    ${{
  ...aUserDataProcessing,
  status: UserDataProcessingStatusEnum.CLOSED
}}
    ${{
  ...aUserDataProcessing,
  status: UserDataProcessingStatusEnum.FAILED
}}
    ${{
  ...aUserDataProcessing,
  status: UserDataProcessingStatusEnum.FAILED,
  reason: "a"
}}
    ${{
  ...aUserDataProcessing,
  status: UserDataProcessingStatusEnum.WIP,
  reason: "a"
}}
  `("should decode valid UserDataProcessing records", ({ value }) => {
    let result = UserDataProcessing.decode(value);

    expect(result.isRight()).toBeTruthy();
  });

  const aWrongWithStringReason = {
    ...aUserDataProcessing,
    status: UserDataProcessingStatusEnum.CLOSED,
    reason: "any reason"
  };

  const aWrongWithNoReason = {
    ...aUserDataProcessing,
    status: UserDataProcessingStatusEnum.CLOSED
  };

  const aWrongWithUndefinedReason = {
    ...aUserDataProcessing,
    status: UserDataProcessingStatusEnum.CLOSED,
    reason: undefined
  };

  const { status: _, ...aWrongWithNoStatus } = aUserDataProcessing;
});
