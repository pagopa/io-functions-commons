import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { MessageBodyMarkdown } from "../../../generated/definitions/MessageBodyMarkdown";
import { MessageContent } from "../../../generated/definitions/MessageContent";
import { MessageSubject } from "../../../generated/definitions/MessageSubject";
import { ServiceId } from "../../../generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "../../../generated/definitions/TimeToLiveSeconds";
import {
  NewMessageWithContent,
  RetrievedMessageWithContent
} from "../../models/message";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as P from "../paging";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { CosmosErrors, toCosmosErrorResponse } from "../cosmosdb_model";
import { pipe } from "fp-ts/lib/function";
import {
  filterAsyncIterator,
  flattenAsyncIterator,
  mapAsyncIterator
} from "../async";
import { Validation } from "io-ts";

const aMessageBodyMarkdown = "test".repeat(80) as MessageBodyMarkdown;

const aMessageContent: MessageContent = {
  markdown: aMessageBodyMarkdown,
  subject: "test".repeat(10) as MessageSubject
};

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;

const aSerializedNewMessageWithContent = {
  content: aMessageContent,
  createdAt: new Date().toISOString(),
  fiscalCode: aFiscalCode,
  id: "A_MESSAGE_ID" as NonEmptyString,
  indexedId: "A_MESSAGE_ID" as NonEmptyString,
  senderServiceId: "agid" as ServiceId,
  senderUserId: "u123" as NonEmptyString,
  timeToLiveSeconds: 3600 as TimeToLiveSeconds
};

const aNewMessageWithContent: NewMessageWithContent = {
  ...aSerializedNewMessageWithContent,
  createdAt: new Date(),
  kind: "INewMessageWithContent"
};

const aRetrievedMessageWithContent: RetrievedMessageWithContent = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1,
  ...aNewMessageWithContent,
  kind: "IRetrievedMessageWithContent"
};

const with8ZeroPadding = (n: number): NonEmptyString =>
  n.toString().padStart(8, "0") as NonEmptyString;

const withId = (
  msg: RetrievedMessageWithContent,
  n: number,
  isPending: boolean
): RetrievedMessageWithContent => ({
  ...msg,
  id: `${with8ZeroPadding(n)}` as NonEmptyString,
  indexedId: `${with8ZeroPadding(n)}` as NonEmptyString,
  isPending
});

const pagedDescendingOrderMessagesList = (
  numberOfPages: number,
  pageSize: number,
  aPendingMessageEvery: number
) => {
  const totalMessages = numberOfPages * pageSize;
  let counter = 0;
  return [...Array(numberOfPages).keys()].map(n => {
    return [...Array(pageSize).keys()].map(m => {
      const numericId = totalMessages - counter;
      const message = withId(
        aRetrievedMessageWithContent,
        numericId,
        numericId % aPendingMessageEvery == 0
      );
      counter = counter + 1;
      return E.right(message);
    });
  });
};

const iteratorGenMock = async function*<T>(arr: T[]) {
  for (let a of arr) yield a;
};

describe("Paging", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should fill a page from a filtered async iterator", async () => {
    const pages = 10 as NonNegativeInteger;
    const pageSize = 10 as NonNegativeInteger;
    const aPendingMessageEvery = 5;

    // create a fake query result that comprehend some pending messages
    const pagedMessages = pagedDescendingOrderMessagesList(
      pages,
      pageSize,
      aPendingMessageEvery
    );

    // check that there are pending messages that will be filtered
    pagedMessages.map(page =>
      page.map(messageValidation => {
        if (E.isRight(messageValidation)) {
          const message = messageValidation.right;
          const numericId = parseInt(message.id);
          expect(message.isPending == true).toBe(
            numericId % aPendingMessageEvery == 0
          );
        }
      })
    );

    // get an iterator over the paged messages
    const iteratorMock = iteratorGenMock(pagedMessages);

    // process the paged iterator results to get a flattened and filtered async iterator
    const asyncIteratorMock = await pipe(
      TE.tryCatch(
        async () => iteratorMock[Symbol.asyncIterator](),
        toCosmosErrorResponse
      ),
      TE.map(flattenAsyncIterator),
      TE.map(_ => filterAsyncIterator(_, E.isRight)),
      TE.map(_ => mapAsyncIterator(_, e => e.right)),
      TE.map(_ => filterAsyncIterator(_, m => m.isPending == false)),
      TE.getOrElseW<
        CosmosErrors,
        AsyncIterator<ReadonlyArray<Validation<RetrievedMessageWithContent>>>
      >(_ => {
        throw new Error("Error");
      })
    )();

    const aPage = await P.fillPage(asyncIteratorMock, pageSize);

    expect(P.PageResults.is(aPage)).toBe(true);
    expect(aPage.values).toEqual(expect.any(Array));
    expect(aPage.values.length).toEqual(pageSize);
    // check that there are not pending messages
    aPage.values.map(pageResult => {
      const message = pageResult as RetrievedMessageWithContent;
      expect(message.isPending).toBe(false);
    });
  });
});
