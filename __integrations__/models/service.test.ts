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
import { fromOption } from "fp-ts/lib/Either";
import { toString } from "fp-ts/lib/function";

const aService: Service = Service.decode({
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
}).getOrElseL(() => {
  throw new Error("Cannot decode service payload.");
});

describe("Models |> Service", () => {
  it("should save documents with correct versioning", async () => {
    const context = await createContext(SERVICE_MODEL_PK_FIELD);
    await context.init();
    const model = new ServiceModel(context.container);

    const newDoc = {
      kind: "INewService" as const,
      ...aService
    };

    // create a new document
    const created = await model
      .create(newDoc)
      .fold(
        _ => fail(`Failed to create doc, error: ${toString(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aService,
              version: 0
            })
          );
          return result;
        }
      )
      .run();

    // update document
    const updates = { serviceName: "anUpdatedServiceName" as NonEmptyString };
    await model
      .update({ ...created, ...updates })
      .fold(
        _ => fail(`Failed to update doc, error: ${toString(_)}`),
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
      .run();

    // read latest version of the document
    await taskEither
      .of<any, void>(void 0)
      .chain(_ =>
        model.findLastVersionByModelId([newDoc[SERVICE_MODEL_ID_FIELD]])
      )
      .chain(_ => fromEither(fromOption("It's none")(_)))
      .fold(
        _ => fail(`Failed to read doc, error: ${toString(_)}`),
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
      .run();

    // upsert new version
    const upserts = {
      serviceName: "anotherUpdatedServiceName" as NonEmptyString
    };
    const toUpsert = {
      kind: "INewService" as const,
      ...aService,
      ...upserts
    };
    await model
      .upsert(toUpsert)
      .fold(
        _ => fail(`Failed to upsert doc, error: ${toString(_)}`),
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
      .run();

    context.dispose();
  });
});
