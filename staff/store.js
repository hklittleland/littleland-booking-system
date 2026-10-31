(function (root) {
  "use strict";
  const TOKEN_KEY = "littlelandStaffSessionToken";
  const NAV_KEY = "littlelandStaffNav";
  let token = sessionStorage.getItem(TOKEN_KEY) || "";
  const state = {
    records: [],
    payments: [],
    paymentData: null,
    followups: [],
    customers: [],
    calendar: null,
    calendarDate: null,
    summary: null,
    dashboard: null,
    detail: null,
    booking: null,
    revenue: null,
    settings: null,
    staff: null,
    notice: "",
    loading: false,
  };
  root.StaffStore = {
    state,
    get token() {
      return token;
    },
    setToken(value) {
      token = value || "";
      if (token) sessionStorage.setItem(TOKEN_KEY, token);
      else sessionStorage.removeItem(TOKEN_KEY);
    },
    saveNav(value) {
      sessionStorage.setItem(NAV_KEY, JSON.stringify(value));
    },
    getNav() {
      try {
        return JSON.parse(sessionStorage.getItem(NAV_KEY) || "{}");
      } catch (error) {
        return {};
      }
    },
    clear() {
      this.setToken("");
      sessionStorage.removeItem(NAV_KEY);
      Object.assign(state, {
        records: [],
        payments: [],
        paymentData: null,
        followups: [],
        customers: [],
        calendar: null,
        calendarDate: null,
        summary: null,
        dashboard: null,
        detail: null,
        booking: null,
        revenue: null,
        settings: null,
        staff: null,
      });
    },
  };
})(window);
