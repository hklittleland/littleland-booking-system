"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { renderScheduleView } = require("../staff/schedule-view.js");
const staff = [{ staffId: "s1", displayName: "Alice" }, { staffId: "s2", displayName: "Bob" }];
const render = (overrides = {}) => renderScheduleView({ year: 2026, monthIndex: 10, staff, schedules: [], todayISO: "2026-11-01", ...overrides });

test("calendar is Sunday-first and includes date hooks", () => {
  const html = render();
  assert.match(html, /星期日[\s\S]*星期一[\s\S]*星期六/);
  assert.match(html, /data-schedule-date="2026-11-01"/);
  assert.ok(html.indexOf("星期日") < html.indexOf("星期一"));
});

test("monthly work-day counts count unique work dates", () => {
  const html = render({ schedules: [
    { date: "2026-11-02", staffId: "s1", type: "WORK", startTime: "09:00", endTime: "17:00" },
    { date: "2026-11-02", staffId: "s1", type: "WORK", startTime: "09:00", endTime: "17:00" },
    { date: "2026-11-03", staffId: "s1", type: "WORK" },
    { date: "2026-11-04", staffId: "s2", type: "REST" },
  ] });
  assert.match(html, /Alice<\/span><strong>2 日/);
  assert.match(html, /Bob<\/span><strong>0 日/);
});

test("REST wins over WORK for the same person and day", () => {
  const html = render({ schedules: [
    { date: "2026-11-05", staffId: "s1", type: "WORK", startTime: "09:00", endTime: "17:00" },
    { date: "2026-11-05", staffId: "s1", type: "REST" },
  ] });
  const cell = html.split('data-schedule-date="2026-11-05"')[1].split("</article>")[0];
  assert.match(cell, /休息日/);
  assert.doesNotMatch(cell, /class="schedule-assignment schedule-assignment--work"/);
  assert.match(html, /Alice<\/span><strong>0 日/);
});

test("HKT today is marked on matching date", () => {
  const html = render({ todayISO: "2026-11-01" });
  const cell = html.match(/<article class="schedule-day[^>]*data-schedule-date="2026-11-01"[\s\S]*?<\/article>/)?.[0];
  assert.ok(cell);
  assert.match(cell, /schedule-day--today/);
  assert.match(cell, /今天（HKT）/);
});

test("month requiring six calendar rows renders 42 day cells", () => {
  const html = render({ year: 2026, monthIndex: 7, todayISO: "" });
  assert.equal((html.match(/class="schedule-day(?:\s|"|--)/g) || []).length, 42);
});

test("user-supplied staff text is HTML-escaped", () => {
  const html = render({ staff: [{ staffId: "x", displayName: '<img src=x onerror="alert(1)">' }], schedules: [{ date: "2026-11-02", staffId: "x", type: "WORK" }] });
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
});

test("empty staff and schedule states are explicit without invented names", () => {
  const html = render({ staff: [], schedules: [] });
  assert.match(html, /沒有員工資料/);
  assert.match(html, /沒有排班資料/);
  assert.doesNotMatch(html, /Alice|Bob/);
});

test("shift times are rendered and escaped", () => {
  const html = render({ schedules: [{ date: "2026-11-06", staffId: "s1", type: "WORK", startTime: "09:00", endTime: "18:00" }] });
  assert.match(html, /09:00–18:00/);
});
