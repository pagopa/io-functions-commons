import { Container } from "@azure/cosmos";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";

import { ActivationStatusEnum } from "../../../generated/definitions/ActivationStatus";
import { generateComposedVersionedModelId } from "../../utils/cosmosdb_model_composed_versioned";
import {
  Activation,
  ACTIVATION_MODEL_PK_FIELD,
  ACTIVATION_REFERENCE_ID_FIELD,
  ActivationModel,
  NewActivation,
  RetrievedActivation,
} from "../activation";
import { vi } from "vitest";
const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const aServiceId = "xyz" as NonEmptyString;
const aRawActivation: Activation = {
  fiscalCode: aFiscalCode,
  serviceId: aServiceId,
  status: ActivationStatusEnum.ACTIVE,
};
const aFirstVersionId = generateComposedVersionedModelId<
  Activation,
  typeof ACTIVATION_REFERENCE_ID_FIELD,
  typeof ACTIVATION_MODEL_PK_FIELD
>(aServiceId, aFiscalCode, 0 as NonNegativeInteger);
const aRetrivedActivation: RetrievedActivation = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  id: aFirstVersionId,
  kind: "IRetrievedActivation",
  version: 0 as NonNegativeInteger,
  ...aRawActivation,
};

const mockFetchAll = vi.fn();
const mockCreate = vi.fn();

const containerMock = {
  items: {
    create: mockCreate,
    query: vi.fn(() => ({
      fetchAll: mockFetchAll,
    })),
  },
} as unknown as Container;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findLastVersionByModelId", () => {
  it("should resolve to an existing activation", async () => {
    mockFetchAll.mockImplementationOnce(() =>
      Promise.resolve({
        resources: [aRetrivedActivation],
      }),
    );
    const model = new ActivationModel(containerMock);

    const result = await model.findLastVersionByModelId([
      aServiceId,
      aFiscalCode,
    ])();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBeTruthy();
      expect(O.toUndefined(result.right)).toEqual({
        ...aRetrivedActivation,
      });
    }
  });

  it("should resolve to empty if activation was found", async () => {
    mockFetchAll.mockImplementationOnce(() =>
      Promise.resolve({
        resources: undefined,
      }),
    );

    const model = new ActivationModel(containerMock);

    const result = await model.findLastVersionByModelId([
      aServiceId,
      aFiscalCode,
    ])();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isNone(result.right)).toBeTruthy();
    }
  });

  it("should validate the retrieved object agains the model type", async () => {
    mockFetchAll.mockImplementationOnce(() =>
      Promise.resolve({
        resources: [{}],
      }),
    );

    const model = new ActivationModel(containerMock);

    const result = await model.findLastVersionByModelId([
      aServiceId,
      aFiscalCode,
    ])();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toBe("COSMOS_DECODING_ERROR");
    }
  });
});

describe("create", () => {
  it("should create a new activation", async () => {
    mockCreate.mockImplementationOnce((_, __) =>
      Promise.resolve({
        resource: aRetrivedActivation,
      }),
    );

    const model = new ActivationModel(containerMock);

    const newActivation: NewActivation = {
      fiscalCode: aFiscalCode,
      kind: "INewActivation",
      serviceId: aServiceId,
      status: ActivationStatusEnum.ACTIVE,
    };

    const result = await model.create(newActivation)();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0]).toEqual({
      ...newActivation,
      id: aFirstVersionId,
      version: 0,
    });
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right.fiscalCode).toEqual(newActivation.fiscalCode);
      expect(result.right.serviceId).toEqual(newActivation.serviceId);
      expect(result.right.id).toEqual(aFirstVersionId);
      expect(result.right.version).toEqual(0);
    }
  });
});

describe("upsert", () => {
  it("should create a new activation with version 0 if don't exists previous documents", async () => {
    mockCreate.mockImplementationOnce((_, __) =>
      Promise.resolve({
        resource: aRetrivedActivation,
      }),
    );
    mockFetchAll.mockImplementationOnce(() =>
      Promise.resolve({
        resources: undefined,
      }),
    );

    const model = new ActivationModel(containerMock);

    const newActivation: NewActivation = {
      fiscalCode: aFiscalCode,
      kind: "INewActivation",
      serviceId: aServiceId,
      status: ActivationStatusEnum.ACTIVE,
    };

    const result = await model.upsert(newActivation)();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0]).toEqual({
      ...newActivation,
      id: aFirstVersionId,
      version: 0,
    });
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right.fiscalCode).toEqual(newActivation.fiscalCode);
      expect(result.right.serviceId).toEqual(newActivation.serviceId);
      expect(result.right.id).toEqual(aFirstVersionId);
      expect(result.right.version).toEqual(0);
    }
  });

  it("should create a new activation with version 1 if exists a previous document", async () => {
    const expectedDocumentId = generateComposedVersionedModelId<
      Activation,
      typeof ACTIVATION_REFERENCE_ID_FIELD,
      typeof ACTIVATION_MODEL_PK_FIELD
    >(aServiceId, aFiscalCode, 1 as NonNegativeInteger);
    mockCreate.mockImplementationOnce((_, __) =>
      Promise.resolve({
        resource: {
          ...aRetrivedActivation,
          id: expectedDocumentId,
          version: 1,
        },
      }),
    );
    mockFetchAll.mockImplementationOnce(() =>
      Promise.resolve({
        resources: [aRetrivedActivation],
      }),
    );

    const model = new ActivationModel(containerMock);

    const newActivation: NewActivation = {
      fiscalCode: aFiscalCode,
      kind: "INewActivation",
      serviceId: aServiceId,
      status: ActivationStatusEnum.ACTIVE,
    };

    const result = await model.upsert(newActivation)();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0]).toEqual({
      ...newActivation,
      id: expectedDocumentId,
      version: 1,
    });
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right.fiscalCode).toEqual(newActivation.fiscalCode);
      expect(result.right.serviceId).toEqual(newActivation.serviceId);
      expect(result.right.version).toEqual(1);
      expect(result.right.id).toEqual(expectedDocumentId);
    }
  });
});
