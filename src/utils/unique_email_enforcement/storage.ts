import { TableClient, odata, TableEntityResult } from "@azure/data-tables";
import { EmailString } from "@pagopa/ts-commons/lib/strings";

import { ProfileEmail, ProfileEmailReader, ProfileEmailWriter } from "./index";

// Generates AsyncIterable<ProfileEmail> from AsyncIterable<TableEntityResult>
export async function* toProfileEmailsAsyncIterator(
  iterator: AsyncIterableIterator<TableEntityResult<unknown>>
): AsyncIterableIterator<ProfileEmail> {
  for await (const item of iterator) {
    const uniqueEmail = ProfileEmail.decode({
      email: item.partitionKey,
      fiscalCode: item.rowKey
    });
    if (uniqueEmail._tag === "Right") {
      yield uniqueEmail.right;
    }
  }
}

export class DataTableProfileEmailsRepository
  implements ProfileEmailReader, ProfileEmailWriter {
  constructor(private tableClient: TableClient) {}

  // Generates an AsyncIterable<ProfileEmail>
  async *profileEmails(email: EmailString) {
    return toProfileEmailsAsyncIterator(
      this.tableClient.listEntities({
        queryOptions: {
          filter: odata`partitionKey eq ${email}`
        }
      })
    );
  }

  async insert(p: ProfileEmail) {
    try {
      await this.tableClient.createEntity({
        partitionKey: p.email,
        rowKey: p.fiscalCode
      });
    } catch (cause) {
      throw new Error("error inserting ProfileEmail into table storage", {
        cause
      });
    }
  }

  async delete(p: ProfileEmail) {
    try {
      await this.tableClient.deleteEntity(p.email, p.fiscalCode);
    } catch (cause) {
      throw new Error("error deleting ProfileEmail from table storage", {
        cause
      });
    }
  }
}
