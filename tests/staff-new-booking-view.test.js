"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const BookingForm = require("../staff/new-booking-form.js");
const BookingReference = require("../staff/booking-reference.js");

function loadView() {
  const window = {
    LittleLandStaffBookingForm: BookingForm,
    LittleLandBookingReference: BookingReference,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../staff/new-booking-view.js"), "utf8"), { window });
  return window.LittleLandStaffNewBookingView;
}

function nextWeekday(day) {
  const today = BookingForm.hongKongToday();
  const date = new Date(`${today}T00:00:00Z`);
  do { date.setUTCDate(date.getUTCDate() + 1); } while (date.getUTCDay() !== day);
  return date.toISOString().slice(0, 10);
}

const plusOneDay = (iso) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

test("Staff new booking starts without fabricated customer or pet details", () => {
  const view = loadView();
  const html = view.render({ draft: view.blankDraft(), availability: null, pending: false });
  assert.match(html, /沒有電話自動查找或預填/);
  assert.match(html, /data-term-index="5"/);
  assert.doesNotMatch(html, /未提供|TEST 家長|測試電話|sample@example\.com/);
  assert.doesNotMatch(html, /data-pet-field=/);
});

test("Staff booking summary displays canonical weekend, deposit, balance, and cash-deposit figures", () => {
  const view = loadView();
  const checkin = nextWeekday(5);
  const draft = {
    ...view.blankDraft(),
    checkin,
    checkout: plusOneDay(checkin),
    species: "rabbit",
    roomId: "DELUXE_ROOM",
    quantity: 1,
    pets: [{}],
  };
  const html = view.render({ draft, availability: { status: "AVAILABLE", message: "可預訂" }, pending: false });
  assert.match(html, /週末短住附加費/);
  assert.match(html, /HK\$250/);
  assert.match(html, /現需支付訂金（基本房費 50%）/);
  assert.match(html, /預計尾數（入住時繳付）/);
  assert.match(html, /現金備用金／按金（不計入住宿總額）/);
  assert.match(html, /HK\$1,000/);
});

test("hamster form omits sterilization, pregnancy, flea, and feeding-frequency controls", () => {
  const view = loadView();
  const draft = {
    ...view.blankDraft(), species: "hamster", roomId: "HAMSTER_BOX", quantity: 1,
    checkin: nextWeekday(2), checkout: plusOneDay(nextWeekday(2)), pets: [{}],
  };
  const html = view.render({ draft, availability: null, pending: false });
  assert.doesNotMatch(html, /是否已絕育|是否懷孕|杜蝨處理|每日餵食次數/);
  assert.match(html, /倉鼠採長擺糧/);
});

test("diet dropdowns render the matching food and hay brands for each species", () => {
  const view = loadView();
  const renderDiet = (species) => view.render({
    draft: { ...view.blankDraft(), species },
    availability: null,
    pending: false,
  });
  const rabbit = renderDiet("rabbit");
  assert.match(rabbit, /Oxbow 成兔糧/);
  assert.match(rabbit, /Momi T（成兔）/);
  assert.match(rabbit, /Momi A（幼兔）/);
  assert.match(rabbit, /Joy &amp; Fibre 1st cut/);
  assert.match(rabbit, /Momi 1st cut/);
  assert.match(rabbit, /Chewbo 1st cut/);
  const guineaPig = renderDiet("guineaPig");
  assert.match(guineaPig, /Oxbow 天竺鼠糧/);
  assert.match(guineaPig, /Momi 天竺鼠糧/);
  assert.match(guineaPig, /Chewbo 1st cut/);
  assert.doesNotMatch(guineaPig, /Momi A（幼兔）/);
  const hamster = renderDiet("hamster");
  assert.match(hamster, /BUNNY 倉鼠糧/);
  assert.doesNotMatch(hamster, /牧草（可留空）|每日餵食次數|Joy &amp; Fibre/);
});

test("rabbit form provides age in months/years and female pregnancy control", () => {
  const view = loadView();
  const draft = {
    ...view.blankDraft(), species: "rabbit", roomId: "DELUXE_ROOM", quantity: 1,
    checkin: nextWeekday(2), checkout: plusOneDay(nextWeekday(2)), pets: [{ sex: "female" }],
  };
  const html = view.render({ draft, availability: null, pending: false });
  assert.match(html, /最低入住年齡 3 個月/);
  assert.match(html, /value="month"/);
  assert.match(html, /value="year"/);
  assert.match(html, /是否懷孕/);
  assert.match(html, /最近 30 日是否接受過手術/);
});
