"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { renderRevenueChart } = require("../staff/revenue-chart.js");

const months = Array.from({ length: 12 }, (_, index) => ({
  month: `2026-${String(index + 1).padStart(2, "0")}`,
  accommodationRevenue: (index + 1) * 100,
  collected: (index + 1) * 80,
  deposits: (index + 1) * 30,
  balances: (index + 1) * 50,
  surcharges: index + 2,
  refunds: index,
  lodgingNights: index + 3,
}));

test("renders all six annual totals and all twelve delegated month selectors", () => {
  const html = renderRevenueChart({ year: 2026, month: "2026-04", annual: {
    accommodationRevenue: 7800,
    collected: 6240,
    deposits: 2340,
    balances: 3900,
    surcharges: 90,
    refunds: 66,
  }, months });
  for (const [label, value] of [
    ["住宿預訂金額", "HK$7,800"], ["實際收款", "HK$6,240"], ["已收訂金", "HK$2,340"],
    ["已收尾數", "HK$3,900"], ["附加費", "HK$90"], ["退款", "HK$66"],
  ]) {
    assert.ok(html.includes(`<span>${label}</span><strong>${value}</strong>`), `${label}: ${value}`);
  }
  for (let month = 1; month <= 12; month += 1) {
    const key = `2026-${String(month).padStart(2, "0")}`;
    assert.ok(html.includes(`data-revenue-month="${key}"`), key);
  }
  assert.equal((html.match(/data-revenue-month=/g) || []).length, 12);
  assert.match(html, /data-revenue-month="2026-04" aria-pressed="true"/);
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
});

test("second selectedMonth argument overrides API month and renders selected metrics", () => {
  const html = renderRevenueChart({ year: 2026, month: "2026-01", months }, "2026-03");
  assert.match(html, /data-revenue-month="2026-03" aria-pressed="true"/);
  assert.match(html, /2026-03 月份摘要/);
  assert.match(html, /住宿預訂金額按入住月份統計；實際收款按付款日統計/);
  assert.match(html, /<dt>住宿晚數<\/dt><dd>5<\/dd>/);
  assert.match(html, /HK\$300/);
  assert.match(html, /HK\$240/);
  assert.match(html, /HK\$90/);
  assert.match(html, /現金按金不計入收入/);
});

test("escapes untrusted month labels and safely formats invalid amounts", () => {
  const html = renderRevenueChart([{ month: '<img src=x onerror="alert(1)">', accommodationRevenue: "oops" }]);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /HK\$0/);
  assert.doesNotMatch(html, /NaN/);
});

test("legacy array signature still renders the original chart and semantic table", () => {
  const html = renderRevenueChart([{ month: "Jan", accommodationRevenue: 20, collected: 30, deposits: 3 }]);
  assert.match(html, /每月營收/);
  assert.match(html, /<polyline/g);
  assert.match(html, /<th scope="row">Jan<\/th>/);
  assert.match(html, /年度營收摘要/);
  assert.match(html, /現金按金不計作收入/);
});
