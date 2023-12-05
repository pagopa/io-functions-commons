import * as E from "fp-ts/lib/Either";
import * as t from "io-ts";

import { TableClient, odata, TableEntityResult } from "@azure/data-tables";
import { EmailString } from "@pagopa/ts-commons/lib/strings";

import { ProfileEmail, ProfileEmailReader, ProfileEmailWriter } from "./index";

// Generates AsyncIterable<ProfileEmail> from AsyncIterable<TableEntityResult>
export async function* toProfileEmailsAsyncIterator(
  iterator: AsyncIterableIterator<TableEntityResult<unknown>>
): AsyncIterableIterator<ProfileEmail> {
  for await (const item of iterator) {
    const profileEmail = ProfileEmail.decode({
      email: item.partitionKey,
      fiscalCode: item.rowKey
    });
    if (E.isRight(profileEmail)) {
      yield profileEmail.right;
    }
  }
}

const TableEntity = t.type({
  partitionKey: t.string,
  rowKey: t.string
});

type TableEntity = t.TypeOf<typeof TableEntity>;

const ProfileEmailToTableEntity = new t.Type<ProfileEmail, TableEntity>(
  "TableEntityFromProfileEmail",
  ProfileEmail.is,
  ProfileEmail.decode,
  ({ email, fiscalCode }) => ({
    partitionKey: email.toLowerCase(),
    rowKey: fiscalCode
  })
);

export class DataTableProfileEmailsRepository
  implements ProfileEmailReader, ProfileEmailWriter {
  constructor(private tableClient: TableClient) {}

  // Generates an AsyncIterable<ProfileEmail>
  async *profileEmails(email: EmailString) {
    return toProfileEmailsAsyncIterator(
      this.tableClient.listEntities({
        queryOptions: {
          filter: odata`partitionKey eq ${email.toLowerCase()}`
        }
      })
    );
  }

  async insert(p: ProfileEmail) {
    try {
      const entity = ProfileEmailToTableEntity.encode(p);
      await this.tableClient.createEntity(entity);
    } catch (cause) {
      throw new Error("error inserting ProfileEmail into table storage", {
        cause
      });
    }
  }

  async delete(p: ProfileEmail) {
    try {
      const entity = ProfileEmailToTableEntity.encode(p);
      await this.tableClient.deleteEntity(entity.partitionKey, entity.rowKey);
    } catch (cause) {
      throw new Error("error deleting ProfileEmail from table storage", {
        cause
      });
    }
  }
}
