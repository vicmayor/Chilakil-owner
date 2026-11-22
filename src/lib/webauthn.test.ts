import test from "node:test";
import assert from "node:assert/strict";
import { relyingPartyFromRequest } from "./webauthn";

function request(url: string, headers: Record<string, string>) {
  return new Request(url, { headers });
}

test("production host is its own RP ID", () => {
  const party = relyingPartyFromRequest(
    request("https://chilakil-owner.vercel.app/api/passkey/login/options", {
      host: "chilakil-owner.vercel.app",
      "x-forwarded-proto": "https",
    }),
  );
  assert.equal(party.rpID, "chilakil-owner.vercel.app");
  assert.equal(party.origin, "https://chilakil-owner.vercel.app");
});

test("a Vercel preview uses that preview hostname", () => {
  const party = relyingPartyFromRequest(
    request("https://internal.example/api/passkey/login/options", {
      "x-forwarded-host": "chilakil-owner-git-cursor-redesign.vercel.app",
      "x-forwarded-proto": "https",
    }),
  );
  assert.equal(party.rpID, "chilakil-owner-git-cursor-redesign.vercel.app");
  assert.equal(party.origin, "https://chilakil-owner-git-cursor-redesign.vercel.app");
});

test("localhost keeps the port on the origin and uses RP ID localhost", () => {
  const party = relyingPartyFromRequest(
    request("http://localhost:3000/login", { host: "localhost:3000" }),
  );
  assert.equal(party.rpID, "localhost");
  assert.equal(party.origin, "http://localhost:3000");

  const loopback = relyingPartyFromRequest(
    request("http://127.0.0.1:3000/login", { host: "127.0.0.1:3000" }),
  );
  assert.equal(loopback.rpID, "localhost");
  assert.equal(loopback.origin, "http://127.0.0.1:3000");
});

test("WEBAUTHN_RP_ID applies only when it is the host or a parent", () => {
  const previous = process.env.WEBAUTHN_RP_ID;
  process.env.WEBAUTHN_RP_ID = "chilakil-owner.vercel.app";
  try {
    const preview = relyingPartyFromRequest(
      request("https://internal.example/login", {
        "x-forwarded-host": "chilakil-owner-git-cursor.vercel.app",
        "x-forwarded-proto": "https",
      }),
    );
    assert.equal(preview.rpID, "chilakil-owner-git-cursor.vercel.app");

    const production = relyingPartyFromRequest(
      request("https://chilakil-owner.vercel.app/login", {
        host: "chilakil-owner.vercel.app",
        "x-forwarded-proto": "https",
      }),
    );
    assert.equal(production.rpID, "chilakil-owner.vercel.app");
  } finally {
    if (previous === undefined) delete process.env.WEBAUTHN_RP_ID;
    else process.env.WEBAUTHN_RP_ID = previous;
  }
});
