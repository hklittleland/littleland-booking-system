"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const BookingReference = require("../staff/booking-reference");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "booking/index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "booking/styles.css"), "utf8");
const js = fs.readFileSync(path.join(root, "booking/booking.js"), "utf8");

test("guest page loads reference helper before booking code and uses the supplied logo", () => {
  assert.match(html, /api-client\.js\?v=20261101-flowfix1[\s\S]*?booking\.js\?v=checkin-slots-20261119-1/);
  assert.match(html, /\.\.\/staff\/booking-reference\.js[\s\S]*?booking\.js/);
  assert.match(html, /class="brand-mark-frame"[\s\S]*?<img class="brand-mark" src="assets\/littleland-logo\.jpg\?v=20261101-logo-full1" alt=""/);
  assert.match(html, /src="assets\/hero-illustration\.webp\?v=20261101-flowfix1"/);
  assert.match(html, /兔子、天竺鼠和倉鼠在 LittleLand 小寵物酒店門前/);
  assert.match(css, /object-fit:\s*contain/);
});

test("completion display and WhatsApp draft use the short reference", () => {
  assert.match(js, /const fullBookingId = state\.serverBooking\.bookingId;[\s\S]*?format\(fullBookingId\)/);
  assert.match(js, /預約參考號：\$\{shortReference\}/);
  assert.match(js, /Booking reference：\$\{escapeHtml\(shortReference\)\}/);
  assert.doesNotMatch(js, /Booking ID：\$\{escapeHtml\(state\.serverBooking\.bookingId\)\}/);
  assert.equal(BookingReference.format("TEST-LL-20261101-1A2B3C4D"), "1A2B3C4D");
});

test("full Booking ID remains the API response key and is not persisted", () => {
  assert.match(js, /validBookingId\(result\.bookingId\)/);
  assert.match(js, /state\.serverBooking = result;/);
  assert.match(js, /createBooking\(payload\)/);
  assert.match(js, /Booking IDs are never persisted/);
  assert.doesNotMatch(js, /localStorage\.[^(]+\([^\n]*shortReference/);
});

test("guest form exposes five check-in slots and four checkout slots, rejecting stale drafts", () => {
  for (const slot of ["14:30–15:00", "15:00–15:30", "15:30–16:00", "16:00–16:30", "17:45–18:15"]) assert.ok(js.includes(slot));
  assert.match(js, /CHECKIN_TIME_SLOTS = Object\.freeze\(\['14:30–15:00', '15:00–15:30', '15:30–16:00', '16:00–16:30', '17:45–18:15'\]\)/);
  assert.match(js, /CHECKOUT_TIME_SLOTS = Object\.freeze\(\['14:30–15:00', '15:30–16:00', '16:00–16:30', '17:45–18:15'\]\)/);
  assert.match(js, /if \(!CHECKIN_TIME_SLOTS\.includes\(fresh\.checkinTime\)\) fresh\.checkinTime = '';/);
  assert.match(js, /if \(!CHECKOUT_TIME_SLOTS\.includes\(fresh\.checkoutTime\)\) fresh\.checkoutTime = '';/);
});
