"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { renderScheduleView } = require("../staff/schedule-view.js");

const appSource = fs.readFileSync(path.join(__dirname, "../staff/app.js"), "utf8");

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
