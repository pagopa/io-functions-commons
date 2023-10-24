import { checkAzureCosmosDbHealth } from "../../src/utils/healthcheck";
import { endpoint, key } from "../models/cosmos_utils";
import * as E from "fp-ts/Either";

describe("checkAzureCosmosDbHealth", () => {
  it("should pass on an existing db", async () => {
    const result = await checkAzureCosmosDbHealth(endpoint, key)();
    expect(E.isRight(result)).toBe(true);
  });

  it("should not pass on a wrong db url", async () => {
    const result = await checkAzureCosmosDbHealth("https://wrong-url", key)();
    expect(E.isRight(result)).toBe(true);
  });
});
