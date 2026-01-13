// eslint-disable sonar/no-hardcoded-credentials
import { right } from "fp-ts/lib/Either";

import { MailMultiTransportConnectionsFromString } from "../multi_transport_connection";

describe("parseMultiProviderConnection", () => {
  it("should parse valid connection strings", () => {
    expect(
      MailMultiTransportConnectionsFromString.decode("mailup:u1:p1"),
    ).toEqual(right([{ password: "p1", transport: "mailup", username: "u1" }]));
    expect(
      MailMultiTransportConnectionsFromString.decode(
        "mailup:u1:p1;mailup:u2:p2",
      ),
    ).toEqual(
      right([
        { password: "p1", transport: "mailup", username: "u1" },
        { password: "p2", transport: "mailup", username: "u2" },
      ]),
    );
    expect(
      MailMultiTransportConnectionsFromString.decode(
        "mailup:u1:p1;mailup:u2:p2;sendgrid:u3:p3",
      ),
    ).toEqual(
      right([
        { password: "p1", transport: "mailup", username: "u1" },
        { password: "p2", transport: "mailup", username: "u2" },
        { password: "p3", transport: "sendgrid", username: "u3" },
      ]),
    );
  });

  it("should skip invalid connection strings", () => {
    expect(
      MailMultiTransportConnectionsFromString.decode("mailup:u1:p1;"),
    ).toEqual(right([{ password: "p1", transport: "mailup", username: "u1" }]));
    expect(
      MailMultiTransportConnectionsFromString.decode(
        "mailup:u1:p1;;mailupx:u2:p2",
      ),
    ).toEqual(
      right([
        { password: "p1", transport: "mailup", username: "u1" },
        { password: "p2", transport: "mailupx", username: "u2" },
      ]),
    );
    expect(
      MailMultiTransportConnectionsFromString.decode(
        "mailup:u1:;:u2:p2;;sendgrid:u3:p3",
      ),
    ).toEqual(
      right([
        { password: "", transport: "mailup", username: "u1" },
        { password: "p3", transport: "sendgrid", username: "u3" },
      ]),
    );
  });
});
