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
  checkoutDate: "2026-11-08",
  checkoutTime: "15:30–16:30",
  nights: 2,
  quantity: 2,
  paymentLink: "https://pay.example.test/deposit/123",
  baseRoomFee: 356,
  extraPetFee: 100,
  weekendFee: 0,
  serviceFees: 0,
  totalSurcharges: 100,
  displaySurcharges: 100,
  estimatedTotal: 456,
  currentTotal: 456,
  depositAmount: 178,
  remainingBalance: 278,
  cashDepositAmount: 2000,
  ...overrides,
});
const pets = [{ name: "兔兔", species: "rabbit" }, { name: "豆豆", species: "rabbit" }];
const roomNames = { DELUXE_ROOM: "豪華房" };
const get = (messages, id) => messages.find((message) => message.id === id);

const exactPaymentTemplate = [
  "感謝您的預訂 ~ ",
  "👩🏻‍💻已確定資料如下:",
  "🐰兔兔、豆豆🛏️ 豪華房(共2晚)",
  "入住日期 *2026-11-06*  `_Check-In時間 🕰️14:30–15:30_`  ",
  "退房日期 *2026-11-08*  `_Check-Out時間 🕰️15:30–16:30_`  ",
  "> 請按時出席，並預留約15-30分鐘時間辦理相關手續。",
  "",
  "🛋️入住流程🌟",
  "▶️我們將為小動物進行簡單身體檢查，確保身體狀況適合寄養。如有異常情況。本公司擁有絕對酌情權，決定接受或拒絕任何動物入住。",
  "▶️家長需簽署【入住須知及寄養條款】及填寫【健康申報表】。",
  "▶️入住時需 *繳清房費尾數* 及 *所有額外收費*。",
  "▶️⭕ *提交 _現金HK$1,000_ 作備用金/按金*⭕",
  "",
  "❤️ *入住前準備* 🧡",
  "1️⃣請提供小動物清晰正面相，以作房卡之用。",
  "2️⃣請於入住前提供滴蝨証明，如相片(需顯示滴蝨日期)、醫療記錄等。",
  "3️⃣請保留小動物2-3天的💩💩，於入住時提供職員參考以辨健康狀況。",
  "-------------------------------------------------------------------------------------------------------------🖊️",
  "📋現附上【入住須知及寄養條款】以供參考 。",
  "💰費用詳情：",
  "基本房費：HK$356",
  "附加費合計：HK$100",
  "預計住宿總額：HK$456",
  "現需支付訂金（基本房費 50%）：HK$178",
  "入住時需繳付尾數：HK$278（入住時需付清尾數及所有額外收費）",
  "現金備用金／按金：HK$2,000（入住當日另備，不計入住宿總額）",
  "⚠️訂金不設退回／退款。",
  "💳 _*請透過此連結繳付50%住宿費訂金，作保留房間之用。*_",
  "https://pay.example.test/deposit/123",
  "請完成付款後於網站/WHATSAPP回傳付款憑證，Thanks ~",
].join("\n");

const exactCheckinReminder = [
  "🏡入住提示    | 🐰兔兔、豆豆📆  仲有2日就要入住酒店拉~🥰",
  "日期:2026-11-08",
  "入住時間:14:30–15:30 ",
  "***預留 _15-30分鐘_ 時間辦理入住手續及帶備按金 💵1000現金(*每位小動物)_***",
  "🐾地址:觀塘｜成業街19-21號成業工業大廈13樓16室",
  "",
  "💡小提示",
  "1.可帶同小動物平日使用的小毛巾/屋仔，增加安全感💕",
  "2. 請保留小動物2-3天的💩💩",
  "---------------------------------------------------------------------------------------------------",
  "*請於今日/明天提供滴蝨証明，如相片(需顯示滴蝨日期)、醫療記錄等。*",
  "*＊如將自行準備用品，請再告知物品內容（如水樽、廁所等）**",
].join("\n");

test("always returns the same five templates, with payment arrangement enabled only for unpaid PENDING_DEPOSIT", () => {
  const messages = Messages.buildMessages({ booking: baseBooking(), pets, roomNames });
  assert.deepEqual(messages.map((message) => message.id), [
    "deposit-arrangement", "checkin-reminder", "deposit-received", "booking-cancelled", "early-checkout",
  ]);
  assert.equal(messages.length, 5);
  assert.equal(get(messages, "deposit-arrangement").eligible, true);
  assert.equal(get(messages, "deposit-arrangement").copyable, true);
  assert.equal(get(messages, "deposit-arrangement").openable, true);
  assert.equal(get(messages, "deposit-arrangement").text, exactPaymentTemplate);
  assert.doesNotMatch(get(messages, "deposit-arrangement").text, /ABCDEFGH|TEST-LL-20261101/);
});

test("the check-in reminder is available exactly two days before a confirmed, paid and allocated booking", () => {
  const messages = Messages.buildMessages({
    booking: baseBooking({ bookingStatus: "CONFIRMED", depositStatus: "PAID", checkinDate: "2026-11-08" }),
    pets,
    payments: [{ paymentType: "DEPOSIT", paymentStatus: "PAID", amount: 350 }],
    roomNames,
    allocatedRooms: ["S1"],
    todayISO: "2026-11-06",
  });
  const reminder = get(messages, "checkin-reminder");
  assert.equal(reminder.eligible, true);
  assert.equal(reminder.text, exactCheckinReminder);
});

test("the three short status messages exactly match the supplied literal templates", () => {
  const confirmed = Messages.buildMessages({
    booking: baseBooking({ bookingStatus: "CONFIRMED", depositStatus: "PAID" }),
    pets,
    allocatedRooms: ["S1"],
  });
  assert.equal(get(confirmed, "deposit-received").text, [
    "✅ 訂金已收到，謝謝！",
    "房間已為您保留。",
    "入住日期：2026-11-06",
    "如有任何問題，歡迎聯絡我們～",
  ].join("\n"));

  const cancelled = Messages.buildMessages({ booking: baseBooking({ bookingStatus: "CANCELLED" }), pets });
  assert.equal(get(cancelled, "booking-cancelled").text, [
    "已為您取消預訂。",
    "如已支付訂金，將按條款處理退款。",
    "如有疑問，歡迎聯絡我們～",
  ].join("\n"));

  const early = Messages.buildMessages({
    booking: baseBooking({ bookingStatus: "CHECKED_OUT", checkoutDate: "2026-11-08", actualCheckoutDate: "2026-11-07" }),
    pets,
    adjustments: [{ type: "REFUND", amount: -125, reason: "提早退房退款", status: "RECORDED" }],
  });
  assert.equal(get(early, "early-checkout").eligible, true);
  assert.equal(get(early, "early-checkout").text, [
    "已為您安排提早退房。",
    "原退房日期：2026-11-08",
    "新退房日期：2026-11-07",
    "退款金額：HK$125",
    "如有疑問，歡迎聯絡我們～",
  ].join("\n"));
});

test("ineligible messages stay visible with reasons and never claim deposit or room status falsely", () => {
  const pending = Messages.buildMessages({
    booking: baseBooking({ bookingStatus: "PENDING_CONFIRMATION" }),
    pets,
  });
  assert.equal(pending.length, 5);
  assert.ok(pending.every((message) => message.eligible === false));
  assert.match(get(pending, "deposit-arrangement").reason, /待付訂金/);
  assert.match(get(pending, "deposit-received").reason, /已確認/);

  const paidButNoRoom = Messages.buildMessages({
    booking: baseBooking({ bookingStatus: "CONFIRMED", depositStatus: "PAID" }),
    pets,
    allocatedRooms: [],
    roomConflict: true,
    todayISO: "2026-11-04",
  });
  assert.equal(get(paidButNoRoom, "deposit-received").eligible, false);
  assert.match(get(paidButNoRoom, "deposit-received").reason, /分配實體房間/);
  assert.equal(get(paidButNoRoom, "checkin-reminder").eligible, false);
});

test("the reminder is blocked outside its literal two-day window and cancelled wording only appears on CANCELLED", () => {
  const threeDays = Messages.buildMessages({
    booking: baseBooking({ bookingStatus: "CONFIRMED", depositStatus: "PAID", checkinDate: "2026-11-08" }),
    pets,
    allocatedRooms: ["S1"],
    todayISO: "2026-11-05",
  });
  assert.equal(get(threeDays, "checkin-reminder").eligible, false);
  assert.match(get(threeDays, "checkin-reminder").reason, /剛好 2 日/);
  assert.equal(get(threeDays, "booking-cancelled").eligible, false);

  const cancelled = Messages.buildMessages({ booking: baseBooking({ bookingStatus: "CANCELLED" }), pets });
  assert.equal(get(cancelled, "booking-cancelled").eligible, true);
});

test("missing payment link or early-refund amount remains editable but blocks copying and opening", () => {
  const unpaid = Messages.buildMessages({ booking: baseBooking({ paymentLink: "" }), pets, roomNames });
  const payment = get(unpaid, "deposit-arrangement");
  assert.match(payment.text, /\{付款連結\}/);
  assert.equal(payment.copyable, false);
  assert.equal(payment.openable, false);
  const html = Messages.render({ booking: baseBooking({ paymentLink: "" }), pets, roomNames });
  assert.match(html, /data-wa-payment-link/);
  assert.match(html, /付款連結未填妥前不能複製或開啟 WhatsApp/);
  assert.match(html, /data-wa-open role="button" aria-disabled="true"/);
  const insecure = get(Messages.buildMessages({ booking: baseBooking({ paymentLink: "http://pay.example.test/deposit" }), pets }), "deposit-arrangement");
  assert.equal(insecure.copyable, false);

  const early = Messages.buildMessages({
    booking: baseBooking({ bookingStatus: "CHECKED_OUT", actualCheckoutDate: "2026-11-07" }),
    pets,
  });
  const refund = get(early, "early-checkout");
  assert.equal(refund.eligible, true);
  assert.match(refund.text, /\{退款金額\}/);
  assert.equal(refund.copyable, false);
});

test("an invalid phone permits copying a complete eligible message but blocks WhatsApp opening", () => {
  const messages = Messages.buildMessages({
    booking: baseBooking({ bookingStatus: "CANCELLED", phone: "TEST-0000" }),
    pets,
  });
  const cancelled = get(messages, "booking-cancelled");
  assert.equal(cancelled.copyable, true);
  assert.equal(cancelled.openable, false);
  const html = Messages.render({ booking: baseBooking({ bookingStatus: "CANCELLED", phone: "TEST-0000" }), pets });
  assert.match(html, /固定顯示五款核准模板/);
  assert.match(html, /data-wa-card/);
  assert.match(html, /電話格式未確認/);
  assert.doesNotMatch(html, /href="https:\/\/wa\.me/);
});

test("pet names are HTML-escaped in editable drafts while status templates remain all visible", () => {
  const html = Messages.render({
    booking: baseBooking({ bookingStatus: "PENDING_DEPOSIT" }),
    pets: [{ name: "<img src=x onerror=alert(1)>", species: "hamster" }],
    roomNames,
  });
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.equal((html.match(/data-wa-card/g) || []).length, 5);
});


test("renders a directly clickable wa.me anchor only when the payment draft is complete", () => {
  const html = Messages.render({ booking: baseBooking(), pets, roomNames });
  assert.match(html, /<a class="btn" data-wa-open href="https:\/\/wa\.me\/85291234567\?text=/);
  assert.match(html, /target="_blank" rel="noopener noreferrer" aria-disabled="false">開啟 WhatsApp<\/a>/);
  assert.match(html, /data-wa-payment-link/);
});

test("payment-link input updates the draft and unlocks copy/open controls after valid HTTPS is entered", () => {
  const handlers = {};
  const draft = {
    value: "Pay here: {付款連結}",
    addEventListener(type, fn) { handlers.draft = fn; },
    focus() {}, select() {}, setSelectionRange() {},
  };
  const paymentInput = {
    value: "",
    addEventListener(type, fn) { handlers.payment = fn; },
  };
  const copyButton = { disabled: true, addEventListener() {} };
  const openButton = {
    attrs: {},
    addEventListener() {},
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    getAttribute(name) { return this.attrs[name] || null; },
  };
  const help = { textContent: "" };
  const nodes = { "[data-wa-draft]": draft, "[data-wa-copy]": copyButton, "[data-wa-open]": openButton, "[data-wa-payment-link]": paymentInput, "[data-wa-help]": help };
  const card = {
    dataset: { waEligible: "true", waPhone: "85291234567", waReason: "", waRequiresPaymentLink: "true" },
    querySelector(selector) { return nodes[selector] || null; },
  };
  Messages.bind({ querySelectorAll() { return [card]; } });
  assert.equal(copyButton.disabled, true);
  assert.equal(openButton.getAttribute("aria-disabled"), "true");
  paymentInput.value = "https://pay.example.test/checkout";
  handlers.payment();
  assert.match(draft.value, /https:\/\/pay\.example\.test\/checkout/);
  assert.doesNotMatch(draft.value, /\{付款連結\}/);
  assert.equal(copyButton.disabled, false);
  assert.equal(openButton.getAttribute("aria-disabled"), "false");
  assert.match(openButton.getAttribute("href"), /https:\/\/wa\.me\/85291234567\?text=/);
});

test("iPhone Safari copy fallback selects the draft when clipboard permissions are unavailable", async () => {
  let legacyCalls = 0;
  let focusCalls = 0;
  const fakeRoot = {
    navigator: { clipboard: { writeText: () => Promise.reject(new Error("denied")) } },
    document: { execCommand: () => { legacyCalls += 1; return false; } },
  };
  const fakeDraft = {
    value: "LittleLand WhatsApp draft",
    focus() { focusCalls += 1; },
    select() {},
    setSelectionRange() {},
  };
  const result = await Messages.copyDraft(fakeRoot, fakeDraft);
  assert.deepEqual(result, { copied: false, selected: true });
  assert.equal(legacyCalls, 1);
  assert.ok(focusCalls >= 2);
});
