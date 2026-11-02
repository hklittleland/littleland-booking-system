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

test("room lock aliases map to staff actions and ROOM_LOCK_CONFLICT is marked as conflict", async () => {
  const bodies = [];
  const api = createClient(async (_url, options) => { bodies.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ success: true, data: {} }) }; });
  await api.request("roomLockCreate", { idempotencyKey: "create-1", data: { roomId: "S1", startDate: "2025-06-01", endDate: "2025-06-02", reason: "repair" } }, "token");
  await api.request("roomLockRelease", { idempotencyKey: "release-1", data: { roomLockId: "L1", releaseReason: "員工於月曆手動解除" }, expectedRecordVersion: 4 }, "token");
  assert.equal(bodies[0].action, "staff.roomLockCreate");
  assert.deepEqual(bodies[0].data, { roomId: "S1", startDate: "2025-06-01", endDate: "2025-06-02", reason: "repair" });
  assert.equal(bodies[1].action, "staff.roomLockRelease");
  assert.equal(bodies[1].expectedRecordVersion, 4);
  assert.equal(bodies[1].data.releaseReason, "員工於月曆手動解除");
  const conflictApi = createClient(async () => ({ ok: false, json: async () => ({ success: false, code: "ROOM_LOCK_CONFLICT", message: "locked" }) }));
  await assert.rejects(conflictApi.request("roomLockCreate", {}), (error) => error.code === "ROOM_LOCK_CONFLICT" && error.conflict === true);
});
