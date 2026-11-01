(function (root) {
  "use strict";
  const TOKEN_KEY = "littlelandStaffSessionToken", NAV_KEY = "littlelandStaffNav";
  let token = sessionStorage.getItem(TOKEN_KEY) || "";
  const state = {
    records: [], payments: [], paymentData: null, followups: [], customers: [], calendar: null,
    calendarDate: null, selectedCalendarDate: "", summary: null, dashboard: null, detail: null,
    booking: null, revenue: null, settings: null, staff: null, schedules: null, notice: "", loading: false,
    newBookingDraft: null, newBookingAvailability: null, newBookingIdempotencyKey: "", newBookingPayloadFingerprint: "",
  };
  root.StaffStore = {
    state,
    get token() { return token; },
    setToken(value) { token = value || ""; if (token) sessionStorage.setItem(TOKEN_KEY, token); else sessionStorage.removeItem(TOKEN_KEY); },
    saveNav(value) { sessionStorage.setItem(NAV_KEY, JSON.stringify(value)); },
    getNav() { try { return JSON.parse(sessionStorage.getItem(NAV_KEY) || "{}"); } catch (_) { return {}; } },
    clear() {
      this.setToken(""); sessionStorage.removeItem(NAV_KEY);
      Object.assign(state, { records: [], payments: [], paymentData: null, followups: [], customers: [], calendar: null, calendarDate: null, selectedCalendarDate: "", summary: null, dashboard: null, detail: null, booking: null, revenue: null, settings: null, schedules: null, staff: null, newBookingDraft: null, newBookingAvailability: null, newBookingIdempotencyKey: "", newBookingPayloadFingerprint: "" });
    },
  };
})(window);
