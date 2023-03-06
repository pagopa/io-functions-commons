/* eslint-disable no-console */
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { fromEither, taskEither } from "fp-ts/lib/TaskEither";
import {
  SubscriptionCIDRs,
  SUBSCRIPTION_CIDRS_MODEL_PK_FIELD,
  SubscriptionCIDRsModel
} from "../../src/models/subscription_cidrs";
import { createContext } from "./cosmos_utils";
import * as e from "fp-ts/lib/Either";
import * as te from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { toAuthorizedCIDRs } from "../../src/models/service";

const aSubscriptionCIDRs: SubscriptionCIDRs = pipe(
  SubscriptionCIDRs.decode({
    cidrs: [],
    subscriptionId: "aSubscriptionId" as NonEmptyString
  }),
  e.getOrElseW(() => {
    throw new Error("Cannot decode subscriptionCIDRs payload.");
  })
);

describe("Models |> SubscriptionCIDRs", () => {
  it("should save documents with correct versioning", async () => {
    const context = createContext(SUBSCRIPTION_CIDRS_MODEL_PK_FIELD);
    await context.init();
    const model = new SubscriptionCIDRsModel(context.container);

    const newDoc = {
      kind: "INewSubscriptionCIDRs" as const,
      ...aSubscriptionCIDRs
    };

    // create a new document
    const created = await pipe(
      model.create(newDoc),
      te.bimap(
        _ => fail(`Failed to create doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aSubscriptionCIDRs,
              version: 0
            })
          );
          return result;
        }
      ),
      te.toUnion
    )();

    // update document
    const updates = { cidrs: toAuthorizedCIDRs(["0.0.0.0"]) };
    await pipe(
      model.update({ ...created, ...updates }),
      te.bimap(
        _ => fail(`Failed to update doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aSubscriptionCIDRs,
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
        model.findLastVersionByModelId([
          newDoc[SUBSCRIPTION_CIDRS_MODEL_PK_FIELD]
        ])
      ),
      te.chain(_ => fromEither(e.fromOption(() => "It's none")(_))),
      te.bimap(
        _ => fail(`Failed to read doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aSubscriptionCIDRs,
              ...updates,
              version: 1
            })
          );
        }
      )
    )();

    // upsert new version
    const upserts = { cidrs: toAuthorizedCIDRs(["1.2.3.4"]) };
    const toUpsert = {
      kind: "INewSubscriptionCIDRs" as const,
      ...aSubscriptionCIDRs,
      ...upserts
    };
    await pipe(
      model.upsert(toUpsert),
      te.bimap(
        _ => fail(`Failed to upsert doc, error: ${JSON.stringify(_)}`),
        result => {
          expect(result).toEqual(
            expect.objectContaining({
              ...aSubscriptionCIDRs,
              ...upserts,
              version: 2
            })
          );
        }
      )
    )();

    context.dispose();
  });
});
