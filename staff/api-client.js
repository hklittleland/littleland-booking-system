/* LittleLand Staff TEST API adapter. */
(function (root) {
  "use strict";
  const ENDPOINT = "https://script.google.com/macros/s/AKfycby6ecJFVBzQHAwGXS9VZlMLOQ3q3DbZh12Ssjg5nxUBGn1S61Sq_MGzZpmIgNm5EQ_i/exec";
  const ACTIONS = Object.freeze({
    login: "staff.login", logout: "staff.logout", session: "staff.session", dashboard: "staff.dashboard",
    bookings: "staff.bookings", bookingDetail: "staff.bookingDetail", calendar: "staff.calendar", payments: "staff.payments",
    followups: "staff.followups", customers: "staff.customers", revenue: "staff.revenue", settings: "staff.settings",
    confirmData: "staff.confirmData", confirmDeposit: "staff.confirmDeposit", recordBalance: "staff.recordBalance",
    cashDepositCollect: "staff.cashDepositCollect", cashDepositUse: "staff.cashDepositUse", cashDepositRefund: "staff.cashDepositRefund",
    checkIn: "staff.checkIn", checkOut: "staff.checkOut", complete: "staff.complete", cancel: "staff.cancel", followup: "staff.followup", edit: "staff.edit",
    availability: "staff.availability", createBooking: "staff.createBooking", schedules: "staff.schedules", scheduleSave: "staff.scheduleSave", scheduleSwap: "staff.scheduleSwap", scheduleMonthSave: "staff.scheduleMonthSave", scheduleEmployeesSave: "staff.scheduleEmployeesSave",
    addSurcharge: "staff.surchargeAdd", reverseSurcharge: "staff.surchargeReverse", refundDeposit: "staff.depositRefund", earlyCheckout: "staff.earlyCheckout", petCountUpdate: "staff.petCountUpdate",
    extendStay: "staff.extendStay", internalAssignmentUpdate: "staff.internalAssignmentUpdate", internalAssignmentNoteUpdate: "staff.internalAssignmentNoteUpdate",
  });
  const LOGIN_RESPONSE_UNCERTAIN = "登入回應未確認；為避免建立重複 Session，系統不會自動重試。請先確認登入狀態；如仍未能登入，請聯絡管理員檢查 TEST Session。";
  async function request(action, payload, token) {
    const actionName = ACTIONS[action] || action;
    if (!Object.values(ACTIONS).includes(actionName)) throw new Error("不支援的 TEST API 操作。");
    const body = Object.assign({}, payload || {}, { action: actionName }); if (token) body.token = token;
    let response; const serializedBody = JSON.stringify(body), maxAttempts = actionName === ACTIONS.login ? 1 : 2;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try { response = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: serializedBody }); break; }
      catch (_) { if (attempt + 1 >= maxAttempts) { if (actionName === ACTIONS.login) throw new Error(LOGIN_RESPONSE_UNCERTAIN); throw new Error("無法連線 TEST API。輸入內容已保留，請稍後重試。"); } }
    }
    let result;
    try { result = await response.json(); } catch (_) { throw new Error(actionName === ACTIONS.login ? LOGIN_RESPONSE_UNCERTAIN : "TEST API 回應格式無效；沒有資料被確認成功。"); }
    if (!response.ok || !result || result.success !== true) {
      const failure = new Error((result && result.message) || "TEST API 操作失敗。"); failure.code = result && result.code; failure.data = result && result.data;
      failure.conflict = ["ROOM_NO_LONGER_AVAILABLE", "ROOM_CONFLICT", "ROOM_ALLOCATION_FAILED", "BOOKING_VERSION_CONFLICT"].includes(failure.code); throw failure;
    }
    return result.data || {};
  }
  root.StaffAPI = Object.freeze({ request, actions: ACTIONS, endpoint: ENDPOINT });
})(window);
