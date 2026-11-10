const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const expected = ["14:30–15:00", "15:30–16:00", "16:00–16:30", "17:45–18:15"];
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("guest and Staff booking forms expose the four approved time slots", () => {
  const guest = read("booking/booking.js");
  const staffForm = require("../staff/new-booking-form.js");
  const staffApp = read("staff/app.js");
  for (const slot of expected) {
    assert.ok(guest.includes(slot), `Guest form missing ${slot}`);
    assert.ok(staffApp.includes(slot), `Staff edit form missing ${slot}`);
  }
  assert.deepEqual(staffForm.TIME_SLOTS, expected);
});

test("Production Booking API accepts the same time slots for check-in and check-out", () => {
  const validation = read("apps-script-prod/BookingValidation.gs");
  const expectedLiteral = expected.map((slot) => `'${slot}'`).join(", ");
  assert.ok(validation.includes(`LITTLELAND_CHECKIN_TIMES = Object.freeze([${expectedLiteral}])`));
  assert.ok(validation.includes(`LITTLELAND_CHECKOUT_TIMES = Object.freeze([${expectedLiteral}])`));
});

test("late checkout wording says after 18:30 and preserves the HK$200 one-time fee", () => {
  for (const file of ["booking/booking.js", "booking/pricing.js", "staff/new-booking-view.js", "apps-script-prod/PricingEngine.gs"]) {
    const source = read(file);
    assert.ok(source.includes("18:30 後"), `${file} missing 18:30 threshold`);
    assert.ok(!source.includes("17:00 後"), `${file} has stale late-checkout threshold`);
  }
  assert.match(read("booking/pricing.js"), /LATE_CHECKOUT:[^\n]*amount: 200/);
  assert.match(read("apps-script-prod/PricingEngine.gs"), /LATE_CHECKOUT:[^\n]*amount: 200/);
});

test("new versioned assets are referenced by both public pages", () => {
  assert.ok(read("booking/index.html").includes("booking.js?v=booking-times-20261110-1"));
  const staff = read("staff/index.html");
  assert.ok(staff.includes("new-booking-form.js?v=staff-times-20261110-1"));
  assert.ok(staff.includes("new-booking-view.js?v=staff-times-20261110-1"));
  assert.ok(staff.includes("app.js?v=staff-times-20261110-1"));
});

test("legacy drafts and existing bookings are not silently rewritten", () => {
  const guest = read("booking/booking.js");
  const staff = read("staff/app.js");
  assert.match(guest, /if \(!BOOKING_TIME_SLOTS\.includes\(fresh\.checkinTime\)\) fresh\.checkinTime = '';/);
  assert.match(guest, /if \(!BOOKING_TIME_SLOTS\.includes\(fresh\.checkoutTime\)\) fresh\.checkoutTime = '';/);
  assert.match(staff, /const legacy = current && !bookingTimeSlots\.includes\(current\);/);
  assert.ok(staff.includes("（原有時段）"));
});

test("late checkout price remains a one-time HK$200 fee", () => {
  const pricing = require("../booking/pricing.js");
  const quote = pricing.calculatePricing({
    species: "rabbit",
    roomId: "DELUXE_ROOM",
    checkin: "2026-12-02",
    checkout: "2026-12-04",
    quantity: 1,
    services: ["LATE_CHECKOUT"],
  });
  assert.equal(quote.serviceFees, 200);
});
