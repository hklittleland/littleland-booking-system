"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "staff", "api-client.js"),
  "utf8",
);

function createClient(fetchImpl) {
  const window = {};
  vm.runInNewContext(source, { window, fetch: fetchImpl });
  return window.StaffAPI;
}

test("staff.login does not retry after an uncertain network failure", async () => {
  let calls = 0;
  const api = createClient(async () => {
    calls += 1;
    throw new Error("synthetic socket reset");
  });

  await assert.rejects(
    api.request("login", {
      username: "synthetic-test-admin",
      password: "synthetic-only-password",
    }),
    (error) => error.message.includes("為避免建立重複 Session"),
  );
  assert.equal(calls, 1);
});

test("staff.login marks malformed JSON as uncertain without retrying", async () => {
  let calls = 0;
  const api = createClient(async () => {
    calls += 1;
    return { ok: true, json: async () => { throw new Error("invalid body"); } };
  });

  await assert.rejects(
    api.request("login", {
      username: "synthetic-test-admin",
      password: "synthetic-only-password",
    }),
    (error) => error.message.includes("為避免建立重複 Session"),
  );
  assert.equal(calls, 1);
});

test("idempotent staff mutation retries once with the same request payload", async () => {
  let calls = 0;
  const requestBodies = [];
  const api = createClient(async (_url, options) => {
    calls += 1;
    requestBodies.push(JSON.parse(options.body));
    if (calls === 1) throw new Error("synthetic socket reset");
    return {
      ok: true,
      json: async () => ({ success: true, data: { confirmed: true } }),
    };
  });

  const result = await api.request(
    "confirmDeposit",
    { bookingId: "TEST-STAFF-BOOKING", idempotencyKey: "deposit-test-0001" },
    "synthetic-session-token",
  );

  assert.deepEqual(result, { confirmed: true });
  assert.equal(calls, 2);
  assert.deepEqual(requestBodies[0], requestBodies[1]);
  assert.equal(requestBodies[0].idempotencyKey, "deposit-test-0001");
});
