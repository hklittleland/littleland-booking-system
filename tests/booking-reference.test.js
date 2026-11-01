"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const BookingReference = require("../staff/booking-reference");

const fullId = "TEST-LL-20261101-1A2B3C4D";

test("formats a standard booking ID as its final eight-character reference", () => {
  assert.equal(BookingReference.format(fullId), "1A2B3C4D");
});

test("normalizes standard booking ID and reference case", () => {
  assert.equal(BookingReference.format("test-ll-20261101-1a2b3c4d"), "1A2B3C4D");
});

test("handles malformed and empty IDs conservatively", () => {
  assert.equal(BookingReference.format("legacy-booking-123"), "legacy-booking-123");
  assert.equal(BookingReference.format(""), "");
  assert.equal(BookingReference.format(null), "");
});

test("search matches either the full ID or short reference", () => {
  const booking = { bookingId: fullId };
  assert.equal(BookingReference.matches(fullId, booking), true);
  assert.equal(BookingReference.matches("1a2b3c4d", booking), true);
});

test("search does not match unrelated text or an empty query", () => {
  assert.equal(BookingReference.matches("9Z9Z", { id: fullId }), false);
  assert.equal(BookingReference.matches("", { id: fullId }), false);
});

test("rejects suffix collisions while accepting a unique candidate unchanged", () => {
  assert.equal(BookingReference.ensureUnique([fullId], "TEST-LL-20261231-1A2B3C4D"), false);
  const candidate = "TEST-LL-20261231-5E6F7G8H";
  assert.equal(BookingReference.ensureUnique([fullId], candidate), true);
  assert.equal(candidate, "TEST-LL-20261231-5E6F7G8H");
});
