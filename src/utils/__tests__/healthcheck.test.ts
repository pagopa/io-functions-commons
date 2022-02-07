import { BlobService, ErrorOrResult, ServiceResponse } from "azure-storage";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import {
  checkApplicationHealth,
  checkConfigHealth,
  checkAzureStorageHealth,
  checkAzureCosmosDbHealth,
  checkUrlHealth,
  HealthCheck,
  HealthProblem,
  toHealthProblems
} from "../healthcheck";

import * as healthcheck from "../healthcheck";

import { pipe } from "fp-ts/lib/function";

import * as TE from "fp-ts/lib/TaskEither";
import { right } from "fp-ts/lib/Either";
import { CosmosClient } from "@azure/cosmos";

import * as t from "io-ts";

const azure_storage = require("azure-storage");

const blobServiceOk: BlobService = ({
  getServiceProperties: jest
    .fn()
    .mockImplementation((callback: ErrorOrResult<any>) =>
      callback(
        (null as unknown) as Error,
        "ok",
        (null as unknown) as ServiceResponse
      )
    )
} as unknown) as BlobService;

const getBlobServiceKO = (name: string) =>
  (({
    getServiceProperties: jest
      .fn()
      .mockImplementation((callback: ErrorOrResult<any>) =>
        callback(
          Error(`error - ${name}`),
          null,
          (null as unknown) as ServiceResponse
        )
      )
  } as unknown) as BlobService);

const azureStorageMocks = {
  createBlobService: jest.fn(_ => blobServiceOk),
  createFileService: jest.fn(_ => blobServiceOk),
  createQueueService: jest.fn(_ => blobServiceOk),
  createTableService: jest.fn(_ => blobServiceOk)
};

function mockAzureStorageFunctions() {
  azure_storage["createBlobService"] = azureStorageMocks["createBlobService"];
  azure_storage["createFileService"] = azureStorageMocks["createFileService"];
  azure_storage["createQueueService"] = azureStorageMocks["createQueueService"];
  azure_storage["createTableService"] = azureStorageMocks["createTableService"];
}

//IConfig mock

type IConfig = t.TypeOf<typeof IConfig>;
const IConfig = t.interface({
  value1: NonEmptyString,
  value2: NonEmptyString
});

const aValidConfig = { value1: "aValue", value2: "anotherValue" };

// Cosmos DB mock

const mockGetDatabaseAccountOk = async () => {};
const mockGetDatabaseAccountKO = async () => {
  throw Error("Error calling Cosmos Db");
};

const mockGetDatabaseAccount = jest
  .fn()
  .mockImplementation(mockGetDatabaseAccountOk);

function mockCosmosClient() {
  jest.spyOn(healthcheck, "buildCosmosClient").mockReturnValue(({
    getDatabaseAccount: mockGetDatabaseAccount
  } as unknown) as CosmosClient);
}

// -------------
// TESTS
// -------------

describe("healthcheck - config health", () => {
  beforeAll(() => {
    jest.clearAllMocks();
  });

  it("should not throw exception", async done => {
    expect.assertions(1);

    pipe(
      aValidConfig,
      checkConfigHealth(IConfig),
      TE.map(_ => {
        expect(true).toBeTruthy();
        done();
      })
    )();
  });

  it("should return an error if environment is ot well-defined", async done => {
    expect.assertions(3);

    pipe(
      {},
      checkConfigHealth(IConfig),
      TE.map(_ => {
        expect(false).toBeTruthy();
        done();
      }),
      TE.mapLeft(errors => {
        expect(true).toBeTruthy();
        expect(errors[0]).toEqual(
          "Config|value [undefined] at [root.value1] is not a valid [non empty string]"
        );
        expect(errors[1]).toEqual(
          "Config|value [undefined] at [root.value2] is not a valid [non empty string]"
        );
        done();
      })
    )();
  });
});

describe("healthcheck - storage account", () => {
  beforeAll(() => {
    jest.clearAllMocks();
    mockAzureStorageFunctions();
  });

  it("should not throw exception", async done => {
    expect.assertions(1);

    pipe(
      "",
      checkAzureStorageHealth,
      TE.map(_ => {
        expect(true).toBeTruthy();
        done();
      })
    )();
  });

  const testcases: {
    name: keyof typeof azureStorageMocks;
  }[] = [
    {
      name: "createBlobService"
    },
    {
      name: "createFileService"
    },
    {
      name: "createQueueService"
    },
    {
      name: "createTableService"
    }
  ];
  test.each(testcases)(
    "should throw exception %s",
    async ({ name }, done: any) => {
      const blobServiceKO = getBlobServiceKO(name);
      azureStorageMocks[name].mockReturnValueOnce(blobServiceKO);

      expect.assertions(2);

      pipe(
        "",
        checkAzureStorageHealth,
        TE.mapLeft(err => {
          expect(err.length).toBe(1);
          expect(err[0]).toBe(`AzureStorage|error - ${name}`);
          done();
        }),
        TE.map(_ => {
          expect(true).toBeFalsy();
          done();
        })
      )();
    }
  );
});

describe("healthcheck - cosmos db", () => {
  beforeAll(() => {
    jest.clearAllMocks();
    mockCosmosClient();
  });

  it("should return no error", async done => {
    expect.assertions(1);

    pipe(
      checkAzureCosmosDbHealth("", ""),
      TE.map(_ => {
        expect(true).toBeTruthy();
        done();
      }),
      TE.mapLeft(_ => {
        expect(true).toBeFalsy();
        done();
      })
    )();
  });

  it("should return an error if CosmosClient fails", async done => {
    expect.assertions(1);

    mockGetDatabaseAccount.mockImplementationOnce(mockGetDatabaseAccountKO);

    pipe(
      checkAzureCosmosDbHealth("", ""),
      TE.map(_ => {
        expect(false).toBeTruthy();
        done();
      }),
      TE.mapLeft(_ => {
        expect(true).toBeTruthy();
        done();
      })
    )();
  });
});

describe("healthcheck - url health", () => {
  beforeAll(() => {
    jest.clearAllMocks();
  });

  // todo
  it("should return no error", () => {
    expect(true).toBeTruthy();
  });

  it("should return an error if Url check fails", async done => {
    expect.assertions(1);

    pipe(
      checkUrlHealth(""),
      TE.map(_ => {
        expect(false).toBeTruthy();
        done();
      }),
      TE.mapLeft(_ => {
        expect(true).toBeTruthy();
        done();
      })
    )();
  });
});

describe("checkApplicationHealth - multiple errors", () => {
  beforeAll(() => {
    jest.clearAllMocks();
    mockCosmosClient();
    mockAzureStorageFunctions();
  });
  it("should return multiple errors from different checks", async done => {
    const blobServiceKO = getBlobServiceKO("createBlobService");
    const queueServiceKO = getBlobServiceKO("createQueueService");
    azureStorageMocks["createBlobService"].mockReturnValueOnce(blobServiceKO);
    azureStorageMocks["createQueueService"].mockReturnValueOnce(queueServiceKO);
    expect.assertions(4);
    pipe(
      aValidConfig,
      checkApplicationHealth(IConfig, [
        c => checkAzureStorageHealth(c.value1),
        c => checkUrlHealth(c.value1)
      ]),
      TE.mapLeft(err => {
        expect(err.length).toBe(3);
        expect(err[0]).toBe(`AzureStorage|error - createBlobService`);
        expect(err[1]).toBe(`AzureStorage|error - createQueueService`);
        expect(err[2]).toBe(`Url|Only absolute URLs are supported`);
        done();
      }),
      TE.map(_ => {
        expect(true).toBeFalsy();
        done();
      })
    )();
  });

  it("should support custom health checks when every check is ok", async () => {
    const customHC1 = (): HealthCheck<"HC1", true> => TE.of(true);
    const customHC2 = (): HealthCheck<"HC2", true> => TE.of(true);

    await pipe(
      aValidConfig,
      checkApplicationHealth(IConfig, [c => customHC1(), c => customHC2()]),
      TE.mapLeft(err => {
        fail("This should not be called");
      }),
      TE.map(_ => {
        expect(_).toBe(true);
      })
    )();
  });

  it("should support custom health checks when config check fails", async () => {
    const customHC1 = (): HealthCheck<"HC1", true> => TE.of(true);
    const customHC2 = (): HealthCheck<"HC2", true> => TE.of(true);
    const anInvalidConfig = {};

    await pipe(
      anInvalidConfig,
      checkApplicationHealth(IConfig, [c => customHC1(), c => customHC2()]),
      TE.mapLeft(err => {
        // trick: extract prefix from messagest to get the error kind
        const kinds = err
          .map(_ => _.split("|")[0])
          .filter((value, index, self) => self.indexOf(value) === index);
        expect(kinds).toEqual(["Config"]);
      }),
      TE.map(_ => {
        fail("This should not be called");
      })
    )();
  });

  it("should support custom health checks when custom health checks fail", async () => {
    const customHC1 = (): HealthCheck<"HC1", true> =>
      TE.left(toHealthProblems("HC1")("first issue"));
    const customHC2 = (): HealthCheck<"HC2", true> =>
      TE.left(toHealthProblems("HC2")("second issue"));

    await pipe(
      aValidConfig,
      checkApplicationHealth(IConfig, [c => customHC1(), c => customHC2()]),
      TE.mapLeft(err => {
        // trick: extract prefix from messagest to get the error kind
        const kinds = err
          .map(_ => _.split("|")[0])
          .filter((value, index, self) => self.indexOf(value) === index)
          .sort();
        expect(kinds).toEqual(["HC1", "HC2"]);
        expect(err.length).toBe(2);
      }),
      TE.map(_ => {
        fail("This should not be called");
      })
    )();
  });
});
