"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { renderCalendarView } = require("../staff/calendar-view.js");
const base = (extra = {}) => ({ year: 2025, monthIndex: 5, todayISO: "2025-06-15", selectedDate: "2025-06-15", bookings: [], schedules: [], roomIds: ["S1", "S2"], roomNames: { DELUXE_ROOM: "豪華房" }, ...extra });

test("grid starts Sunday and only has dates from requested month", () => {
  const html = renderCalendarView(base());
  assert.match(html, /星期日[\s\S]*星期六/);
  assert.match(html, /data-date="2025-06-01"/);
  assert.match(html, /data-date="2025-06-30"/);
  assert.doesNotMatch(html, /data-date="2025-05-/);
  assert.match(html, /data-rows="5"/);
});

test("marks today and selected date accessibly", () => {
  const html = renderCalendarView(base());
  assert.match(html, /class="day-cell today selected" data-date="2025-06-15" aria-current="date" aria-selected="true"/);
  assert.match(html, /<span class="today-label">今天<\/span>/);
});

test("checkout is exclusive: checkout day reminder but no in-house allocation", () => {
  const html = renderCalendarView(base({ bookings: [{ bookingId: "B1", bookingStatus: "CONFIRMED", checkinDate: "2025-06-14", checkoutDate: "2025-06-15", allocatedRoomIds: ["S1"], roomTypeId: "DELUXE_ROOM", petNames: ["Momo"] }] }));
  const cell = html.split('data-date="2025-06-15"')[1].split("</div>")[0];
  assert.match(cell, /退房提醒/);
  assert.doesNotMatch(cell, /入住中/);
  assert.doesNotMatch(cell, /S1/);
});

test("check-in/out labels and visual classes", () => {
  const html = renderCalendarView(base({ bookings: [{ bookingId: "B1", bookingStatus: "CONFIRMED", checkinDate: "2025-06-15", checkoutDate: "2025-06-18", allocatedRoomIds: ["S1"], roomTypeId: "DELUXE_ROOM" }] }));
  assert.match(html, /class="calendar-booking check-in"[^>]*>[\s\S]*?入住/);
  assert.match(html, /class="calendar-booking check-out"[^>]*>[\s\S]*?退房提醒/);
  assert.match(html, /class="calendar-booking in-house"/);
});

test("species icons and pet names are included", () => {
  const bookings = ["RABBIT", "GUINEA_PIG", "HAMSTER", "RABBIT"].map((species, i) => ({ bookingId: `P${i}`, bookingStatus: "CONFIRMED", checkinDate: "2025-06-15", checkoutDate: "2025-06-20", allocatedRoomIds: ["S1"], species, petNames: [`Pet${i}`] }));
  const html = renderCalendarView(base({ bookings }));
  for (const x of ["🐰 Pet0", "🐽 Pet1", "🐹 Pet2"]) assert.ok(html.includes(x));
  assert.match(html, /＋1 項/);
});

test("pending bookings are not occupied and never display allocations", () => {
  const bookings = ["PENDING_CONFIRMATION", "PENDING_DEPOSIT"].map((bookingStatus, i) => ({ bookingId: `P${i}`, bookingStatus, checkinDate: "2025-06-15", checkoutDate: "2025-06-20", allocatedRoomIds: ["S1", "VIRTUAL_SUITE"], roomTypeId: "DELUXE_ROOM", petNames: ["Pet"] }));
  const html = renderCalendarView(base({ bookings }));
  assert.match(html, /pending/);
  assert.doesNotMatch(html, /class="calendar-booking (?:in-house|check-in)"/);
  assert.doesNotMatch(html, /<span class="booking-room">S1/);
  assert.doesNotMatch(html, /VIRTUAL_SUITE/);
  assert.match(html, /不佔房/);
});

test("escapes user-controlled booking, room and schedule content", () => {
  const html = renderCalendarView(base({ roomNames: { X: '<img src=x onerror="x">' }, bookings: [{ bookingId: '" onmouseover="x', bookingStatus: "CONFIRMED", checkinDate: "2025-06-15", checkoutDate: "2025-06-20", allocatedRoomIds: ["S1"], roomTypeId: "X", petNames: ["<script>alert(1)</script>"] }], schedules: [{ date: "2025-06-15", staffId: "S", displayName: "<svg onload=x>", shiftTime: "<b>evil</b>", status: "WORK" }] }));
  assert.doesNotMatch(html, /<script>|<svg|<img/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=&quot;x&quot;&gt;/);
  assert.match(html, /&lt;svg onload=x&gt;/);
  assert.match(html, /&lt;b&gt;evil&lt;\/b&gt;/);
  assert.match(html, /data-detail="&quot; onmouseover=&quot;x"/);
});

test("shows physical room IDs and room type label", () => {
  const html = renderCalendarView(base({ bookings: [{ bookingId: "B1", bookingStatus: "CONFIRMED", checkinDate: "2025-06-15", checkoutDate: "2025-06-20", allocatedRoomIds: ["S1", "VIRTUAL_SUITE"], roomTypeId: "DELUXE_ROOM" }] }));
  assert.match(html, /S1 · 豪華房/);
  assert.doesNotMatch(html, /VIRTUAL_SUITE/);
});

test("shows selected-day work and rest schedules", () => {
  const html = renderCalendarView(base({ schedules: [{ date: "2025-06-15", staffId: "S1", displayName: "Alice", shiftTime: "09:00–17:00", status: "WORK" }, { date: "2025-06-15", displayName: "Bob", status: "REST" }, { date: "2025-06-16", displayName: "Other", status: "WORK" }] }));
  assert.match(html, /Alice/);
  assert.match(html, /09:00–17:00/);
  assert.match(html, /Bob/);
  assert.match(html, /休息/);
  assert.doesNotMatch(html, /Other/);
});

test("renders six rows for months requiring six calendar weeks", () => {
  const html = renderCalendarView(base({ year: 2025, monthIndex: 7, todayISO: "2025-08-01", selectedDate: "2025-08-01" }));
  assert.match(html, /data-rows="6"/);
  assert.equal((html.match(/data-date="2025-08-/g) || []).length, 31);
});
