import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import * as P from "../paging";
import { vi } from "vitest";

const anIdBasedModel = {
  id: "AAAAA" as NonEmptyString,
};

describe("Paging", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return a valid PageResult with next", async () => {
    const hasMoreResults = true;
    const pageOfIdBasedObjects = [
      anIdBasedModel,
      anIdBasedModel,
      anIdBasedModel,
      anIdBasedModel,
      anIdBasedModel,
    ];

    const results = P.toPageResults(pageOfIdBasedObjects, hasMoreResults);

    expect(results).toMatchObject({
      items: pageOfIdBasedObjects,
      next: pageOfIdBasedObjects[pageOfIdBasedObjects.length - 1].id,
      prev: pageOfIdBasedObjects[0].id,
    });
  });

  it("should return a valid PageResult without next", async () => {
    const hasMoreResults = false;
    const pageOfIdBasedObjects = [
      anIdBasedModel,
      anIdBasedModel,
      anIdBasedModel,
      anIdBasedModel,
      anIdBasedModel,
    ];

    const results = P.toPageResults(pageOfIdBasedObjects, hasMoreResults);

    expect(results).toMatchObject({
      items: pageOfIdBasedObjects,
      next: undefined,
      prev: pageOfIdBasedObjects[0].id,
    });
  });
});
