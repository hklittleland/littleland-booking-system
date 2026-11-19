"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRuntime } = require("./harness");

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

test("server rejects a past check-in date using Hong Kong date and accepts today", () => {
  const now = new Date("2026-11-19T03:00:00.000Z");
  assert.throws(
    () => context.littlelandValidateDateRange_("2026-11-18", "2026-11-20", now),
    (error) => error && error.code === "DATE_CHECKIN_IN_PAST",
  );
  assert.doesNotThrow(() => context.littlelandValidateDateRange_("2026-11-19", "2026-11-20", now));
});

test("server rejects every positive health answer without its matching details, and accepts supplied details", () => {
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
  }
});
