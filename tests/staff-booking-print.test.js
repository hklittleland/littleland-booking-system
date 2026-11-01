"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { render } = require("../staff/booking-print.js");

function sample(overrides = {}) {
  const booking = {
    bookingId: "TEST-LL-20261101-ABCD1234",
    bookingStatus: "CHECKED_IN",
    allocatedRoomIdsJson: JSON.stringify(["S1", "S2"]),
    parentName: "<script>alert('x')</script>",
    phone: "55500000",
    email: "guest@test.example",
    emergency1: "聯絡人 A · 55500001",
    emergency2: "聯絡人 B · 55500002",
    checkinDate: "2026-11-01",
    checkinTime: "14:30–15:30",
    checkoutDate: "2026-11-03",
    checkoutTime: "15:30–16:30",
    roomTypeId: "DELUXE_SUITE",
    species: "RABBIT",
    quantity: 2,
    nights: 2,
    roomPrice: 350,
    baseRoomFee: 700,
    extraPetFee: 100,
    weekendFee: 0,
    serviceFees: 70,
    totalSurcharges: 170,
    estimatedTotal: 870,
    depositAmount: 350,
    remainingBalance: 520,
    cashDepositAmount: 2000,
    cashDepositStatus: "COLLECTED",
    cashDepositCollected: true,
    cashDepositCollectedAmount: 2000,
    cashDepositUsedAmount: 200,
    cashDepositRefundedAmount: 0,
    cashDepositRefundDue: 1800,
    depositStatus: "PAID",
    balanceStatus: "UNPAID",
    foodMain: "Oxbow 成兔糧",
    feeding: "每日兩次",
    hay: "Momi 1st cut",
    vegetables: "是",
    serviceItemsJson: JSON.stringify([{ label: "單次梳毛", amount: 70, petNameSnapshot: "Mochi" }]),
    ...overrides,
  };
  return {
    booking,
    pets: [{
      name: "Mochi", breed: "Lionhead", ageValue: 2, ageUnit: "year", ageInMonths: 24,
      sex: "female", pregnant: "no", sterilized: "no", recentSurgery30Days: "no", vetVisit: "no",
      infectiousDisease: "no", chronicDisease: "no", medication: "yes",
      medicationDetails: "藥物每日兩次，早晚各一次", specialCare: "清潔眼睛",
    }],
    payments: [{ paymentType: "DEPOSIT", paymentStatus: "PAID", amount: 350, paidAt: "2026-10-30" }],
    adjustments: [{ type: "SURCHARGE", status: "ACTIVE", description: "額外護理", amount: 50, petNameSnapshot: "Mochi" }],
  };
}

const options = { shortReference: "ABCD1234", assetBase: "/staff/assets/booking-print/", autoPrint: false };

test("booking print uses an eight-character guest reference and prints assigned physical rooms, not virtual suite IDs", () => {
  const html = render(sample(), options);
  assert.match(html, /ABCD1234/);
  assert.doesNotMatch(html, /TEST-LL-20261101-ABCD1234/);
  assert.match(html, /實體房間（系統自動分配）[\s\S]*?S1＋S2/);
  assert.match(html, /實體房間（本預約寵物共用）[\s\S]*?S1＋S2/);
  assert.doesNotMatch(html, /allocatedRoomIds|SS1|SSR1/);
});

test("booking print includes booking data, detailed charges, manual adjustments and payment states", () => {
  const html = render(sample(), options);
  for (const expected of ["入住資料核對及收費詳情", "55500000", "2026-11-01", "豪華套房", "基本房費", "額外寵物費", "單次梳毛", "寵物：Mochi", "額外護理", "目前住宿總額", "應付訂金", "預計尾數", "已收"])
    assert.ok(html.includes(expected), `missing expected print content: ${expected}`);
  assert.match(html, /HK\$920/);
  assert.match(html, /HK\$2,000/);
  assert.match(html, /HK\$1,800/);
});

test("care form auto-fills pet, food, health and medicine details with stay dates", () => {
  const html = render(sample(), options);
  for (const expected of ["每日照顧及餵藥紀錄", "Mochi", "聯絡人 A · 55500001", "聯絡人 B · 55500002", "Oxbow 成兔糧", "Momi 1st cut", "藥物每日兩次，早晚各一次", "最近 30 日手術", "11/01", "11/02", "星期日／公眾假期僅餵一次、雙倍份量"])
    assert.ok(html.includes(expected), `missing prefilled care detail: ${expected}`);
  assert.match(html, /每日照顧打勾表/);
  assert.match(html, /照顧項目/);
  assert.match(html, /員工收款／核對簽署/);
});

test("hamster care form omits feed-count, hay and holiday reminders", () => {
  const data = sample({ species: "HAMSTER", roomTypeId: "HAMSTER_BOX", foodMain: "BUNNY 倉鼠糧", feeding: "", hay: "", vegetables: "否" });
  data.pets[0].medication = "no";
  const html = render(data, options);
  assert.match(html, /倉鼠長擺糧；不設餵食次數／假期提醒/);
  assert.doesNotMatch(html, /牧草：/);
  assert.doesNotMatch(html, /星期日／公眾假期僅餵一次、雙倍份量/);
});

test("zero-value surcharge rows and surcharge totals are omitted", () => {
  const data = sample({
    quantity: 1,
    extraPetFee: 0,
    weekendFee: 0,
    serviceFees: 0,
    totalSurcharges: 0,
    estimatedTotal: 700,
    serviceItemsJson: "[]",
  });
  data.adjustments = [];
  const html = render(data, options);
  const firstPage = html.split("付款及入住當日核對")[0];
  for (const absent of ["額外寵物費", "週末短住附加費", "額外服務費合計", "附加費合計（系統費用）", "人工附加費／減項淨額"])
    assert.doesNotMatch(firstPage, new RegExp(absent));
});

test("per-pet service items are printed as separate named charges", () => {
  const data = sample({
    extraPetFee: 0,
    weekendFee: 0,
    serviceFees: 150,
    totalSurcharges: 150,
    estimatedTotal: 850,
    serviceItemsJson: JSON.stringify([
      { label: "單次梳毛", amount: 70, petId: "pet-1" },
      { label: "每日餵藥 1 次", amount: 80, petId: "pet-2" },
    ]),
  });
  data.pets = [{ petId: "pet-1", name: "Mochi" }, { petId: "pet-2", name: "Pudding" }];
  data.adjustments = [];
  const html = render(data, options);
  const feeRows = html.split("<tbody>")[1].split("</tbody>")[0];
  assert.match(feeRows, /單次梳毛 · 寵物：Mochi[\s\S]*?HK\$70/);
  assert.match(feeRows, /每日餵藥 1 次 · 寵物：Pudding[\s\S]*?HK\$80/);
});

test("unassigned grooming or medication charges are not presented as applying to every pet", () => {
  const data = sample({
    serviceFees: 80,
    totalSurcharges: 80,
    estimatedTotal: 800,
    serviceItemsJson: JSON.stringify([{ label: "每日餵藥 1 次", amount: 80 }]),
  });
  data.adjustments = [];
  const html = render(data, options);
  assert.match(html, /每日餵藥 1 次 · 毛孩未指定/);
  assert.doesNotMatch(html, /每日餵藥 1 次 · 整張預約/);
});

test("manual fee reversal is signed and inactive adjustments are excluded from current total", () => {
  const data = sample();
  data.adjustments.push({ type: "REVERSAL", status: "RECORDED", amount: -20, description: "撤銷" });
  data.adjustments.push({ type: "SURCHARGE", status: "VOID", amount: 900, description: "已取消項目" });
  const html = render(data, options);
  assert.match(html, /-HK\$20/);
  assert.doesNotMatch(html, /已取消項目/);
  assert.match(html, /HK\$900/); // active 50 plus reversal -20, added to 870 accommodation snapshot
});

test("only the original terms pages are appended; the redesigned care form replaces the old medication pages", () => {
  const html = render(sample(), { ...options, autoPrint: true });
  for (const asset of ["terms-page-1.png", "terms-page-2.png"])
    assert.ok(html.includes(`/staff/assets/booking-print/${asset}`), `missing source terms page ${asset}`);
  assert.doesNotMatch(html, /medication-page-[12]\.png/);
  assert.match(html, /window\.print\(\)/);
  assert.match(html, /size: A4 portrait/);
});

test("untrusted customer and pet details are escaped in printable HTML", () => {
  const html = render(sample(), options);
  assert.match(html, /&lt;script&gt;alert\(&#39;x&#39;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\('x'\)<\/script>/);
});


test("booking print never presents virtual room-combination IDs as physical rooms", () => {
  const data = sample({ allocatedRoomIdsJson: JSON.stringify(["SS1", "SSR1"]) });
  const html = render(data, options);
  assert.match(html, /實體房間（系統自動分配）[\s\S]*?未分配（請核對房態）/);
  assert.doesNotMatch(html, /SS1|SSR1/);
});
