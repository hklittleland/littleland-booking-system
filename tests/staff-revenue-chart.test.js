"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { renderRevenueChart } = require("../staff/revenue-chart.js");

const months = Array.from({ length: 12 }, (_, i) => ({
  month: `2026-${String(i + 1).padStart(2, "0")}`,
  accommodationRevenue: i * 100,
  collected: i * 110,
  deposits: i * 40,
  balances: i * 60,
  surcharges: i * 5,
  refunds: i,
}));

test("renders all 12 month labels in chart and accessible semantic table", () => {
  const html = renderRevenueChart({ months });
  for (const row of months) assert.ok(html.includes(row.month), row.month);
  assert.match(html, /<table>/);
  assert.match(html, /<th scope="row">2026-12<\/th>/);
  assert.match(html, /role="img"/);
  assert.match(html, /aria-labelledby="revenue-svg-title revenue-svg-desc"/);
  assert.match(html, /住宿收入/);
  assert.match(html, /實收款/);
});

test("missing, zero, and invalid amounts render as zero without NaN", () => {
  const html = renderRevenueChart([{ month: "Jan", accommodationRevenue: 0, collected: undefined, deposits: null, balances: "bad" }]);
  assert.doesNotMatch(html, /NaN/);
  assert.match(html, /HK\$0/);
  assert.match(html, /已收訂金/);
  assert.match(html, /HK\$0/);
});

test("uses distinct lines and accessible series descriptions", () => {
  const html = renderRevenueChart([{ month: "Jan", accommodationRevenue: 20, collected: 30 }]);
  assert.match(html, /stroke="#176b87"/);
  assert.match(html, /stroke="#b54708"/);
  assert.match(html, /stroke-dasharray="7 4"/);
  assert.match(html, /實線為住宿收入，虛線為實收款/);
});

test("no month data has a clear empty state", () => {
  assert.match(renderRevenueChart({ months: [] }), /目前沒有月份營收資料/);
  assert.match(renderRevenueChart(null), /目前沒有月份營收資料/);
});

test("escapes untrusted month text in every rendered context", () => {
  const html = renderRevenueChart([{ month: '<img src=x onerror="alert(1)">', accommodationRevenue: 1, collected: 2 }]);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
});

test("represents deposits, balances, surcharges and refunds without a cash-deposit series", () => {
  const html = renderRevenueChart([{ month: "Jan", accommodationRevenue: 10, collected: 12, deposits: 3, balances: 7, surcharges: 4, refunds: 2 }]);
  for (const label of ["已收訂金", "已收尾數", "附加費", "退款"]) assert.ok(html.includes(label), label);
  assert.match(html, /現金按金不計作住宿收入/);
  assert.doesNotMatch(html, /現金按金<\/g|series[^\n]*現金按金/i);
  assert.equal((html.match(/<polyline/g) || []).length, 2);
  assert.match(html, /<td>HK\$3<\/td>/);
  assert.match(html, /<td>HK\$7<\/td>/);
  assert.match(html, /<td>HK\$4<\/td>/);
  assert.match(html, /<td>HK\$2<\/td>/);
});
