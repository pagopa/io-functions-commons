/* tslint:disable:no-any */
/* tslint:disable:no-identical-functions */

import { isLeft, isRight } from "fp-ts/lib/Either";
import { isSome } from "fp-ts/lib/Option";

import * as DocumentDb from "documentdb";

import * as DocumentDbUtils from "../../utils/documentdb";

import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { FiscalCode } from "../../../generated/definitions/FiscalCode";

import { UserDataProcessingChoiceEnum } from "../../../generated/definitions/UserDataProcessingChoice";
import { UserDataProcessingStatusEnum } from "../../../generated/definitions/UserDataProcessingStatus";
import {
  makeUserDataProcessingId,
  RetrievedUserDataProcessing,
  USER_DATA_PROCESSING_COLLECTION_NAME,
  UserDataProcessing,
  UserDataProcessingModel
} from "../user_data_processing";

const aDatabaseUri = DocumentDbUtils.getDatabaseUri("mockdb" as NonEmptyString);
const userDataProcessingCollectionUrl = DocumentDbUtils.getCollectionUri(
  aDatabaseUri,
  USER_DATA_PROCESSING_COLLECTION_NAME
);

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const aUserDataProcessingChoice = UserDataProcessingChoiceEnum.DOWNLOAD;
const aUserDataProcessingStatus = UserDataProcessingStatusEnum.PENDING;
const aModelId = makeUserDataProcessingId(
  aUserDataProcessingChoice,
  aFiscalCode
);

const aRetrievedUserDataProcessing: RetrievedUserDataProcessing = {
  _self: "xyz",
  _ts: 123,
  choice: aUserDataProcessingChoice,
  createdAt: new Date(),
  fiscalCode: aFiscalCode,
  id: "xyz" as NonEmptyString,
  kind: "IRetrievedUserDataProcessing",
  status: aUserDataProcessingStatus,
  userDataProcessingId: aModelId,
  version: 0 as NonNegativeNumber
};

describe("findLastVersionByModelId", () => {
  it("should resolve a promise to an existing userDataProcessing", async () => {
    const iteratorMock = {
      executeNext: jest.fn(cb =>
        cb(undefined, [aRetrievedUserDataProcessing], undefined)
      ),
      hasMoreResults: jest.fn().mockReturnValue(false)
    };

    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock)
    };

    const model = new UserDataProcessingModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      userDataProcessingCollectionUrl
    );

    const result = await model.findOneUserDataProcessingById(
      aFiscalCode,
      aModelId
    );

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      expect(result.value.toUndefined()).toEqual(aRetrievedUserDataProcessing);
    }
  });

  it("should resolve a promise to undefined if no userDataProcessing is found", async () => {
    const iteratorMock = {
      executeNext: jest.fn(cb => cb(undefined, [], undefined)),
      hasMoreResults: jest.fn().mockReturnValue(false)
    };

    const clientMock = {
      queryDocuments: jest.fn((__, ___) => iteratorMock)
    };

    const model = new UserDataProcessingModel(
      (clientMock as any) as DocumentDb.DocumentClient,
      userDataProcessingCollectionUrl
    );

    const result = await model.findOneUserDataProcessingById(
      aFiscalCode,
      aModelId
    );

    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isNone()).toBeTruthy();
    }
  });
});

describe("createUserDataProcessing", () => {
  it("should create a new user data processing", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, newDocument, __, cb) => {
        cb(undefined, {
          ...newDocument,
          _self: "self",
          _ts: 123
        });
      })
    };

    const model = new UserDataProcessingModel(
      clientMock,
      userDataProcessingCollectionUrl
    );

    const newUserDataProcessing: UserDataProcessing = {
      choice: aUserDataProcessingChoice,
      createdAt: new Date(),
      fiscalCode: aFiscalCode,
      status: aUserDataProcessingStatus,
      userDataProcessingId: aModelId
    };

    const result = await model.create(
      newUserDataProcessing,
      newUserDataProcessing.fiscalCode
    );

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(clientMock.createDocument.mock.calls[0][2]).toHaveProperty(
      "partitionKey",
      aFiscalCode
    );
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.fiscalCode).toEqual(newUserDataProcessing.fiscalCode);
      expect(result.value.userDataProcessingId).toEqual(
        `${newUserDataProcessing.userDataProcessingId}`
      );
      expect(result.value.version).toEqual(0);
    }
  });

  it("should reject the promise in case of error", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, __, ___, cb) => {
        cb("error");
      })
    };

    const model = new UserDataProcessingModel(
      clientMock,
      userDataProcessingCollectionUrl
    );

    const newUserDataProcessing: UserDataProcessing = {
      choice: aUserDataProcessingChoice,
      createdAt: new Date(),
      fiscalCode: aFiscalCode,
      status: aUserDataProcessingStatus,
      userDataProcessingId: aModelId
    };

    const result = await model.create(newUserDataProcessing, "fiscalCode");

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});

describe("update", () => {
  it("should update an existing user data processing", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, newDocument, __, cb) => {
        cb(undefined, {
          ...newDocument,
          _self: "self",
          _ts: 123
        });
      }),
      readDocument: jest.fn((_, __, cb) =>
        cb(undefined, aRetrievedUserDataProcessing)
      )
    };

    const model = new UserDataProcessingModel(
      clientMock,
      userDataProcessingCollectionUrl
    );

    const result = await model.update(
      aRetrievedUserDataProcessing.userDataProcessingId,
      aRetrievedUserDataProcessing.fiscalCode,
      p => {
        return {
          ...p,
          status: UserDataProcessingStatusEnum.CLOSED
        };
      }
    );

    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument.mock.calls[0][1].kind).toBeUndefined();
    expect(clientMock.createDocument.mock.calls[0][2]).toHaveProperty(
      "partitionKey",
      aFiscalCode
    );
    expect(isRight(result)).toBeTruthy();
    if (isRight(result)) {
      expect(result.value.isSome()).toBeTruthy();
      if (isSome(result.value)) {
        const updatedUserDataProcessing = result.value.value;
        expect(updatedUserDataProcessing.fiscalCode).toEqual(
          aRetrievedUserDataProcessing.fiscalCode
        );
        expect(updatedUserDataProcessing.id).toEqual(
          `${aRetrievedUserDataProcessing.userDataProcessingId}-${"0".repeat(
            15
          )}1`
        );
        expect(updatedUserDataProcessing.version).toEqual(1);
        expect(updatedUserDataProcessing.status).toEqual(
          UserDataProcessingStatusEnum.CLOSED
        );
      }
    }
  });

  it("should reject the promise in case of error (read)", async () => {
    const clientMock: any = {
      createDocument: jest.fn(),
      readDocument: jest.fn((_, __, cb) => cb("error"))
    };

    const model = new UserDataProcessingModel(
      clientMock,
      userDataProcessingCollectionUrl
    );

    const result = await model.update(aFiscalCode, aFiscalCode, o => o);

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument).not.toHaveBeenCalled();

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });

  it("should reject the promise in case of error (create)", async () => {
    const clientMock: any = {
      createDocument: jest.fn((_, __, ___, cb) => cb("error")),
      readDocument: jest.fn((_, __, cb) =>
        cb(undefined, aRetrievedUserDataProcessing)
      )
    };

    const model = new UserDataProcessingModel(
      clientMock,
      userDataProcessingCollectionUrl
    );

    const result = await model.update(aFiscalCode, aFiscalCode, o => o);

    expect(clientMock.readDocument).toHaveBeenCalledTimes(1);
    expect(clientMock.createDocument).toHaveBeenCalledTimes(1);

    expect(isLeft(result)).toBeTruthy();
    if (isLeft(result)) {
      expect(result.value).toEqual("error");
    }
  });
});
