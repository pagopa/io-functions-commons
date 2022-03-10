import { propertiesToArray } from "../record";

describe("propertiesToArray2", () => {
  it("no object input", async () => {
    const input = "string";
    const properties = propertiesToArray(input);
    expect(properties).toEqual([]);
  });

  it("flat object", async () => {
    const input = {
      flat1: "1",
      flat2: "2"
    };

    const properties = propertiesToArray(input);
    expect(properties).toEqual([
      { key: "flat1", value: "1" },
      { key: "flat2", value: "2" }
    ]);
  });
  it("single nested object", async () => {
    const input = {
      flat: "flat",
      nested: {
        nested1: "1",
        nested2: "2"
      }
    };

    const properties = propertiesToArray(input);
    expect(properties).toEqual([
      { key: "flat", value: "flat" },
      { key: "nested.nested1", value: "1" },
      { key: "nested.nested2", value: "2" }
    ]);
  });

  it("multi nested object", async () => {
    const input = {
      flat: "flat",
      nested1: {
        nested11: {
          nested111: "1",
          nested112: "2"
        }
      }
    };

    const properties = propertiesToArray(input);
    expect(properties).toEqual([
      { key: "flat", value: "flat" },
      { key: "nested1.nested11.nested111", value: "1" },
      { key: "nested1.nested11.nested112", value: "2" }
    ]);
  });
});
