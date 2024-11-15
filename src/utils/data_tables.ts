import * as t from "io-ts";

export const TableEntity = t.type({
  partitionKey: t.string,
  rowKey: t.string
});

export type TableEntity = t.TypeOf<typeof TableEntity>;
