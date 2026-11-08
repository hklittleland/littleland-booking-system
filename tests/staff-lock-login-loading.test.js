const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const calendar = require("../test/staff/calendar-view.js");

const appSource = fs.readFileSync(path.join(__dirname, "../test/staff/app.js"), "utf8");
const apiSource = fs.readFileSync(path.join(__dirname, "../test/staff/api-client.js"), "utf8");
const cssSource = fs.readFileSync(path.join(__dirname, "../test/staff/styles.css"), "utf8");
const htmlSource = fs.readFileSync(path.join(__dirname, "../test/staff/index.html"), "utf8");

test("TEST login immediately disables submit and announces connection/loading state", () => {
  assert.match(appSource, /loginButton\.disabled = true/);
  assert.match(appSource, /正在連接員工帳戶/);
  assert.match(appSource, /登入成功，正在載入後台資料/);
  assert.match(appSource, /aria-busy/);
  assert.match(cssSource, /@keyframes littleland-spin/);
});

test("calendar exposes lock management and maps TEST lock create/release actions", () => {
  assert.match(appSource, /data-jump-locks/);
  assert.match(appSource, /id="roomLockManagement"/);
  assert.match(appSource, /data-release-lock/);
  assert.match(apiSource, /roomLockCreate: "staff\.roomLockCreate"/);
  assert.match(apiSource, /roomLockRelease: "staff\.roomLockRelease"/);
  assert.match(htmlSource, /staff-lock-login-perf-20261108-1/);
});

test("room matrix shows active lock dates, keeps end date exclusive, and flags overlap", () => {
  const rendered = calendar.renderCalendarView({
    year: 2026,
    monthIndex: 10,
    todayISO: "2026-11-01",
    selectedDate: "2026-11-05",
    roomIds: ["A1"],
    bookings: [{
      bookingId: "SYNTHETIC-1",
      bookingStatus: "CONFIRMED",
      checkinDate: "2026-11-06",
      checkoutDate: "2026-11-07",
      allocatedRoomIds: ["A1"],
      species: "RABBIT",
      petNames: ["Mock Pet"],
    }],
    roomLocks: [{
      roomLockId: "LOCK-1",
      roomId: "A1",
      startDate: "2026-11-05",
      endDate: "2026-11-07",
      reason: "synthetic lock test",
      status: "ACTIVE",
    }],
  });
  assert.match(rendered, /legend-locked/);
  assert.match(rendered, /A1 · 2026-11-05 · 鎖房/);
  assert.match(rendered, /A1 · 2026-11-06 · 房態衝突/);
  assert.match(rendered, /A1 · 2026-11-07 · 空房/);
});

test("lock controls and login spinner fit the mobile-first layout rules", () => {
  assert.match(cssSource, /\.room-lock-form \{[^}]*min-width: 0/s);
  assert.match(cssSource, /@media \(max-width: 480px\)[^{]*\{[^}]*\.lock-entry-row/s);
  assert.match(cssSource, /prefers-reduced-motion/);
});
