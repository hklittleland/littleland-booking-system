const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const Form = require("../staff/new-booking-form.js");

const staffOptions = Object.freeze({
  today: "2026-11-27",
  allowPastDates: true,
  allowBlankHealthDetails: true,
});

function validDraft(overrides = {}) {
  const room = Form.roomOptions("rabbit")[0];
  return {
    checkin: "2027-01-19",
    checkout: "2027-01-20",
    checkinTime: Form.TIME_SLOTS[0],
    checkoutTime: Form.TIME_SLOTS[1],
    species: "rabbit",
    roomId: room.id,
    quantity: 1,
    parentName: "Synthetic QA",
    phone: "12345678",
    email: "qa@example.invalid",
    emergency1: "QA contact 1",
    emergency2: "QA contact 2",
    foodMain: "",
    hay: "",
    feeding: "",
    vegetables: "",
    groomingOnce: false,
    groomingDaily: false,
    medicine: "none",
    earlyCheckin: false,
    lateCheckout: false,
    terms: Form.TERMS.map(() => true),
    pets: [{
      name: "Synthetic pet",
      breed: "Mixed",
      ageValue: 1,
      ageUnit: "year",
      sex: "male",
      sterilized: "yes",
      fleaTreatment: "yes",
      recentSurgery: "no",
      vetVisit: "yes",
      vetDetails: "",
      infectiousDisease: "no",
      infectiousDetails: "",
      chronicDisease: "no",
      chronicDetails: "",
      medication: "no",
      medicationDetails: "",
      specialCare: "",
    }],
    ...overrides,
  };
}

test("Staff form permits a past stay date only when staff options are supplied", () => {
  const draft = validDraft({ checkin: "2026-11-20", checkout: "2026-11-22" });
  assert.match(Form.validateAvailabilityInput(draft, staffOptions.today), /不可早於/);
  assert.equal(Form.validateAvailabilityInput(draft, staffOptions.today, staffOptions), null);
  assert.match(Form.validateDraft(draft, { today: staffOptions.today }), /不可早於/);
  assert.equal(Form.validateDraft(draft, staffOptions), null);
});

test("Staff form permits blank health details but Guest/default form remains strict", () => {
  const draft = validDraft();
  assert.match(Form.validateDraft(draft), /補充最近看獸醫詳情/);
  assert.equal(Form.validateDraft(draft, staffOptions), null);
  assert.equal(Form.buildRequest(draft, "staff-test-key", undefined, staffOptions).form.pets[0].vetDetails, "");
  assert.throws(() => Form.buildRequest(draft, "guest-test-key"), /補充最近看獸醫詳情/);
});

test("Apps Script date and pet validators default to strict Guest rules and allow explicit Staff options", () => {
  const context = {
    littlelandRequire_(condition, code, message) {
      if (!condition) {
        const error = new Error(message);
        error.code = code;
        throw error;
      }
    },
    littlelandTrimString_(value) { return String(value == null ? "" : value).trim(); },
    littlelandParsePositiveNumber_(value) {
      const number = Number(value);
      return Number.isFinite(number) && number > 0 ? number : null;
    },
    littlelandRequireYesNo_(value, message) {
      if (value === "yes" || value === "no") return value;
      throw new Error(message);
    },
    littlelandApiError_(code, message) {
      const error = new Error(message);
      error.code = code;
      return error;
    },
    littlelandPetNeedsHealthReview_(pet) {
      return ["vetVisit", "infectiousDisease", "chronicDisease", "medication"].some((key) => pet[key] === "yes");
    },
    LittleLandPricing: { ROOM_CATALOG: { rabbit: {} } },
  };
  const source = fs.readFileSync(path.join(__dirname, "../apps-script-prod/BookingValidation.gs"), "utf8");
  vm.runInNewContext(source, context, { filename: "BookingValidation.gs" });

  const today = new Date("2026-11-27T04:00:00.000Z");
  assert.throws(() => context.littlelandValidateDateRange_("2026-11-20", "2026-11-22", today), /不可早於/);
  assert.doesNotThrow(() => context.littlelandValidateDateRange_("2026-11-20", "2026-11-22", today, true));

  const pet = {
    name: "Synthetic pet", breed: "Mixed", ageValue: 1, ageUnit: "year", sex: "male",
    sterilized: "yes", fleaTreatment: "yes", recentSurgery: "no",
    vetVisit: "yes", vetDetails: "", infectiousDisease: "no", infectiousDetails: "",
    chronicDisease: "no", chronicDetails: "", medication: "no", medicationDetails: "",
  };
  assert.throws(() => context.littlelandNormalizePet_(pet, "rabbit", 1), /請補充最近看獸醫詳情/);
  assert.equal(context.littlelandNormalizePet_(pet, "rabbit", 1, { allowBlankHealthDetails: true }).vetDetails, "");

  const bookingApi = fs.readFileSync(path.join(__dirname, "../apps-script-prod/BookingApi.gs"), "utf8");
  const staffOperations = fs.readFileSync(path.join(__dirname, "../apps-script-prod/StaffOperations.gs"), "utf8");
  assert.match(bookingApi, /littlelandValidateBookingRequest_\(request\);/);
  assert.match(staffOperations, /littlelandValidateBookingRequest_\(request,\s*\{allowPastDates:true,allowBlankHealthDetails:true\}\)/);
});
