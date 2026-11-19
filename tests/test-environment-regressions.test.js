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

test("past Staff check-in dates fail validation while Hong Kong today is allowed", () => {
  const availability = { checkin: "2026-11-18", checkout: "2026-11-20", species: "rabbit", roomId: "DELUXE_ROOM", quantity: 1 };
  assert.match(Form.validateAvailabilityInput(availability, "2026-11-19"), /不可早於香港今日日期/);
  assert.equal(Form.validateDraft(rabbitDraft({ checkin: "2026-11-18" }), { today: "2026-11-19" }), "入住日期不可早於香港今日日期。");
  assert.equal(Form.validateDraft(rabbitDraft({ checkin: "2026-11-19" }), { today: "2026-11-19" }), null);
  assert.match(read("test/staff/new-booking-view.js"), /min="\$\{Form\.hongKongToday\(\)\}"/);
});

test("each positive health answer requires its matching details field before Staff submit", () => {
  for (const [answer, details] of HEALTH_FIELDS) {
    const pet = { ...rabbitDraft().pets[0], [answer]: "yes", [details]: "" };
    const invalid = Form.validateDraft(rabbitDraft({ pets: [pet] }), { today: "2026-11-19" });
    assert.match(invalid, /請補充.*詳情/, `${answer} must require ${details}`);
    pet[details] = "Synthetic QA detail";
    assert.equal(Form.validateDraft(rabbitDraft({ pets: [pet] }), { today: "2026-11-19" }), null, `${details} should satisfy ${answer}`);
  }
});

test("Booking Detail available actions render before booking data", () => {
  const app = read("test/staff/app.js");
  const detailStart = app.indexOf('return `${head("Booking Detail", idOf(b))}');
  const actionInsertion = app.indexOf("${actionsMarkup}", detailStart);
  const bookingData = app.indexOf('<h2>預約 ${esc(idOf(b))}', detailStart);
  assert.ok(detailStart >= 0 && actionInsertion > detailStart && actionInsertion < bookingData);
  assert.ok(app.includes('<h2>可用操作</h2>'));
});

test("Staff edit form validates health details before confirmation or API mutation", () => {
  const app = read("test/staff/app.js");
  const guard = app.indexOf("validatePetHealthDetails(data.pets)");
  const confirm = app.indexOf('if (!confirm("確認更新聯絡', guard);
  const mutation = app.indexOf('mutate("edit", StaffRouter.current().id', confirm);
  assert.ok(guard >= 0 && confirm > guard && mutation > confirm);
});
