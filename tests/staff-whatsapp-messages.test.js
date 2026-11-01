"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Messages = require("../staff/whatsapp-messages.js");

const baseBooking = (overrides = {}) => ({
  bookingId: "TEST-LL-20261101-ABCDEFGH",
  bookingStatus: "PENDING_DEPOSIT",
  depositStatus: "UNPAID",
  parentName: "陳家長",
  phone: "91234567",
  roomTypeId: "DELUXE_ROOM",
  checkinDate: "2026-11-06",
  checkinTime: "14:30–15:30",
  checkoutDate: "2026-11-07",
  checkoutTime: "15:30–16:30",
  nights: 1,
  quantity: 2,
  estimatedTotal: 528,
  depositAmount: 89,
  cashDepositAmount: 2000,
  ...overrides,
});
const pets = [{ name: "兔兔", species: "rabbit" }, { name: "豆豆", species: "rabbit" }];

test("deposit arrangement and reminder use the short reference and clear payment amounts", () => {
  const messages = Messages.buildMessages({ booking: baseBooking(), pets, roomNames: { DELUXE_ROOM: "豪華房" } });
  assert.deepEqual(messages.map((item) => item.id), ["deposit-arrangement", "deposit-reminder"]);
  assert.ok(messages.every((item) => item.text.includes("ABCDEFGH")));
  assert.ok(messages.every((item) => !item.text.includes("TEST-LL-20261101")));
  assert.match(messages[0].text, /毛孩：🐰 兔兔、🐰 豆豆/);
  assert.match(messages[0].text, /現需支付訂金（基本房費 50%）：HK\$89/);
  assert.match(messages[0].text, /現金備用金／按金：HK\$2,000/);
  assert.match(messages[0].text, /\{付款連結\}/);
  assert.match(messages[0].text, /收到訂金後，我們仍會重新確認房態/);
  assert.match(messages[0].href, /^https:\/\/wa\.me\/85291234567\?text=/);
});

test("a deposit already recorded as paid does not produce a pay-now reminder", () => {
  const messages = Messages.buildMessages({ booking: baseBooking({ depositStatus: "PAID" }), pets });
  assert.deepEqual(messages.map((item) => item.id), ["deposit-received-pending-room"]);
  assert.match(messages[0].text, /房間仍待員工確認/);
  assert.doesNotMatch(messages[0].text, /請按以下資料安排訂金/);
});

test("confirmed wording is available only with paid deposit and physical room allocation", () => {
  const booking = baseBooking({ bookingStatus: "CONFIRMED", depositStatus: "PAID" });
  const safe = Messages.buildMessages({ booking, pets, allocatedRooms: ["S1"] });
  assert.deepEqual(safe.map((item) => item.id), ["booking-confirmed", "checkin-reminder"]);
  assert.match(safe[0].text, /房間已為您保留/);
  assert.match(safe[1].text, /成業街19-21號成業工業大廈13樓16室/);
  const noRoom = Messages.buildMessages({ booking, pets, allocatedRooms: [], roomConflict: true });
  assert.deepEqual(noRoom.map((item) => item.id), ["deposit-received-pending-room"]);
  assert.match(noRoom[0].text, /暫時不能承諾房間已保留/);
});

test("application-received template never says the booking is confirmed", () => {
  const messages = Messages.buildMessages({ booking: baseBooking({ bookingStatus: "PENDING_CONFIRMATION" }), pets });
  assert.equal(messages.length, 1);
  assert.match(messages[0].text, /只代表收到申請，房間尚未確認或保留/);
  assert.doesNotMatch(messages[0].text, /房間已為您保留/);
});

test("invalid phone still renders a copyable draft but no WhatsApp destination", () => {
  const booking = baseBooking({ phone: "TEST-0000" });
  const html = Messages.render({ booking, pets });
  assert.match(html, /複製草稿/);
  assert.match(html, /電話未有效，不能開啟 WhatsApp/);
  assert.doesNotMatch(html, /href="https:\/\/wa\.me/);
  assert.match(html, /不會自動發送/);
});

test("cancellation message reports only a manually recorded refund", () => {
  const booking = baseBooking({ bookingStatus: "CANCELLED" });
  const pending = Messages.buildMessages({ booking, pets });
  assert.match(pending[0].text, /退款將按寄養條款及員工覆核處理/);
  assert.doesNotMatch(pending[0].text, /退款紀錄已由員工確認/);
  const refunded = Messages.buildMessages({ booking, pets, payments: [{ paymentType: "REFUND", paymentStatus: "RECORDED" }] });
  assert.match(refunded[0].text, /退款紀錄已由員工確認/);
});
