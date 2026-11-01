"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const StaffEditFormUtils = require("../staff/edit-form-utils");

test("Staff form escapes attribute text without replacing empty values", () => {
  assert.equal(StaffEditFormUtils.escapeFormValue(""), "");
  assert.equal(StaffEditFormUtils.escapeFormValue(null), "");
  assert.equal(
    StaffEditFormUtils.escapeFormValue(`<tag a="b">&'`),
    "&lt;tag a=&quot;b&quot;&gt;&amp;&#39;",
  );
});

test("Staff edit selects round-trip stored yes/no and boolean values", () => {
  assert.equal(StaffEditFormUtils.toYesNoOption("sterilized", "yes", false), "yes");
  assert.equal(StaffEditFormUtils.toYesNoOption("vetVisit", "no", false), "no");
  assert.equal(StaffEditFormUtils.toYesNoOption("recentSurgery30Days", false, true), "no");
  assert.equal(StaffEditFormUtils.toYesNoOption("recentSurgery30Days", true, false), "yes");
  assert.equal(StaffEditFormUtils.toYesNoOption("pregnant", "", false), "no");
});

test("Staff edit preserves canonical Chinese vegetables values", () => {
  assert.equal(StaffEditFormUtils.toVegetablesOption("否"), "否");
  assert.equal(StaffEditFormUtils.toVegetablesOption("是"), "是");
  assert.equal(StaffEditFormUtils.toVegetablesOption("no"), "否");
  assert.equal(StaffEditFormUtils.toVegetablesOption("yes"), "是");
  assert.equal(StaffEditFormUtils.toVegetablesOption(""), "");
});

test("Staff edit maps recent-surgery UI field to API key and excludes derived fields", () => {
  const input = StaffEditFormUtils.createPetEditInput("pet-1", {
    name: "麻糬",
    breed: "侏儒兔",
    ageValue: "6",
    ageUnit: "month",
    sex: "male",
    sterilized: "no",
    recentSurgery30Days: "no",
    vetVisit: "no",
  });
  assert.deepEqual(input, {
    petId: "pet-1",
    name: "麻糬",
    breed: "侏儒兔",
    ageValue: "6",
    ageUnit: "month",
    sex: "male",
    sterilized: "no",
    recentSurgery: "no",
    vetVisit: "no",
  });
  assert.equal(Object.hasOwn(input, "recentSurgery30Days"), false);
  assert.equal(Object.hasOwn(input, "ageInMonths"), false);
  assert.throws(
    () => StaffEditFormUtils.createPetEditInput("pet-1", { ageInMonths: 6 }),
    /Unsupported pet edit field/,
  );
});

test("Staff edit omits stale pregnancy answers for male pets but preserves female answers", () => {
  const male = StaffEditFormUtils.createPetEditInput("pet-male", {
    sex: "male",
    pregnant: "no",
  });
  const uppercaseMale = StaffEditFormUtils.createPetEditInput("pet-male-2", {
    sex: " MALE ",
    pregnant: "yes",
  });
  const female = StaffEditFormUtils.createPetEditInput("pet-female", {
    sex: "female",
    pregnant: "no",
  });

  assert.equal(Object.hasOwn(male, "pregnant"), false);
  assert.equal(Object.hasOwn(uppercaseMale, "pregnant"), false);
  assert.equal(female.pregnant, "no");
});

test("Staff edit recognizes hamster species codes case-insensitively", () => {
  assert.equal(StaffEditFormUtils.isHamsterSpecies("hamster"), true);
  assert.equal(StaffEditFormUtils.isHamsterSpecies("HAMSTER"), true);
  assert.equal(StaffEditFormUtils.isHamsterSpecies("  Hamster  "), true);
  assert.equal(StaffEditFormUtils.isHamsterSpecies("rabbit"), false);
});

test("Staff hamster edit omits sterilization, pregnancy and flea fields from API payload", () => {
  const input = StaffEditFormUtils.createPetEditInput("hamster-1", {
    name: "奶茶",
    breed: "敘利亞倉鼠",
    ageValue: "3",
    ageUnit: "month",
    sex: "female",
    sterilized: "no",
    pregnant: "no",
    recentSurgery30Days: "no",
    vetVisit: "no",
    fleaTreatment: "no",
  }, "hamster");
  assert.equal(input.name, "奶茶");
  assert.equal(input.recentSurgery, "no");
  assert.equal(Object.hasOwn(input, "sterilized"), false);
  assert.equal(Object.hasOwn(input, "pregnant"), false);
  assert.equal(Object.hasOwn(input, "fleaTreatment"), false);
});
