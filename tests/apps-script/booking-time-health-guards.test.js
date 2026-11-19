"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRuntime, makePayload } = require("./harness");

const context = createRuntime().context;
const CHECKIN = ["14:30–15:00", "15:00–15:30", "15:30–16:00", "16:00–16:30", "17:45–18:15"];
const CHECKOUT = ["14:30–15:00", "15:30–16:00", "16:00–16:30", "17:45–18:15"];
const HEALTH_FIELDS = [
  ["vetVisit", "vetDetails"],
  ["infectiousDisease", "infectiousDetails"],
  ["chronicDisease", "chronicDetails"],
  ["medication", "medicationDetails"],
];

function petFor(answer, details, detailsValue) {
  return {
    name: "Synthetic QA Pet",
    breed: "Test breed",
    ageValue: 12,
    ageUnit: "month",
    sex: "male",
    sterilized: "no",
    pregnant: "",
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
    [answer]: "yes",
    [details]: detailsValue,
  };
}

test("TEST Booking API accepts the five check-in windows and four checkout windows", () => {
  assert.deepEqual(Array.from(context.LITTLELAND_CHECKIN_TIMES), CHECKIN);
  assert.deepEqual(Array.from(context.LITTLELAND_CHECKOUT_TIMES), CHECKOUT);
});

test("Guest date validation rejects past check-in; Staff-only option permits it while preserving checkout order", () => {
  const now = new Date("2026-11-19T03:00:00.000Z");
  assert.throws(
    () => context.littlelandValidateDateRange_("2026-11-18", "2026-11-20", now),
    (error) => error && error.code === "DATE_CHECKIN_IN_PAST",
  );
  assert.doesNotThrow(() => context.littlelandValidateDateRange_("2026-11-19", "2026-11-20", now));
  assert.doesNotThrow(() => context.littlelandValidateDateRange_("2026-11-18", "2026-11-20", now, true));
  assert.throws(
    () => context.littlelandValidateDateRange_("2026-11-18", "2026-11-18", now, true),
    (error) => error && error.code === "DATE_CHECKOUT_NOT_AFTER_CHECKIN",
  );
});

test("Guest validation requires positive-answer details; Staff-only option allows blanks but keeps health review", () => {
  for (const [answer, details] of HEALTH_FIELDS) {
    const missing = petFor(answer, details, "");
    assert.throws(
      () => context.littlelandNormalizePet_(missing, "rabbit", 1),
      (error) => error && error.code === "VALIDATION_FAILED" && /詳情/.test(error.message),
      `${answer} must require ${details}`,
    );
    const complete = petFor(answer, details, "Synthetic QA detail");
    const normalized = context.littlelandNormalizePet_(complete, "rabbit", 1);
    assert.equal(normalized[answer], "yes");
    assert.equal(normalized[details], "Synthetic QA detail");
    assert.equal(normalized.healthReviewStatus, "HEALTH_REVIEW_REQUIRED");

    const staffOptional = context.littlelandNormalizePet_(missing, "rabbit", 1, { requireHealthDetails: false });
    assert.equal(staffOptional[answer], "yes");
    assert.equal(staffOptional[details], "");
    assert.equal(staffOptional.healthReviewStatus, "HEALTH_REVIEW_REQUIRED");
  }
});

test("Guest request defaults remain strict while an internal Staff validation option permits the two exceptions", () => {
  const runtime = createRuntime(), ctx = runtime.context;
  const past = makePayload(runtime, { checkin: "2000-01-01", checkout: "2000-01-03" });
  assert.throws(
    () => ctx.littlelandValidateBookingRequest_(past),
    (error) => error && error.code === "DATE_CHECKIN_IN_PAST",
  );
  assert.equal(ctx.littlelandValidateBookingRequest_(past, { allowPastCheckin: true }).form.checkin, "2000-01-01");

  const missingDetails = makePayload(runtime, { pets: [{ vetVisit: "yes", vetDetails: "" }] });
  assert.throws(
    () => ctx.littlelandValidateBookingRequest_(missingDetails),
    (error) => error && error.code === "VALIDATION_FAILED" && /詳情/.test(error.message),
  );
  const staffValidated = ctx.littlelandValidateBookingRequest_(missingDetails, { requireHealthDetails: false });
  assert.equal(staffValidated.healthReviewRequired, true);
  assert.equal(staffValidated.form.pets[0].vetDetails, "");
});
