/*
 * LittleLand staff calendar view
 *
 * Pure interface: renderCalendarView(options) -> HTML string. Does not read the
 * DOM or mutate options. options: {year, monthIndex (0-11), todayISO
 * (Asia/Hong_Kong YYYY-MM-DD), selectedDate (YYYY-MM-DD), bookings, schedules,
 * roomIds, roomNames}. Each booking may contain bookingId, bookingStatus,
 * checkinDate, checkoutDate, checkinTime, checkoutTime, species, petNames,
 * allocatedRoomIds, roomTypeId, followUpRequired, roomConflict. Schedules may
 * contain date, staffId, displayName, shiftTime and status (WORK/REST).
 * Weeks start Sunday. Only dates in the requested month are rendered; row count
 * is the minimum complete number of weeks (5 normally, 6 when needed). Checkout
 * is exclusive for occupancy. Pending bookings are never shown as allocated.
 * Exports as window.LittleLandCalendarView and CommonJS.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LittleLandCalendarView = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const SPECIES = { RABBIT: "🐰", GUINEA_PIG: "🐽", HAMSTER: "🐹" };
  const PENDING = new Set(["PENDING_CONFIRMATION", "PENDING_DEPOSIT"]);
  const OCCUPYING = new Set(["CONFIRMED", "CHECKED_IN"]);
  const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
  const array = (x) => Array.isArray(x) ? x : [];
  const truthy = (x) => x === true || String(x).toLowerCase() === "true";
  const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const pending = (b) => PENDING.has(String(b.bookingStatus || b.status || "").toUpperCase());
  const followup = (b) => truthy(b.followUpRequired) || truthy(b.roomConflict);
  const roomsFor = (b) => array(b.allocatedRoomIds).filter((x) => x != null && String(x).trim());

  function renderCalendarView(options) {
    const o = options || {}, year = Number(o.year), month = Number(o.monthIndex);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11)
      throw new TypeError("year and monthIndex (0-11) are required");
    const bookings = array(o.bookings), schedules = array(o.schedules);
    const offset = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const rows = Math.ceil((offset + days) / 7);
    const firstDate = iso(year, month, 1);
    const selected = o.selectedDate || (String(o.todayISO || "").slice(0, 7) === firstDate.slice(0, 7) ? o.todayISO : firstDate);
    const roomNames = o.roomNames || {};
    const roomIds = array(o.roomIds).map(String);
    const cells = [];
    for (let index = 0; index < rows * 7; index++) {
      const day = index - offset + 1;
      if (day < 1 || day > days) {
        cells.push('<div class="day-cell muted" aria-hidden="true"></div>');
        continue;
      }
      const date = iso(year, month, day), isToday = date === o.todayISO, isSelected = date === selected;
      const dayBookings = bookings.filter((b) => b && (
        b.checkinDate === date || b.checkoutDate === date ||
        (OCCUPYING.has(String(b.bookingStatus || b.status || "").toUpperCase()) && b.checkinDate <= date && b.checkoutDate > date)
      ));
      const summary = dayBookings.map((b) => {
        const status = String(b.bookingStatus || b.status || "").toUpperCase();
        const isPending = pending(b), isFollowup = followup(b), checkin = b.checkinDate === date, checkout = b.checkoutDate === date;
        const allocated = !isPending && OCCUPYING.has(status) && !checkout && b.checkinDate <= date && b.checkoutDate > date;
        const kind = isPending ? (isFollowup || status === "PENDING_DEPOSIT" ? "pending-followup" : "pending") :
          checkin ? "check-in" : checkout ? "check-out" : allocated ? "in-house" : isFollowup ? "followup" : "booking";
        const label = isPending ? (isFollowup || status === "PENDING_DEPOSIT" ? "待處理／跟進" : "待確認（不佔房）") :
          checkin ? "入住" : checkout ? "退房提醒" : allocated ? "入住中" : isFollowup ? "需跟進" : "預約";
        const physical = allocated ? roomsFor(b).filter((r) => !roomIds.length || roomIds.includes(String(r))) : [];
        const roomText = physical.length ? physical.map((r) => `${esc(r)}${b.roomTypeId ? ` · ${esc(roomNames[b.roomTypeId] || b.roomTypeId)}` : ""}`).join(", ") :
          (b.roomTypeId ? esc(roomNames[b.roomTypeId] || b.roomTypeId) : "未分配實體房");
        const species = SPECIES[String(b.species || "").toUpperCase()] || "";
        const pets = array(b.petNames).filter((x) => x != null && String(x)).map(esc).join("、");
        const text = `${species ? `${species} ` : ""}${pets || esc(b.bookingId || "預約")}`;
        const detail = esc(b.bookingId || "");
        return `<li class="calendar-booking ${kind}" data-detail="${detail}" aria-label="${esc(label)}：${text}"><span class="booking-label">${esc(label)}</span><span class="booking-room">${roomText}</span><span class="booking-pet">${text}</span></li>`;
      });
      const cap = 3, shown = summary.slice(0, cap).join("");
      const more = summary.length > cap ? `<li class="calendar-more" aria-label="另有 ${summary.length - cap} 項">＋${summary.length - cap} 項</li>` : "";
      const cls = ["day-cell", isToday ? "today" : "", isSelected ? "selected" : ""].filter(Boolean).join(" ");
      cells.push(`<div class="${cls}" data-date="${date}"${isToday ? ' aria-current="date"' : ""}${isSelected ? ' aria-selected="true"' : ' aria-selected="false"'}><span class="day-number">${day}${isToday ? '<span class="today-label">今天</span>' : ""}</span><ul class="day-summaries" aria-label="${esc(date)} 預約摘要">${shown}${more || (!summary.length ? '<li class="empty-summary">—</li>' : "")}</ul></div>`);
    }
    const pickedSchedules = schedules.filter((s) => s && s.date === selected);
    const scheduleHtml = pickedSchedules.length ? `<ul class="selected-schedules">${pickedSchedules.map((s) => {
      const off = String(s.status || "").toUpperCase() === "REST";
      return `<li class="schedule ${off ? "rest" : "work"}"><strong>${esc(s.displayName || s.staffId || "員工")}</strong><span>${esc(off ? "休息" : (s.shiftTime || "上班"))}</span></li>`;
    }).join("")}</ul>` : '<p class="schedule-empty">當日沒有員工班表</p>';
    return `<section class="staff-calendar" aria-label="${year}年${month + 1}月月曆"><div class="calendar-weekdays" role="row">${WEEKDAYS.map((d) => `<div class="weekday" role="columnheader">${d}</div>`).join("")}</div><div class="month-grid calendar-grid" role="grid" aria-label="${year}年${month + 1}月，星期日起始" data-month="${firstDate.slice(0, 7)}" data-rows="${rows}">${cells.join("")}</div><section class="calendar-schedules" aria-labelledby="selected-schedule-title"><h3 id="selected-schedule-title">${esc(selected)} · 員工班表</h3>${scheduleHtml}</section></section>`;
  }
  return { renderCalendarView };
});
