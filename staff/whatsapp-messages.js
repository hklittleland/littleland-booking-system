(function (root, factory) {
  "use strict";
  const reference = root.LittleLandBookingReference || (typeof require === "function" ? require("./booking-reference.js") : null);
  const api = factory(reference);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LittleLandWhatsAppMessages = api;
})(typeof window !== "undefined" ? window : globalThis, function (Reference) {
  "use strict";

  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const amount = (value) => `HK$${Number(value || 0).toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const dateOnly = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    const match = String(value == null ? "" : value).match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : "日期待確認";
  };
  const timeSlot = (value) => {
    const match = String(value == null ? "" : value).match(/\d{2}:\d{2}(?:\s*[–-]\s*\d{2}:\d{2})?/);
    return match ? match[0].replace(/\s+/g, "") : "時間待確認";
  };
  const petIcon = (species) => ({ rabbit: "🐰", guineaPig: "🐽", hamster: "🐹" })[species] || "🐾";
  const normalizePhone = (value) => {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("00852")) digits = digits.slice(5);
    else if (digits.startsWith("852") && digits.length === 11) digits = digits.slice(3);
    return /^\d{8}$/.test(digits) ? digits : "";
  };
  const shortReference = (booking) => {
    const direct = String(booking && (booking.displayReference || booking.shortReference || booking.bookingReference) || "").trim();
    if (direct && direct.length <= 12) return direct;
    const id = String(booking && (booking.bookingId || booking.id) || "");
    const formatted = Reference && typeof Reference.format === "function" ? Reference.format(id) : "";
    return formatted && formatted.length <= 12 ? formatted : "編號待確認";
  };
  const petSummary = (pets) => (Array.isArray(pets) ? pets : []).map((pet) => `${petIcon(pet.species)} ${String(pet.name || pet.petName || "毛孩")}`).join("、") || "毛孩資料待確認";
  const listServices = (booking) => {
    const raw = booking && booking.serviceItemsJson;
    if (Array.isArray(raw)) return raw.map((item) => typeof item === "string" ? item : item.label || item.name || item.serviceName || "附加服務").join("、");
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((item) => typeof item === "string" ? item : item.label || item.name || item.serviceName || "附加服務").join("、");
      } catch (_) { /* keep the message safe when older rows contain non-JSON text */ }
    }
    return "按預約資料";
  };

  function buildMessages({ booking = {}, pets = [], payments = [], roomNames = {}, allocatedRooms = [], roomConflict = false } = {}) {
    const ref = shortReference(booking);
    const guest = String(booking.parentName || booking.customerName || "家長").trim() || "家長";
    const petNames = petSummary(pets);
    const room = roomNames[booking.roomTypeId] || booking.roomTypeId || "房型待確認";
    const nights = Number(booking.nights || 0);
    const checkin = `${dateOnly(booking.checkinDate)} ${timeSlot(booking.checkinTime)}`;
    const checkout = `${dateOnly(booking.checkoutDate)} ${timeSlot(booking.checkoutTime)}`;
    const currentTotal = Number(booking.estimatedTotal || 0) + Number(booking.manualAdjustmentTotal || 0);
    const deposit = Number(booking.depositAmount || 0);
    const cashDeposit = Number(booking.cashDepositAmount || (Number(booking.quantity || pets.length || 0) * 1000));
    const phone = normalizePhone(booking.phone);
    const phoneHref = phone ? `https://wa.me/852${phone}` : "";
    const hasRoom = booking.bookingStatus === "CONFIRMED" && String(booking.depositStatus || "").toUpperCase() === "PAID" && Array.isArray(allocatedRooms) && allocatedRooms.length > 0 && roomConflict !== true;
    const recordedRefund = (Array.isArray(payments) ? payments : []).some((payment) => String(payment.paymentType || "").toUpperCase() === "REFUND" && ["RECORDED", "SUCCESS", "PAID"].includes(String(payment.paymentStatus || "").toUpperCase()));
    const common = `預約編號：${ref}\n毛孩：${petNames}\n房型：${room}\n入住：${checkin}\n退房：${checkout}\n住宿晚數：${nights || "待確認"} 晚`;
    const greeting = `LittleLand 小寵物酒店\n${guest} 您好！`;
    const make = (id, label, text) => ({ id, label, text, href: phoneHref ? `${phoneHref}?text=${encodeURIComponent(text)}` : "", phone: phone ? `+852 ${phone}` : "未有有效香港電話" });
    const status = String(booking.bookingStatus || "").toUpperCase();
    const messages = [];

    if (status === "PENDING_CONFIRMATION") {
      messages.push(make("application-received", "預約申請已收到", `${greeting}\n\n我們已收到您的預約申請，會先核對資料及房態，再盡快回覆您。\n\n${common}\n\n此訊息只代表收到申請，房間尚未確認或保留。\nLittleLand 小寵物酒店`));
    }

    if (status === "PENDING_DEPOSIT" && String(booking.depositStatus || "").toUpperCase() !== "PAID") {
      const depositText = `${greeting}\n\n您的預約資料已收到，請按以下資料安排訂金：\n\n${common}\n預計住宿總額：${amount(currentTotal)}\n現需支付訂金（基本房費 50%）：${amount(deposit)}\n入住時繳付尾數及附加費；現金備用金／按金：${amount(cashDeposit)}（每隻 HK$1,000，不計入住宿總額）。\n\n訂金不設退款。可於此處補上人工確認的付款連結：{付款連結}\n\n收到訂金後，我們仍會重新確認房態；只有成功分配房間並確認預約後，房間才正式保留。\n\n請預留 15–30 分鐘辦理入住手續；入住時會進行健康檢查，並請確認已閱讀及同意寄養條款。\n\n${listServices(booking)}\n\n如有任何問題，歡迎回覆訊息。\nLittleLand 小寵物酒店`;
      messages.push(make("deposit-arrangement", "確認資料／訂金安排", depositText));
      messages.push(make("deposit-reminder", "溫馨提醒交訂金", `${greeting}\n\n溫馨提醒：我們正等候這筆預約的訂金。\n\n預約編號：${ref}\n寵物：${petNames}\n訂金：${amount(deposit)}（基本房費 50%）\n\n訂金不設退款；收到訂金後仍須重新確認房態，只有員工確認預約並分配房間後才正式保留。若已付款，請忽略此提醒並回覆付款資料。\n\n入住尾數及附加費於入住時收取；每隻 HK$1,000 現金備用金／按金不計入住宿總額。\nLittleLand 小寵物酒店`));
    }

    if (status === "PENDING_DEPOSIT" && String(booking.depositStatus || "").toUpperCase() === "PAID") {
      messages.push(make("deposit-received-pending-room", "已收到訂金／房間待確認", `${greeting}\n\n我們已記錄收到訂金，正重新確認房態及安排房間；房間仍待員工確認，尚未正式保留。員工會盡快聯絡您。\n\n${common}\nLittleLand 小寵物酒店`));
    }

    if (status === "CONFIRMED" && hasRoom) {
      messages.push(make("booking-confirmed", "預約已確認", `${greeting}\n\n您的預約已確認，房間已為您保留。\n\n${common}\n訂金：${amount(deposit)}\n預計尾數及附加費：入住時繳付\n每隻 HK$1,000 現金備用金／按金：入住當日準備，不計入住宿總額。\n\n請預留 15–30 分鐘辦理入住手續。\nLittleLand 小寵物酒店`));
      messages.push(make("checkin-reminder", "入住前兩日提醒", `${greeting}\n\n提醒您：您的入住日期為 ${dateOnly(booking.checkinDate)}（${timeSlot(booking.checkinTime)}），退房日期為 ${dateOnly(booking.checkoutDate)}（${timeSlot(booking.checkoutTime)}）。請預留 15–30 分鐘辦理入住；每隻 HK$1,000 現金按金請於入住時準備。\n\n入住前請提供清晰正面相、滴蝨證明及相關醫療紀錄，並保留 2–3 日糞便；亦可攜帶毛孩熟悉的用品。\n\n地址：觀塘｜成業街19-21號成業工業大廈13樓16室\n預約編號：${ref}\nLittleLand 小寵物酒店`));
    } else if (status === "CONFIRMED") {
      messages.push(make("deposit-received-pending-room", "房間仍待員工確認", `${greeting}\n\n我們已記錄收到訂金，但房間分配仍待員工確認，暫時不能承諾房間已保留；我們會盡快聯絡您。\n\n${common}\nLittleLand 小寵物酒店`));
    }

    if (status === "CANCELLED") {
      messages.push(make("cancellation-confirmed", "取消確認", `${greeting}\n\n您的預約已取消。\n\n${common}\n${recordedRefund ? "退款紀錄已由員工確認。" : "退款將按寄養條款及員工覆核處理；此訊息不代表退款已完成。"}\n\n如有任何疑問，歡迎聯絡我們。\nLittleLand 小寵物酒店`));
    }

    return messages;
  }

  function render(options = {}) {
    const messages = buildMessages(options);
    if (!messages.length) return '<section class="card whatsapp-message-panel"><h2>客人訊息</h2><p class="meta">此預約狀態目前沒有可用的訊息模板。</p></section>';
    return `<section class="card whatsapp-message-panel"><h2>客人訊息／WhatsApp 草稿</h2><p class="notice info">只會產生並開啟草稿，不會自動發送。請核對收件電話和內容後，再由員工在 WhatsApp 按「傳送」。</p><div class="whatsapp-template-list">${messages.map((message) => `<article class="whatsapp-template-card"><h3>${esc(message.label)}</h3><p class="meta">收件人：${esc(message.phone)} · 預約 ${esc(shortReference(options.booking || {}))}</p><details><summary>預覽訊息內容</summary><pre class="whatsapp-draft-text">${esc(message.text)}</pre></details><div class="action-grid"><button type="button" class="btn secondary" data-copy-whatsapp="${esc(encodeURIComponent(message.text))}">複製草稿</button>${message.href ? `<a class="btn" href="${esc(message.href)}" target="_blank" rel="noopener noreferrer">開啟 WhatsApp 草稿</a>` : '<button type="button" class="btn" disabled>電話未有效，不能開啟 WhatsApp</button>'}</div></article>`).join("")}</div></section>`;
  }

  return Object.freeze({ buildMessages, render, normalizePhone, shortReference });
});
