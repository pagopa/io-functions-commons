import * as E from "fp-ts/lib/Either";
import * as t from "io-ts";
import { flow } from "fp-ts/lib/function";

import { TableClient, odata } from "@azure/data-tables";
import { EmailString } from "@pagopa/ts-commons/lib/strings";

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
    E.chain(({ partitionKey: email, rowKey: fiscalCode }) =>
      ProfileEmail.decode({ email, fiscalCode })
    )
  ),
  ({ email, fiscalCode }) => ({
    partitionKey: email.toLowerCase(),
    rowKey: fiscalCode
  })
);

export class DataTableProfileEmailsRepository
  implements IProfileEmailReader, IProfileEmailWriter {
  constructor(private readonly tableClient: TableClient) {}

  public async get(p: ProfileEmail): Promise<ProfileEmail> {
    try {
      const entity = await this.tableClient.getEntity(
        p.email.toLowerCase(),
        p.fiscalCode
      );
      const profileEmail = ProfileEmailToTableEntity.decode(entity);
      if (E.isLeft(profileEmail)) {
        throw new Error(`can't parse a profile email from the given entity`, {
          cause: "parsing"
        });
      }
      return profileEmail.right;
    } catch {
      throw new Error(
        `unable to get a profile entity from ${this.tableClient.tableName} table`
      );
    }
  }

  // Generates an AsyncIterable<ProfileEmail>
  public async *list(filter: EmailString): AsyncIterableIterator<ProfileEmail> {
    const queryOptions = {
      filter: odata`PartitionKey eq ${filter.toLowerCase()}`
    };
    const list = this.tableClient.listEntities({
      queryOptions
    });
    try {
      for await (const item of list) {
        const profileEmail = ProfileEmailToTableEntity.decode(item);
        if (E.isLeft(profileEmail)) {
          throw new Error(`can't parse a profile email from the given entity`, {
            cause: "parsing"
          });
        }
        yield profileEmail.right;
      }
    } catch (e) {
      if (e instanceof Error && e.cause === "parsing") {
        throw e;
      }
      throw new Error(
        `unable to get entities from ${this.tableClient.tableName} table`
      );
    }
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
