(function (root) {
  "use strict";
  const allowed = [
    "dashboard",
    "calendar",
    "bookings",
    "followups",
    "payments",
    "customers",
    "revenue",
    "settings",
    "detail",
  ];
  function current() {
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    const page = parts[0] || "dashboard";
    let id = "";
    try {
      id = decodeURIComponent(parts[1] || "");
    } catch (error) {
      id = "";
    }
    return { page: allowed.includes(page) ? page : "dashboard", id };
  }
  function go(page, id) {
    location.hash = `#/${page}${id ? `/${encodeURIComponent(id)}` : ""}`;
  }
  root.StaffRouter = { current, go };
})(window);
