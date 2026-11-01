(function (root, factory) {
  "use strict";
  const api = factory(root && root.LittleLandPricing);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LittleLandExtensionView = api;
})(typeof window !== "undefined" ? window : globalThis, function (defaultPricing) {
  "use strict";
  const array = (value) => Array.isArray(value) ? value : [];
  const truthy = (value) => value === true || ["true", "1", "yes"].includes(String(value || "").toLowerCase());
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const money = (value) => "HK$" + (Number(value || 0)).toLocaleString("en-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dateOnly = (value) => String(value || "").slice(0, 10);

  function nightsBetween(start, end) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end <= start) return 0;
    const a = start.split("-").map(Number), b = end.split("-").map(Number);
    return (Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000;
  }

  function addDays(date, days) {
    const parts = dateOnly(date).split("-").map(Number);
    if (parts.length !== 3 || !parts.every(Number.isFinite)) return "";
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days)).toISOString().slice(0, 10);
  }

  function serviceIds(booking) {
    const services = [];
    if (truthy(booking.groomingOnce)) services.push("GROOMING_ONCE");
    if (truthy(booking.groomingDaily)) services.push("GROOMING_DAILY");
    if (String(booking.medicine || "none") === "once") services.push("MEDICINE_ONCE");
    if (String(booking.medicine || "none") === "twice") services.push("MEDICINE_TWICE");
    if (truthy(booking.earlyCheckin)) services.push("EARLY_CHECKIN");
    if (truthy(booking.lateCheckout)) services.push("LATE_CHECKOUT");
    return services;
  }

  function adjustmentTotal(bookingId, adjustments) {
    return array(adjustments).filter((entry) => String(entry.bookingId) === String(bookingId) && ["SURCHARGE", "REVERSAL"].includes(String(entry.type)))
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  }

  function netPaid(bookingId, payments) {
    return array(payments).filter((payment) => String(payment.bookingId) === String(bookingId) && payment.paymentStatus === "PAID" &&
      ["DEPOSIT", "BALANCE", "ADJUSTMENT", "REFUND"].includes(String(payment.paymentType)))
      .reduce((sum, payment) => sum + (payment.paymentType === "REFUND" ? -1 : 1) * Number(payment.amount || 0), 0);
  }

  function preview(options, newCheckoutDate, pricingApi) {
    const o = options || {}, booking = o.booking || {}, pricing = pricingApi || o.pricing || defaultPricing;
    const oldCheckout = dateOnly(booking.checkoutDate);
    const nextCheckout = dateOnly(newCheckoutDate);
    const addedNights = nightsBetween(oldCheckout, nextCheckout);
    if (!addedNights) return { ok: false, message: "請選擇晚於目前退房日的有效日期。" };
    if (!pricing || typeof pricing.calculatePricing !== "function") return { ok: false, message: "費用計算模組暫時未能載入，請重新整理頁面。" };

    let quote;
    try {
      quote = pricing.calculatePricing({
        species: String(booking.species || ""),
        roomId: String(booking.roomTypeId || ""),
        checkin: dateOnly(booking.checkinDate),
        checkout: nextCheckout,
        quantity: Number(booking.quantity),
        services: serviceIds(booking),
      });
    } catch (error) {
      return { ok: false, message: error && error.message ? error.message : "無法重新計算住宿費用。" };
    }

    const entries = array(o.adjustments).filter((entry) => String(entry.bookingId) === String(booking.bookingId));
    const previousManualTotal = adjustmentTotal(booking.bookingId, entries);
    let recurringDelta = 0;
    entries.filter((entry) => entry.type === "SURCHARGE" && String(entry.billingBasis || "").toUpperCase() === "PER_NIGHT").forEach((source) => {
      const reversed = entries.filter((entry) => entry.type === "REVERSAL" && String(entry.reversesAdjustmentId || "") === String(source.adjustmentId))
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
      const openAmount = Number(source.amount || 0) + reversed;
      if (Math.abs(openAmount) < 0.005) return;
      const rate = Number(source.unitRate);
      if (!Number.isFinite(rate) || rate === 0) return;
      recurringDelta += rate * quote.nights - openAmount;
    });
    const nextManualTotal = previousManualTotal + recurringDelta;
    const total = Number(quote.estimatedTotal || 0) + nextManualTotal;
    const paid = netPaid(booking.bookingId, o.payments);
    const depositRecorded = String(booking.depositStatus || "") === "PAID" || array(o.payments).some((payment) =>
      String(payment.bookingId) === String(booking.bookingId) && payment.paymentType === "DEPOSIT" && payment.paymentStatus === "PAID");
    const deposit = depositRecorded ? Number(booking.depositAmount || 0) : Number(quote.depositAmount || 0);
    const remaining = Math.max(0, total - paid - (depositRecorded ? 0 : deposit));
    return {
      ok: true,
      quote,
      oldCheckout,
      newCheckoutDate: nextCheckout,
      addedNights,
      addedBaseRoomFee: Number(quote.roomPrice || 0) * addedNights,
      previousManualTotal,
      nextManualTotal,
      total,
      paid,
      deposit,
      remaining,
      cashDeposit: Number(booking.cashDepositAmount || quote.cashDeposit || 0),
    };
  }

  function roomsFor(booking) {
    if (Array.isArray(booking.allocatedRoomIds)) return booking.allocatedRoomIds.map(String);
    try {
      const parsed = JSON.parse(String(booking.allocatedRoomIdsJson || "[]"));
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (error) { return []; }
  }

  function render(options) {
    const o = options || {}, b = o.booking || {}, status = String(b.bookingStatus || "").toUpperCase();
    const active = ["CONFIRMED", "CHECKED_IN"].includes(status);
    const boundary = dateOnly(b.extensionStartDate);
    const checkout = dateOnly(b.checkoutDate);
    const hasExtension = Boolean(boundary && nightsBetween(boundary, checkout) > 0);
    const assignment = String(b.internalAssignment || (hasExtension ? "ORIGINAL_ROOM" : ""));
    const roomIds = roomsFor(b);
    const roomLabel = (o.roomNames && o.roomNames[b.roomTypeId]) || b.roomTypeId || "未設定";
    const arrangement = assignment === "EXT"
      ? "EXT 延期客／實際房間由員工安排"
      : roomIds.length ? "原實體房 " + roomIds.join("＋") : "尚未分配實體房";
    const currentManual = adjustmentTotal(b.bookingId, o.adjustments);
    const currentTotal = Number(b.estimatedTotal || 0) + currentManual;
    const paid = netPaid(b.bookingId, o.payments);
    const extensionNights = hasExtension ? nightsBetween(boundary, checkout) : 0;
    const accumulatedExtensionFee = extensionNights * Number(b.roomPrice || 0);
    const latestExtensionFrom = dateOnly(b.lastExtensionFromDate || boundary);
    const latestExtensionNights = Number(b.lastExtensionAddedNights || extensionNights);
    const latestExtensionFee = Number(b.lastExtensionAddedBaseRoomFee || (latestExtensionNights * Number(b.roomPrice || 0)));
    const pending = o.pending ? " disabled" : "";
    const draft = o.draft || {};
    const extensionDraft = draft.extend || {};
    const assignmentDraft = draft.assignment || {};
    const noteDraft = draft.note || {};
    const note = String(b.internalAssignmentNote || "");
    const currentAssignmentValue = assignment === "EXT" ? "EXT" : "ORIGINAL_ROOM";
    const detail = hasExtension
      ? `<dl class="extension-summary"><div><dt>原訂房型／收費房型</dt><dd>${esc(roomLabel)}</dd></div><div><dt>目前內部安排</dt><dd><strong class="${assignment === "EXT" ? "extension-ext-badge" : "extension-room-badge"}">${esc(arrangement)}</strong></dd></div><div><dt>首次延期前退房日</dt><dd>${esc(boundary)}</dd></div><div><dt>最近一次延期前退房日</dt><dd>${esc(latestExtensionFrom)}</dd></div><div><dt>新退房日期</dt><dd>${esc(checkout)}</dd></div><div><dt>本次新增晚數</dt><dd>${latestExtensionNights} 晚</dd></div><div><dt>本次新增基本房費</dt><dd>${money(latestExtensionFee)}</dd></div><div><dt>累計延期晚數</dt><dd>${extensionNights} 晚</dd></div><div><dt>延期期間基本房費</dt><dd>${money(accumulatedExtensionFee)}</dd></div><div><dt>目前住宿總額（含有效人工調整）</dt><dd>${money(currentTotal)}</dd></div><div><dt>已收住宿款</dt><dd>${money(paid)}</dd></div><div><dt>待收尾數</dt><dd>${money(b.remainingBalance || 0)}</dd></div><div><dt>現金備用金／按金（延期不變）</dt><dd>${money(b.cashDepositAmount || 0)}</dd></div></dl>`
      : `<p class="muted">尚未延期。原訂房型 ${esc(roomLabel)} 同時作為收費房型；任何免費升級只記錄於內部備註，不會改動價格。</p>`;
    const extensionAssignment = String(extensionDraft.internalAssignment || currentAssignmentValue);
    const extensionForm = active
      ? `<form id="stayExtensionForm" class="field extension-form"><h3>延長住宿</h3><label for="extensionNewCheckout">新退房日期</label><input id="extensionNewCheckout" name="newCheckoutDate" type="date" min="${esc(addDays(checkout, 1))}" value="${esc(extensionDraft.newCheckoutDate || "")}" required${pending}><label for="extensionAssignment">延期期間內部安排</label><select id="extensionAssignment" name="internalAssignment"${pending}><option value="ORIGINAL_ROOM"${extensionAssignment === "ORIGINAL_ROOM" ? " selected" : ""}>保留原實體房（系統會重新檢查房態）</option><option value="EXT"${extensionAssignment === "EXT" ? " selected" : ""}>轉入 EXT 延期虛擬房（實際房間由員工安排）</option></select><p class="muted">收費房型維持 ${esc(roomLabel)}。若延期期間不能使用原房，可選 EXT；EXT 不佔實體房、不設容量上限，也不會出現在客人可選房型。</p><label for="extensionReason">延長原因</label><textarea id="extensionReason" name="reason" rows="2" maxlength="500" required${pending}>${esc(extensionDraft.reason || "")}</textarea><label for="extensionInternalNote">內部備註（選填）</label><textarea id="extensionInternalNote" name="internalAssignmentNote" rows="2" maxlength="1000"${pending}>${esc(extensionDraft.internalAssignmentNote == null ? note : extensionDraft.internalAssignmentNote)}</textarea><div class="extension-preview" data-extension-preview aria-live="polite">選擇新退房日期後，將按原收費房型及現有 Pricing Engine 即時計算費用。保留原房時，提交仍會由伺服器重新檢查最新房態。</div><button class="btn" type="submit"${pending}>確認延長住宿</button></form>`
      : `<p class="notice">只有已確認或入住中的預約可以延長住宿。</p>`;
    const assignmentValue = String(assignmentDraft.internalAssignment || currentAssignmentValue);
    const assignmentForm = hasExtension && active
      ? `<form id="internalAssignmentForm" class="field extension-form"><h3>更改延期內部安排</h3><label for="internalAssignmentChoice">實際安排模式</label><select id="internalAssignmentChoice" name="internalAssignment"${pending}><option value="${currentAssignmentValue}"${assignmentValue === currentAssignmentValue ? " selected" : ""}>目前：${esc(assignment === "EXT" ? "EXT 延期虛擬房" : "原實體房")}</option><option value="${currentAssignmentValue === "EXT" ? "ORIGINAL_ROOM" : "EXT"}"${assignmentValue !== currentAssignmentValue ? " selected" : ""}>${currentAssignmentValue === "EXT" ? "轉回原實體房（需重新檢查房態）" : "轉入 EXT 延期虛擬房"}</option></select><label for="assignmentChangeReason">更改原因</label><textarea id="assignmentChangeReason" name="reason" rows="2" maxlength="500" required${pending}>${esc(assignmentDraft.reason || "")}</textarea><button class="btn secondary" type="submit"${pending}>更新內部安排</button></form>` : "";
    const noteValue = noteDraft.note == null ? note : String(noteDraft.note);
    const noteReason = String(noteDraft.reason || "更新延期內部備註");
    const noteForm = hasExtension && active
      ? `<form id="internalAssignmentNoteForm" class="field extension-form"><h3>內部備註</h3><label for="internalAssignmentNote">現場安排／升級原因（只供員工）</label><textarea id="internalAssignmentNote" name="note" rows="3" maxlength="1000"${pending}>${esc(noteValue)}</textarea><label for="internalNoteReason">備註變更原因</label><input id="internalNoteReason" name="reason" type="text" maxlength="500" value="${esc(noteReason)}" required${pending}><button class="btn secondary" type="submit"${pending}>儲存內部備註</button></form>` : "";
    return `<section class="card extension-card" aria-labelledby="extension-title"><h2 id="extension-title">延長住宿及內部安排</h2><p class="extension-current"><strong>目前安排：</strong>${esc(arrangement)}　<strong>收費房型：</strong>${esc(roomLabel)}</p>${detail}${extensionForm}${assignmentForm}${noteForm}</section>`;
  }

  function bind(app, options) {
    if (!app) return;
    const form = app.querySelector("#stayExtensionForm");
    if (!form) return;
    const output = form.querySelector("[data-extension-preview]");
    const checkoutInput = form.elements.newCheckoutDate;
    function refreshPreview() {
      if (!output || !checkoutInput || !checkoutInput.value) {
        if (output) output.textContent = "選擇新退房日期後，將按原收費房型及現有 Pricing Engine 即時計算費用。保留原房時，提交仍會由伺服器重新檢查最新房態。";
        return;
      }
      const estimate = preview(options, checkoutInput.value);
      if (!estimate.ok) { output.textContent = estimate.message; return; }
      const assignment = form.elements.internalAssignment && form.elements.internalAssignment.value;
      const roomMessage = assignment === "EXT"
        ? "延期日安排：EXT（不佔實體房；實際位置由員工安排）"
        : "保留原房；提交時由伺服器重新檢查全部住宿日期，若房態衝突會拒絕並可改選 EXT";
      output.innerHTML = `<strong>延住費用預覽</strong><div>退房日期：${esc(estimate.oldCheckout)} → ${esc(estimate.newCheckoutDate)}（新增 ${estimate.addedNights} 晚）</div><div>新增基本房費：${money(estimate.addedBaseRoomFee)}</div><div>新住宿基本房費：${money(estimate.quote.baseRoomFee)}</div><div>新額外寵物／週末／服務費：${money(estimate.quote.totalSurcharges)}</div><div>有效人工附加費／減項：${money(estimate.nextManualTotal)}</div><div><strong>新住宿總額：${money(estimate.total)}</strong></div><div>訂金：${money(estimate.deposit)}（${String((options.booking || {}).depositStatus || "") === "PAID" ? "保留原已收訂金" : "按新基本房費重算 50%"}）</div><div>預計待收尾數：${money(estimate.remaining)}</div><div>現金按金：${money(estimate.cashDeposit)}（延期不變）</div><p class="muted">${esc(roomMessage)}。Pricing 使用原收費房型；一次性服務不會因延期重複收費。</p>`;
    }
    checkoutInput.addEventListener("input", refreshPreview);
    checkoutInput.addEventListener("change", refreshPreview);
    const assignment = form.elements.internalAssignment;
    if (assignment) assignment.addEventListener("change", refreshPreview);
  }

  return Object.freeze({
    render,
    bind,
    preview,
    nightsBetween,
    addDays,
    serviceIds,
    adjustmentTotal,
    netPaid,
  });
});
