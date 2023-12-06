import * as E from "fp-ts/lib/Either";
import * as t from "io-ts";
import { flow } from "fp-ts/lib/function";

import { TableClient, odata, TableEntityResult } from "@azure/data-tables";
import { EmailString, FiscalCode } from "@pagopa/ts-commons/lib/strings";

import {
  ProfileEmail,
  IProfileEmailReader,
  IProfileEmailWriter
} from "./index";

const TableEntity = t.type({
  partitionKey: t.string,
  rowKey: t.string
});

type TableEntity = t.TypeOf<typeof TableEntity>;

const ProfileEmailToTableEntity = new t.Type<ProfileEmail, TableEntity>(
  "TableEntityFromProfileEmail",
  ProfileEmail.is,
  flow(
    TableEntity.decode,
    E.map(({ partitionKey: email, rowKey: fiscalCode }) => ({
      email,
      fiscalCode
    })),
    ProfileEmail.decode
  ),
  ({ email, fiscalCode }) => ({
    partitionKey: email.toLowerCase(),
    rowKey: fiscalCode
  })
);

// Generates AsyncIterable<ProfileEmail> from AsyncIterable<TableEntityResult>
export async function* toProfileEmailsAsyncIterator(
  iterator: AsyncIterableIterator<TableEntityResult<unknown>>
): AsyncIterableIterator<ProfileEmail> {
  for await (const item of iterator) {
    const profileEmail = ProfileEmailToTableEntity.decode(item);
    if (E.isLeft(profileEmail)) {
      throw new Error(`can't parse a profile email from the given entity`);
    }
    yield profileEmail.right;
  }
}

export class DataTableProfileEmailsRepository
  implements IProfileEmailReader, IProfileEmailWriter {
  constructor(private readonly tableClient: TableClient) {}

  // Generates an AsyncIterable<ProfileEmail>
  /* eslint-disable require-yield */
  public async *list(
    filter: EmailString | FiscalCode
  ): AsyncIterableIterator<ProfileEmail> {
    const queryOptions = {
      filter: EmailString.is(filter)
        ? odata`partitionKey eq ${filter.toLowerCase()}`
        : odata`rowKey eq ${filter}`
    };
    return toProfileEmailsAsyncIterator(
      this.tableClient.listEntities({
        queryOptions
      })
    );
  }

  public async insert(p: ProfileEmail): Promise<void> {
    try {
      const entity = ProfileEmailToTableEntity.encode(p);
      await this.tableClient.createEntity(entity);
    } catch {
      throw new Error(
        `unable to insert a new profile entity into ${this.tableClient.tableName} table`
      );
    }
  }

  public async delete(p: ProfileEmail): Promise<void> {
    try {
      const entity = ProfileEmailToTableEntity.encode(p);
      await this.tableClient.deleteEntity(entity.partitionKey, entity.rowKey);
    } catch {
      throw new Error(
        `unable to delete the specified entity from ${this.tableClient.tableName} table`
      );
    }
  }
}
