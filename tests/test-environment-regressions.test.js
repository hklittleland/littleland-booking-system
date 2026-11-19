"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const Form = require("../test/staff/new-booking-form.js");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const CHECKIN = ["14:30–15:00", "15:00–15:30", "15:30–16:00", "16:00–16:30", "17:45–18:15"];
const CHECKOUT = ["14:30–15:00", "15:30–16:00", "16:00–16:30", "17:45–18:15"];
const HEALTH_FIELDS = [
  ["vetVisit", "vetDetails"],
  ["infectiousDisease", "infectiousDetails"],
  ["chronicDisease", "chronicDetails"],
  ["medication", "medicationDetails"],
];

function rabbitDraft(overrides = {}) {
  return {
    checkin: "2026-11-20",
    checkout: "2026-11-21",
    checkinTime: CHECKIN[1],
    checkoutTime: CHECKOUT[2],
    species: "rabbit",
    roomId: "DELUXE_ROOM",
    quantity: 1,
    pets: [{
      name: "QA Pet",
      breed: "Mini Rex",
      ageValue: 12,
      ageUnit: "month",
      sex: "male",
      sterilized: "no",
      recentSurgery: "no",
      vetVisit: "no",
      vetDetails: "",
      infectiousDisease: "no",
      infectiousDetails: "",
      chronicDisease: "no",
      chronicDetails: "",
      medication: "no",
      medicationDetails: "",
      specialCare: "",
      fleaTreatment: "no",
    }],
    parentName: "Synthetic QA",
    phone: "12345678",
    email: "qa@example.invalid",
    emergency1: "Synthetic contact 1",
    emergency2: "Synthetic contact 2",
    vet: "",
    foodMain: "",
    hay: "",
    feeding: "",
    vegetables: "",
    groomingOnce: false,
    groomingDaily: false,
    medicine: "none",
    earlyCheckin: false,
    lateCheckout: false,
    terms: Array(6).fill(true),
    ...overrides,
  };
}

test("TEST Staff and guest forms expose the exact separate time windows", () => {
  assert.deepEqual(Form.CHECKIN_TIME_SLOTS, CHECKIN);
  assert.deepEqual(Form.CHECKOUT_TIME_SLOTS, CHECKOUT);
  const guest = read("test/booking/booking.js");
  for (const slot of CHECKIN) assert.ok(guest.includes(slot), `guest form missing ${slot}`);
  assert.match(guest, /CHECKIN_TIME_SLOTS = Object\.freeze\(\['14:30–15:00', '15:00–15:30', '15:30–16:00', '16:00–16:30', '17:45–18:15'\]\)/);
  assert.match(guest, /CHECKOUT_TIME_SLOTS = Object\.freeze\(\['14:30–15:00', '15:30–16:00', '16:00–16:30', '17:45–18:15'\]\)/);
});

test("Staff accepts past check-in dates but requires a valid date range and manual review", () => {
  const past = rabbitDraft({ checkin: "2026-11-18", checkout: "2026-11-20" });
  assert.equal(Form.validateAvailabilityInput(past, "2026-11-19"), null);
  assert.equal(Form.validateDraft(past, { today: "2026-11-19" }), null);
  assert.match(Form.validateDraft(rabbitDraft({ checkin: "2026-11-20", checkout: "2026-11-20" }), { today: "2026-11-19" }), /退房日期/);
  const view = read("test/staff/new-booking-view.js");
  assert.doesNotMatch(view, /min="\$\{Form\.hongKongToday\(\)\}"/);
  const guard = view.indexOf('if (draft.checkin < Form.hongKongToday())');
  const manualState = view.indexOf('status: "MANUAL_REVIEW"', guard);
  const manualReturn = view.indexOf("return false;", manualState);
  const apiRequest = view.indexOf('context.api.request("availability"', manualReturn);
  assert.ok(guard >= 0 && manualState > guard && manualReturn > manualState && apiRequest > manualReturn);
  assert.match(view, /入住日期已過去，系統不會查詢即時房態或分配房間/);
  assert.match(view, /入住日期已過去.*確定繼續/);
});

test("Staff may leave health narratives blank while positive answers remain flagged for review", () => {
  for (const [answer, details] of HEALTH_FIELDS) {
    const pet = { ...rabbitDraft().pets[0], [answer]: "yes", [details]: "" };
    assert.equal(Form.validateDraft(rabbitDraft({ pets: [pet] }), { today: "2026-11-19" }), null, `${answer} should not require narrative`);
  }
  const view = read("test/staff/new-booking-view.js");
  assert.match(view, /原因可留空，建立後仍由員工跟進/);
  assert.match(view, /選填；如有資料可補充/);
  assert.doesNotMatch(view, /回答是時必填/);
  assert.match(view, /needsReview = details\.some\(\(\[key\]\) => pet\[key\] === "yes"\)/);
  const changes = read("test/staff/booking-changes-view.js");
  assert.match(changes, /詳情（選填；如有資料可補充）/);
  assert.match(changes, /input\.required = false/);
});

test("Booking Detail available actions render before booking data", () => {
  const app = read("test/staff/app.js");
  const detailStart = app.indexOf('return `${head("Booking Detail", idOf(b))}');
  const actionInsertion = app.indexOf("${actionsMarkup}", detailStart);
  const bookingData = app.indexOf('<h2>預約 ${esc(idOf(b))}', detailStart);
  assert.ok(detailStart >= 0 && actionInsertion > detailStart && actionInsertion < bookingData);
  assert.ok(app.includes("<h2>可用操作</h2>"));
});

test("Staff edit form allows blank health narratives but still submits through the authenticated mutation", () => {
  const app = read("test/staff/app.js");
  assert.equal(app.includes("validatePetHealthDetails(data.pets)"), false);
  const confirm = app.indexOf('if (!confirm("確認更新聯絡');
  const mutation = app.indexOf('mutate("edit", StaffRouter.current().id', confirm);
  assert.ok(confirm >= 0 && mutation > confirm);
});
