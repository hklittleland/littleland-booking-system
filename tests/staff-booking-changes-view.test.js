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


test("each pet card exposes a fee form bound only to that pet ID", () => {
  const view = loadView();
  const html = view.renderPetAdjustmentControls({
    booking: { bookingStatus: "CONFIRMED", nights: 2 },
    pet: { petId: "PET-1", name: "Mochi" },
    adjustments: [
      { petId: "PET-1", petNameSnapshot: "Mochi", description: "每日梳毛", amount: 100, reason: "照顧需要", status: "RECORDED", createdByStaffName: "Yip" },
      { petId: "PET-2", petNameSnapshot: "Pudding", description: "餵藥", amount: 160, reason: "另一隻毛孩", status: "RECORDED" },
    ],
  });
  assert.match(html, /data-pet-adjustment-form/);
  assert.match(html, /data-pet-id="PET-1"/);
  assert.match(html, /data-pet-name="Mochi"/);
  assert.match(html, /只會套用到 Mochi/);
  assert.match(html, /每日餵藥 1 次 · HK\$80 × 晚數/);
  assert.match(html, /每日餵藥 2 次 · HK\$150 × 晚數/);
  assert.match(html, /每日梳毛/);
  assert.match(html, /Yip/);
  assert.doesNotMatch(html, /Pudding|PET-2|另一隻毛孩/);
});

test("per-pet fee presets use the approved fixed prices multiplied by the actual stay nights", () => {
  const view = loadView();
  assert.equal(view.feePreset("groom_once", 4).amount, 70);
  assert.equal(view.feePreset("groom_daily", 4).amount, 200);
  assert.equal(view.feePreset("medicine_once", 4).amount, 320);
  assert.equal(view.feePreset("medicine_twice", 4).amount, 600);
  assert.equal(view.feePreset("groom_daily", 4).formula, "HK$50 × 4 晚 = HK$200.00");
  assert.equal(view.feePreset("custom", 4), null);
});

test("per-pet fees are not editable for cancelled bookings and missing pet IDs are not guessed", () => {
  const view = loadView();
  const cancelled = view.renderPetAdjustmentControls({
    booking: { bookingStatus: "CANCELLED", nights: 1 },
    pet: { petId: "PET-1", name: "Mochi" },
    adjustments: [],
  });
  assert.doesNotMatch(cancelled, /data-pet-adjustment-form/);
  assert.match(cancelled, /已取消預約不可新增費用/);

  const missingId = view.renderPetAdjustmentControls({
    booking: { bookingStatus: "CONFIRMED", nights: 1 },
    pet: { name: "Legacy Pet" },
    adjustments: [],
  });
  assert.doesNotMatch(missingId, /data-pet-adjustment-form/);
  assert.match(missingId, /缺少寵物 ID/);
});
