"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { renderScheduleView } = require("../staff/schedule-view.js");

const appSource = fs.readFileSync(path.join(__dirname, "../staff/app.js"), "utf8");
const scheduleSource = fs.readFileSync(path.join(__dirname, "../staff/schedule-view.js"), "utf8");

test("schedule month navigation is bound only to explicit navigation buttons", () => {
  assert.match(appSource, /data-schedule-month-nav="-1"/);
  assert.match(appSource, /data-schedule-month-nav="1"/);
  assert.match(appSource, /querySelectorAll\("button\[data-schedule-month-nav\]"\)/);
  assert.match(appSource, /button\.dataset\.scheduleMonthNav/);
  assert.doesNotMatch(appSource, /querySelectorAll\("\[data-schedule-month\]"\)/);
});

test("the monthly save form retains its own visible month identity without a navigation marker", () => {
  const html = renderScheduleView({
    year: 2026,
    monthIndex: 10,
    staff: [{ staffId: "s1", displayName: "A" }, { staffId: "s2", displayName: "B" }],
    schedules: [],
  });
  const form = html.match(/<form id="scheduleMonthForm"[^>]*>/)?.[0] || "";
  assert.match(form, /data-schedule-year="2026"/);
  assert.match(form, /data-schedule-month="11"/);
  assert.doesNotMatch(form, /data-schedule-month-nav/);
  assert.match(form, /id="scheduleMonthForm"/);
});

test("schedule dropdown dates cannot trigger the calendar day-click handler", () => {
  const html = renderScheduleView({
    year: 2026,
    monthIndex: 10,
    staff: [{ staffId: "s1", displayName: "A" }, { staffId: "s2", displayName: "B" }],
    schedules: [],
  });
  assert.match(html, /data-schedule-day data-schedule-day-date="2026-11-01"/);
  assert.doesNotMatch(html, /<select[^>]*data-date=/);
  assert.match(appSource, /querySelectorAll\("\.day-cell\[data-date\]"\)/);
  assert.match(appSource, /draft\[control\.dataset\.scheduleDayDate\] = control\.value/);
  assert.match(appSource, /workDate: control\.dataset\.scheduleDayDate/);
  assert.doesNotMatch(scheduleSource, /data-schedule-day[^>]*data-date=/);
});

test("changing a day updates the visible employee name, color class, counts and date summary without repainting the month", () => {
  assert.match(appSource, /scheduleMonthForm\.addEventListener\("change"/);
  assert.match(appSource, /name\.textContent = select\.value/);
  assert.match(appSource, /schedule-day-select--1[\s\S]*schedule-day-select--2[\s\S]*schedule-day-select--3/);
  assert.match(appSource, /scheduleView\.renderScheduleSummary\(arr\(\(store\.state\.schedules \|\| \{\}\)\.staff\), assignments\)/);
  assert.match(scheduleSource, /data-schedule-current-name/);
  assert.match(scheduleSource, /data-schedule-summary-days/);
});

test("static UI components are not fetched again by app.js and session is validated by the first page read", () => {
  assert.doesNotMatch(appSource, /document\.createElement\("script"\)/);
  assert.doesNotMatch(appSource, /StaffAPI\.request\("session"/);
  assert.match(appSource, /if \(store\.token\) route\(\);/);
});

test("read caching is short-lived, manually refreshable and invalidated after a successful mutation", () => {
  assert.match(appSource, /readCacheTtlMs = 15000/);
  assert.match(appSource, /data-refresh-page/);
  assert.match(appSource, /loadPageData\(page, \{ force: true \}\)/);
  assert.match(appSource, /readCache\.clear\(\);\s*toast\("TEST API 已確認操作。"\)/);
  assert.match(appSource, /loadPageData\(StaffRouter\.current\(\)\.page, \{ force: true \}\)/);
});
