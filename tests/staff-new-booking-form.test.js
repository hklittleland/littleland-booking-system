"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Form = require("../staff/new-booking-form.js");

const ROOT = path.resolve(__dirname, "..");
const TIMES = ["14:30–15:30", "15:30–16:30", "16:30–17:00"];

function rabbitDraft(overrides = {}) {
  return {
    checkin: "2026-12-04",
    checkout: "2026-12-05",
    checkinTime: TIMES[0],
    checkoutTime: TIMES[1],
    species: "rabbit",
    roomId: "DELUXE_ROOM",
    quantity: 1,
    pets: [{
      name: "Mochi",
      breed: "Mini Rex",
      ageValue: 1,
      ageUnit: "year",
      sex: "male",
      sterilized: "yes",
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
    parentName: "Fictional Parent",
    phone: "+852 9123 4567",
    email: "parent@example.test",
    emergency1: "Fictional Contact One 91234568",
    emergency2: "Fictional Contact Two 91234569",
    vet: "",
    foodMain: "Oxbow 成兔糧",
    hay: "Joy & Fibre 1st cut",
    feeding: "每日一次",
    vegetables: "否",
    groomingOnce: true,
    groomingDaily: false,
    medicine: "none",
    earlyCheckin: false,
    lateCheckout: false,
    terms: Array(6).fill(true),
    ...overrides,
  };
}

test("Staff form uses the accepted time slots and normalizes Hong Kong phone formats", () => {
  assert.deepEqual(Form.TIME_SLOTS, TIMES);
  assert.equal(Form.normalizePhone("+852 9123 4567"), "91234567");
  assert.equal(Form.normalizePhone("00852-9123-4567"), "91234567");
  assert.equal(Form.normalizePhone("91234567"), "91234567");
  assert.equal(Form.validateDraft(rabbitDraft(), { today: "2026-11-01" }), null);
  assert.match(Form.validateDraft(rabbitDraft({ checkinTime: "14:30" }), { today: "2026-11-01" }), /時段/);
});

test("Staff quote reuses canonical Pricing Engine and exact clientQuote fields", () => {
  const quote = Form.calculateQuote(rabbitDraft());
  assert.equal(quote.priceVersion, Form.PRICE_VERSION);
  assert.equal(quote.roomPrice, 178);
  assert.equal(quote.nights, 1);
  assert.equal(quote.baseRoomFee, 178);
  assert.equal(quote.weekendFee, 250);
  assert.equal(quote.serviceFees, 70);
  assert.equal(quote.estimatedTotal, 498);
  assert.equal(quote.depositAmount, 89);
  assert.equal(quote.remainingBalance, 409);
  assert.equal(quote.cashDeposit, 1000);
  assert.deepEqual(Object.keys(Form.clientQuote(quote)).sort(), [
    "baseRoomFee", "cashDeposit", "depositAmount", "estimatedTotal", "extraPetFee", "nights",
    "priceVersion", "remainingBalance", "roomPrice", "serviceFees", "totalSurcharges", "weekendFee",
  ].sort());
});

test("Staff payload exactly matches canonical validator contract and omits male pregnancy", () => {
  const request = Form.buildRequest(rabbitDraft(), "staff-idem-01");
  const validator = fs.readFileSync(path.join(ROOT, "apps-script/BookingValidation.gs"), "utf8");
  const version = validator.match(/var LITTLELAND_PRICE_VERSION\s*=\s*'([^']+)'/);
  assert.equal(version && version[1], Form.PRICE_VERSION);
  assert.deepEqual(Object.keys(request).sort(), ["clientQuote", "form", "idempotencyKey", "terms"]);
  assert.equal(request.form.phone, "91234567");
  assert.equal(request.form.checkinTime, TIMES[0]);
  assert.deepEqual(request.terms, Array(6).fill(true));
  assert.equal("pregnant" in request.form.pets[0], false);
  assert.equal("ageInMonths" in request.form.pets[0], false);
  assert.deepEqual(Object.keys(request.form).sort(), [
    "checkin", "checkout", "checkinTime", "checkoutTime", "species", "roomId", "quantity", "pets",
    "parentName", "phone", "email", "emergency1", "emergency2", "vet", "foodMain", "hay", "feeding",
    "vegetables", "groomingOnce", "groomingDaily", "medicine", "earlyCheckin", "lateCheckout",
  ].sort());
});

test("hamster payload excludes sterilization, pregnancy, flea, hay, feeding and vegetables", () => {
  const draft = rabbitDraft({
    species: "hamster",
    roomId: "HAMSTER_BOX",
    foodMain: "BUNNY 倉鼠糧",
    hay: "",
    feeding: "",
    vegetables: "",
    groomingOnce: false,
    pets: [{
      name: "Pip",
      breed: "Syrian hamster",
      ageValue: 2,
      ageUnit: "month",
      sex: "female",
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
    }],
  });
  assert.equal(Form.validateDraft(draft, { today: "2026-11-01" }), null);
  const request = Form.buildRequest(draft, "staff-idem-hamster");
  const pet = request.form.pets[0];
  for (const key of ["sterilized", "pregnant", "fleaTreatment", "ageInMonths"]) assert.equal(key in pet, false);
  assert.equal(request.form.hay, "");
  assert.equal(request.form.feeding, "");
  assert.equal(request.form.vegetables, "");
});

test("Staff form rejects invalid limits, dates, minimum ages, recent surgery, pregnancy and incomplete consent", () => {
  const today = "2026-11-01";
  assert.match(Form.validateDraft(rabbitDraft({ checkin: "2026-10-31" }), { today }), /早於/);
  assert.match(Form.validateDraft(rabbitDraft({ checkout: "2026-12-04" }), { today }), /退房日期/);
  assert.match(Form.validateDraft(rabbitDraft({ quantity: 2 }), { today }), /入住上限/);
  assert.match(Form.validateDraft(rabbitDraft({ pets: [{ ...rabbitDraft().pets[0], ageValue: 2, ageUnit: "month" }] }), { today }), /最低入住年齡/);
  assert.match(Form.validateDraft(rabbitDraft({ pets: [{ ...rabbitDraft().pets[0], recentSurgery: "yes" }] }), { today }), /手術/);
  assert.match(Form.validateDraft(rabbitDraft({ pets: [{ ...rabbitDraft().pets[0], sex: "female", pregnant: "yes" }] }), { today }), /懷孕/);
  assert.match(Form.validateDraft(rabbitDraft({ terms: [true, true, true, true, true, false] }), { today }), /六項同意/);
});

test("availability input exposes only date, species, room type and quantity", () => {
  assert.deepEqual(Form.availabilityInput(rabbitDraft()), {
    checkin: "2026-12-04",
    checkout: "2026-12-05",
    species: "rabbit",
    roomTypeId: "DELUXE_ROOM",
    quantity: 1,
  });
});
