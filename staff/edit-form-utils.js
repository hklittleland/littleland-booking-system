(function (root, factory) {
  "use strict";
  const api = factory();
  root.StaffEditFormUtils = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const yesNoFields = new Set([
    "sterilized",
    "pregnant",
    "recentSurgery30Days",
    "vetVisit",
    "infectiousDisease",
    "chronicDisease",
    "medication",
    "fleaTreatment",
  ]);
  const hamsterUnsupportedFields = new Set([
    "sterilized",
    "pregnant",
    "fleaTreatment",
  ]);
  const petInputFields = new Set([
    "name",
    "breed",
    "ageValue",
    "ageUnit",
    "sex",
    "sterilized",
    "pregnant",
    "recentSurgery",
    "vetVisit",
    "vetDetails",
    "infectiousDisease",
    "infectiousDetails",
    "chronicDisease",
    "chronicDetails",
    "medication",
    "medicationDetails",
    "specialCare",
    "fleaTreatment",
  ]);

  function escapeFormValue(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  }

  function normalizeYesNo(value) {
    if (value === true) return "yes";
    if (value === false) return "no";
    const text = String(value == null ? "" : value).trim().toLowerCase();
    if (text === "yes" || text === "true" || text === "是") return "yes";
    if (text === "no" || text === "false" || text === "否") return "no";
    return "";
  }

  function toYesNoOption(key, value, fallback) {
    if (!yesNoFields.has(key)) {
      return value == null || value === "" ? fallback : value;
    }
    return normalizeYesNo(value) || normalizeYesNo(fallback);
  }

  function toVegetablesOption(value) {
    const answer = normalizeYesNo(value);
    return answer === "yes" ? "是" : answer === "no" ? "否" : "";
  }

  function isHamsterSpecies(species) {
    return String(species == null ? "" : species)
      .trim()
      .toLowerCase() === "hamster";
  }

  function createPetEditInput(petId, fields, species) {
    if (typeof petId !== "string" || !petId) {
      throw new TypeError("petId is required");
    }
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
      throw new TypeError("pet edit fields must be an object");
    }
    const isHamster = isHamsterSpecies(species);
    const isMalePet = String(fields.sex == null ? "" : fields.sex)
      .trim()
      .toLowerCase() === "male";
    const result = { petId };
    Object.entries(fields).forEach(([key, value]) => {
      if (
        (isHamster && hamsterUnsupportedFields.has(key)) ||
        (isMalePet && key === "pregnant")
      ) return;
      const apiKey = key === "recentSurgery30Days" ? "recentSurgery" : key;
      if (!petInputFields.has(apiKey)) {
        throw new TypeError(`Unsupported pet edit field: ${key}`);
      }
      result[apiKey] = value;
    });
    return result;
  }

  return Object.freeze({
    escapeFormValue,
    normalizeYesNo,
    toYesNoOption,
    toVegetablesOption,
    isHamsterSpecies,
    createPetEditInput,
  });
});
