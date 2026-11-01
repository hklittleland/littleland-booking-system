"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Pricing = require("../booking/pricing.js");

function loadView() {
  const window = { LittleLandPricing: Pricing };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../staff/booking-changes-view.js"), "utf8"), { window });
  return window.LittleLandBookingChangesView;
}

test("renders per-pet signed fee items and allows edits through completed bookings", () => {
  const view = loadView();
  const html = view.render({
    booking: {
      bookingId: "TEST-BOOKING-1",
      bookingStatus: "COMPLETED",
      species: "rabbit",
      roomTypeId: "DELUXE_SUITE",
      quantity: 2,
      estimatedTotal: 700,
      depositStatus: "PAID",
      depositAmount: 350,
      remainingBalance: 0,
    },
    pets: [
      { petId: "PET-1", name: "Mochi", petStatus: "ACTIVE" },
      { petId: "PET-2", name: "Pudding", petStatus: "ACTIVE" },
    ],
    payments: [
      { paymentId: "PAY-DEP", paymentType: "DEPOSIT", paymentStatus: "PAID", amount: 350, refundAmount: 0 },
      { paymentId: "PAY-BAL", paymentType: "BALANCE", paymentStatus: "PAID", amount: 500, refundAmount: 20 },
      { paymentId: "PAY-REF", paymentType: "REFUND", paymentStatus: "PAID", amount: 20, sourcePaymentId: "PAY-BAL" },
    ],
    adjustments: [
      { type: "SURCHARGE", amount: 50, description: "梳毛", petNameSnapshot: "Mochi", createdAt: "2026-11-01", createdByStaffName: "Alice" },
      { type: "SURCHARGE", amount: 50, description: "梳毛", petNameSnapshot: "Pudding", createdAt: "2026-11-01", createdByStaffName: "Alice" },
      { type: "SURCHARGE", amount: -30, description: "梳毛減項", petNameSnapshot: "Mochi", reason: "服務次數調整", createdByStaffName: "Alice" },
      { type: "REFUND", amount: -20, description: "部分退款", createdByStaffName: "Alice" },
    ],
  });
  assert.match(html, /持續調整訂單/);
  assert.match(html, /目前住宿總額（含人工附加費）<strong>HK\$770\.00/);
  assert.match(html, /多收／待人工退款 HK\$60\.00/);
  assert.match(html, /套用於 Mochi/);
  assert.match(html, /套用於 Pudding/);
  assert.match(html, /梳毛/);
  assert.match(html, /Alice/);
  assert.match(html, /bookingAdjustmentForm/);
  assert.match(html, /bookingRefundForm/);
  assert.match(html, /bookingPetCountForm/);
  assert.match(html, /尚可退 HK\$350\.00/);
  assert.match(html, /現金按金須使用獨立現金按金流程退還/);
});

test("refund choices use only paid accommodation payments and the stricter refund ledger", () => {
  const view = loadView();
  const source = { paymentId: "BAL-1", paymentType: "BALANCE", paymentStatus: "PAID", amount: 100, refundAmount: 40 };
  const html = view.render({
    booking: { bookingStatus: "CHECKED_OUT", species: "rabbit", roomTypeId: "DELUXE_SUITE", estimatedTotal: 700 },
    pets: [{ petId: "P1", name: "Mochi" }],
    payments: [
      source,
      { paymentId: "REF-1", paymentType: "REFUND", paymentStatus: "PAID", amount: 30, sourcePaymentId: "BAL-1" },
      { paymentId: "CASH-1", paymentType: "CASH_DEPOSIT", paymentStatus: "PAID", amount: 1000 },
    ],
    adjustments: [],
  });
  assert.equal(view.refundedFor(source, [source, { paymentType: "REFUND", amount: 30, sourcePaymentId: "BAL-1" }]), 40);
  assert.match(html, /尚可退 HK\$60\.00/);
  assert.match(html, /BAL-1/);
  assert.doesNotMatch(html, /CASH-1/);
  assert.doesNotMatch(html, /現金按金[^<]*CASH-1/);
});

test("new-pet fields follow species health rules and canonical minimum ages", () => {
  const view = loadView();
  const rabbit = view.newPetFields("rabbit", 0);
  const hamster = view.newPetFields("hamster", 1);
  assert.match(rabbit, /兔子／天竺鼠至少 3 個月/);
  assert.match(rabbit, /name="newPets\[0\]\.ageValue"[^>]*min="3"/);
  assert.match(rabbit, /name="newPets\[0\]\.recentSurgery"/);
  assert.match(rabbit, /name="newPets\[0\]\.pregnant"/);
  assert.match(hamster, /倉鼠至少 2 個月/);
  assert.match(hamster, /name="newPets\[1\]\.ageValue"[^>]*min="2"/);
  assert.match(hamster, /name="newPets\[1\]\.recentSurgery"/);
  assert.doesNotMatch(hamster, /sterilized|pregnant|fleaTreatment/);
});

test("pet limits are sourced from the accepted canonical pricing catalogue", () => {
  const view = loadView();
  assert.equal(view.roomLimit("rabbit", "DELUXE_SUITE"), 3);
  assert.equal(view.roomLimit("guineaPig", "DELUXE_SUITE"), 5);
  assert.equal(view.roomLimit("hamster", "HAMSTER_BOX"), 1);
});

test("cancelled bookings allow manual refunds but not new fee or pet changes", () => {
  const view = loadView();
  const html = view.render({
    booking: { bookingStatus: "CANCELLED", species: "rabbit", roomTypeId: "DELUXE_SUITE" },
    pets: [],
    payments: [{ paymentId: "CANCELLED-DEP", paymentType: "DEPOSIT", paymentStatus: "PAID", amount: 100, refundAmount: 0 }],
    adjustments: [{ type: "SURCHARGE", amount: 30, description: "既有項目" }],
  });
  assert.match(html, /已取消預約不接受新的費用或寵物數量更改/);
  assert.match(html, /既有項目/);
  assert.match(html, /bookingRefundForm/);
  assert.match(html, /CANCELLED-DEP/);
  assert.doesNotMatch(html, /bookingAdjustmentForm|bookingPetCountForm/);
});
