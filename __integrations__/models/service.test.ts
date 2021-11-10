/* eslint-disable no-console */
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { fromEither, taskEither } from "fp-ts/lib/TaskEither";
import {
  Service,
  SERVICE_MODEL_PK_FIELD,
  ServiceModel,
  SERVICE_MODEL_ID_FIELD
} from "../../src/models/service";
import { createContext } from "./cosmos_utils";
import * as e from "fp-ts/lib/Either";
import * as te from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { ServiceScopeEnum } from "../../generated/definitions/ServiceScope";
import { CosmosdbModel } from "../../src/utils/cosmosdb_model";
import { generateVersionedModelId } from "../../src/utils/cosmosdb_model_versioned";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { StandardServiceCategoryEnum } from "../../generated/definitions/StandardServiceCategory";

const aService: Service = pipe(
  Service.decode({
    authorizedCIDRs: [],
    authorizedRecipients: [],
    departmentName: "Deparment Name",
    isVisible: true,
    maxAllowedPaymentAmount: 100000,
    organizationFiscalCode: "01234567890",
    organizationName: "Organization name",
    requireSecureChannels: false,
    serviceId: "aServiceId" as NonEmptyString,
    serviceName: "MyServiceName"
  }),
  e.getOrElseW(() => {
    throw new Error("Cannot decode service payload.");
  })
);

describe("Models |> Service", () => {
  it("should save documents with correct versioning", async () => {
    const context = createContext(SERVICE_MODEL_PK_FIELD);
    await context.init();
    const model = new ServiceModel(context.container);

    const newDoc = {
      kind: "INewService" as const,
      ...aService
    };

    // create a new document
    const created = await pipe(
      model.create(newDoc),
      te.bimap(
        _ => fail(`Failed to create doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aService,
              version: 0
            })
          );
          return result;
        }
      ),
      te.toUnion
    )();

    // update document
    const updates = { serviceName: "anUpdatedServiceName" as NonEmptyString };
    await pipe(
      model.update({ ...created, ...updates }),
      te.bimap(
        _ => fail(`Failed to update doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aService,
              ...updates,
              version: 1
            })
          );
        }
      )
    )();

    // read latest version of the document
    await pipe(
      taskEither.of<any, void>(void 0),
      te.chainW(_ =>
        model.findLastVersionByModelId([newDoc[SERVICE_MODEL_ID_FIELD]])
      ),
      te.chain(_ => fromEither(e.fromOption(() => "It's none")(_))),
      te.bimap(
        _ => fail(`Failed to read doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aService,
              ...updates,
              version: 1
            })
          );
        }
      )
    )();

    // upsert new version
    const upserts = {
      serviceName: "anotherUpdatedServiceName" as NonEmptyString
    };
    const toUpsert = {
      kind: "INewService" as const,
      ...aService,
      ...upserts
    };
    await pipe(
      model.upsert(toUpsert),
      te.bimap(
        _ => fail(`Failed to upsert doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aService,
              ...upserts,
              version: 2
            })
          );
        }
      )
    )();

    context.dispose();
  });

  it("should read documents with default category", async () => {
    const context = createContext(SERVICE_MODEL_PK_FIELD);
    await context.init();
    const model = new ServiceModel(context.container);

    const newDoc = {
      kind: "INewService" as const,
      ...aService,
      serviceMetadata: {
        scope: ServiceScopeEnum.LOCAL
      }
    };

    // Seed the database with a document without serviceMetadata category (backwards compatibility check)
    const retrievedService = await CosmosdbModel.prototype.create.call(model, {newDoc, id: generateVersionedModelId<Service, typeof SERVICE_MODEL_ID_FIELD>(newDoc.serviceId, 0 as NonNegativeInteger)})();
    expect(e.isRight(retrievedService)).toBeTruthy();

    // read latest version of the document
    await pipe(
      taskEither.of<any, void>(void 0),
      te.chainW(_ =>
        model.findLastVersionByModelId([newDoc[SERVICE_MODEL_ID_FIELD]])
      ),
      te.chain(_ => fromEither(e.fromOption(() => "It's none")(_))),
      te.bimap(
        _ => fail(`Failed to read doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aService,
              serviceMetadata: {
                ...aService.serviceMetadata,
                category: StandardServiceCategoryEnum.STANDARD
              },
              version: 0
            })
          );
        }
      )
    )();
  });
});
