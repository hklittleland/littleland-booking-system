"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "../staff/app.js"), "utf8");
const store = fs.readFileSync(path.join(__dirname, "../staff/store.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../staff/styles.css"), "utf8");

test("booking requests use backend pagination/filter contract and accept response metadata", () => {
  assert.match(app, /p = \{ page: q\.page, search: q\.search, status: q\.status, roomTypeId: q\.roomTypeId, checkinDate: q\.checkinDate, checkoutDate: q\.checkoutDate \}/);
  assert.match(app, /store\.state\.records = d\.bookings \|\| \[\]/);
  for (const field of ["page", "pageSize", "totalCount", "totalPages"])
    assert.match(app, new RegExp(`${field}: Number\\(d\\.${field}\\)`));
  assert.doesNotMatch(app, /filtered\.sort|records\)\.sort/);
});

test("list query and page persist in store across detail route transitions", () => {
  assert.match(store, /bookingList: \{ page: 1, pageSize: 15, totalCount: 0, totalPages: 0, search: "", status: "", roomTypeId: "", checkinDate: "", checkoutDate: "" \}/);
  assert.match(app, /data-go="bookings">返回預訂列表/);
  assert.match(app, /bookingListState\[key\] = control\.value;[\s\S]*bookingListState\.page = 1/);
});

test("booking UI exposes accessible count/page status, disabled boundaries, and an empty state", () => {
  assert.match(app, /符合 \$\{q\.totalCount\} 筆 · 第 \$\{q\.totalPages \? q\.page : 0\}／\$\{q\.totalPages\} 頁/);
  assert.match(app, /q\.page <= 1 \? "disabled"/);
  assert.match(app, /q\.page >= q\.totalPages \? "disabled"/);
  assert.match(app, /list\(store\.state\.records, "沒有符合預訂"\)/);
  assert.match(app, /aria-live="polite"/);
});

test("large booking result sets render a compact page window", () => {
  assert.match(app, /const pageNumbers = q\.totalPages <= 7/);
  assert.match(app, /booking-pagination-ellipsis/);
  assert.match(css, /\.booking-pagination-ellipsis\s*\{/);
});

test("pagination controls wrap and retain 44px touch targets on narrow screens", () => {
  assert.match(css, /\.booking-pagination,\s*\.detail-head-actions\s*\{[\s\S]*flex-wrap: wrap/);
  assert.match(css, /\.booking-pagination \.btn\s*\{[\s\S]*min-width: 44px;[\s\S]*min-height: 44px/);
});
