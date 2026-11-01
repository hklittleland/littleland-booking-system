"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("StaffRouter supports V3 schedule and new-booking routes while preserving full IDs", () => {
  const window = {}, location = { hash: "#/schedule" };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../staff/router.js"), "utf8"), { window, location });
  assert.equal(window.StaffRouter.current().page, "schedule");
  location.hash = "#/new-booking";
  assert.equal(window.StaffRouter.current().page, "new-booking");
  window.StaffRouter.go("detail", "TEST-LL-20261101-ABC12345");
  assert.equal(location.hash, "#/detail/TEST-LL-20261101-ABC12345");
});

test("Staff API exposes the approved V3 action aliases and preserves legacy actions", () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../staff/api-client.js"), "utf8"), { window, fetch: async () => { throw new Error("not called"); } });
  const actions = window.StaffAPI.actions;
  for (const [alias, apiAction] of Object.entries({
    availability: "staff.availability", createBooking: "staff.createBooking", schedules: "staff.schedules",
    scheduleSave: "staff.scheduleSave", scheduleSwap: "staff.scheduleSwap", addSurcharge: "staff.surchargeAdd",
    reverseSurcharge: "staff.surchargeReverse", refundDeposit: "staff.depositRefund", earlyCheckout: "staff.earlyCheckout",
    petCountUpdate: "staff.petCountUpdate",
  })) assert.equal(actions[alias], apiAction);
  assert.equal(actions.confirmDeposit, "staff.confirmDeposit");
});
