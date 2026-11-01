"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { renderScheduleView } = require("../staff/schedule-view.js");

const staff = [{ staffId: "s1", displayName: "Alice" }, { staffId: "s2", displayName: "Bob" }];
const render = (overrides = {}) => renderScheduleView({ year: 2026, monthIndex: 10, month: 11, staff, schedules: [], todayISO: "2026-11-01", ...overrides });

test("renders a month calendar with a dropdown for each date and one save button", () => {
  const html = render();
  assert.match(html, /scheduleMonthForm/);
  assert.equal((html.match(/data-schedule-day(?=\s|>)/g) || []).length, 30);
  assert.equal((html.match(/儲存本月排班/g) || []).length, 1);
  assert.match(html, /員工 A/);
  assert.match(html, /員工 B/);
  assert.match(html, /Alice/);
  assert.match(html, /Bob/);
  assert.match(html, /未安排表示當日所有有效員工均休息/);
});

test("month layout is Sunday-first, keeps the selected month and marks the HKT today", () => {
  const html = render();
  assert.ok(html.indexOf('class="schedule-weekday" role="columnheader">日') < html.indexOf('class="schedule-weekday" role="columnheader">一'));
  assert.match(html, /data-schedule-date="2026-11-01"/);
  assert.match(html, /schedule-day--today/);
  assert.match(html, /今天/);
  assert.match(html, /data-schedule-year="2026" data-schedule-month="11"/);
});

test("monthly work-day counts count unique selected dates", () => {
  const html = render({ schedules: [
    { workDate: "2026-11-02", staffId: "s1", status: "WORK" },
    { workDate: "2026-11-02", staffId: "s1", status: "WORK" },
    { workDate: "2026-11-03", staffId: "s1", status: "WORK" },
    { workDate: "2026-11-04", staffId: "s2", status: "REST" },
  ] });
  assert.match(html, /Alice<\/span><strong>2 日/);
  assert.match(html, /Bob<\/span><strong>0 日/);
});

test("REST wins over a stale WORK row for the same person and day", () => {
  const html = render({ schedules: [
    { workDate: "2026-11-05", staffId: "s1", status: "WORK" },
    { workDate: "2026-11-05", staffId: "s1", status: "REST" },
  ] });
  const cell = html.split('data-schedule-date="2026-11-05"')[1].split("</article>")[0];
  assert.match(cell, /休息／未安排/);
  assert.doesNotMatch(cell, /schedule-current-name">Alice/);
  assert.match(html, /Alice<\/span><strong>0 日/);
});

test("multiple WORK rows default to unassigned and show a visible conflict warning", () => {
  const html = render({ schedules: [
    { workDate: "2026-11-06", staffId: "s1", status: "WORK" },
    { workDate: "2026-11-06", staffId: "s2", status: "WORK" },
  ] });
  const cell = html.split('data-schedule-date="2026-11-06"')[1].split("</article>")[0];
  assert.match(cell, /需選一位/);
  assert.match(cell, /<option value="" selected>未安排<\/option>/);
});

test("months requiring six calendar rows render 42 day cells", () => {
  const html = render({ year: 2026, monthIndex: 7, todayISO: "" });
  assert.equal((html.match(/class="schedule-day(?:\s|"|--)/g) || []).length, 42);
});

test("staff names are HTML-escaped and fewer than two active roster employees cannot edit the month", () => {
  const html = render({ staff: [{ staffId: "x", displayName: '<img src=x onerror="alert(1)">' }] });
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /設定 2–3 位排班員工名稱/);
  assert.match(html, /儲存本月排班/);
  assert.match(html, /disabled/);
});

test("shift times are not exposed in the simplified calendar", () => {
  const html = render({ schedules: [{ workDate: "2026-11-06", staffId: "s1", status: "WORK", startTime: "09:00", endTime: "18:00" }] });
  assert.doesNotMatch(html, /09:00|18:00/);
});

test("three schedule-only employees are shown by name in each daily dropdown", () => {
  const html = render({ staff: [
    { staffId: "s1", displayName: "Alice" },
    { staffId: "s2", displayName: "Bob" },
    { staffId: "s3", displayName: "Carol" },
  ] });
  assert.equal((html.match(/data-schedule-day(?=\s|>)/g) || []).length, 30);
  assert.match(html, /員工 A · Alice/);
  assert.match(html, /員工 B · Bob/);
  assert.match(html, /員工 C · Carol/);
  assert.doesNotMatch(html, /設定 2–3 位排班員工名稱/);
  assert.doesNotMatch(html, /<button class="btn" type="submit" disabled/);
});

test("empty staff state is explicit without inventing names", () => {
  const html = render({ staff: [], schedules: [] });
  assert.match(html, /沒有有效員工資料/);
  assert.doesNotMatch(html, /Alice|Bob/);
  assert.doesNotMatch(html, /data-schedule-day/);
});
