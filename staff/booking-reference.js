(function (root, factory) {
  "use strict";
  const api = factory();
  root.LittleLandBookingReference = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const STANDARD_BOOKING_ID = /^TEST-LL-\d{8}-([A-Z0-9]{8})$/i;

  function asText(value) {
    return value == null ? "" : String(value);
  }

  function format(bookingId) {
    const original = asText(bookingId);
    if (!original) return "";

    const match = original.match(STANDARD_BOOKING_ID);
    return match ? match[1].toUpperCase() : original;
  }

  function bookingIdFrom(booking) {
    if (typeof booking === "string" || typeof booking === "number") {
      return asText(booking);
    }
    if (!booking || typeof booking !== "object") return "";
    return asText(booking.bookingId ?? booking.id ?? "");
  }

  function matches(search, booking) {
    const query = asText(search).trim().toUpperCase();
    if (!query) return false;

    const fullId = bookingIdFrom(booking);
    if (!fullId) return false;
    return fullId.toUpperCase().includes(query) || format(fullId).toUpperCase().includes(query);
  }

  function ensureUnique(existingIds, candidateId) {
    const candidate = asText(candidateId);
    if (!candidate) return true;

    const candidateFull = candidate.toUpperCase();
    const candidateShort = format(candidate).toUpperCase();
    const ids = Array.isArray(existingIds) ? existingIds : [];

    return !ids.some((existing) => {
      const existingFull = asText(existing).toUpperCase();
      if (!existingFull) return false;
      const existingShort = format(existing).toUpperCase();
      return existingFull === candidateFull || existingShort === candidateShort;
    });
  }

  return Object.freeze({ format, matches, ensureUnique });
});
