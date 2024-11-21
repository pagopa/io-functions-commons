import * as t from "io-ts";

export const TableEntityAzureDataTables = t.type({
  partitionKey: t.string,
  rowKey: t.string
});

export type TableEntityAzureDataTables = t.TypeOf<
  typeof TableEntityAzureDataTables
>;
