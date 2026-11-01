/*
 * LittleLand staff calendar view
 *
 * Pure interface: renderCalendarView(options) -> HTML string. Does not read the
 * DOM or mutate options. Weeks start Sunday; checkout is exclusive for occupancy.
 * Only CONFIRMED/CHECKED_IN occupy rooms. Pending bookings never occupy rooms.
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
  const PHYSICAL_ROOMS = ["S1", "S2", "S3", "A1", "A2", "A3", "B1", "B2", "C1", "F1"];
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
  const array = (x) => Array.isArray(x) ? x : [];
  const truthy = (x) => x === true || String(x).toLowerCase() === "true";
  const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const bookingStatus = (b) => String(b.bookingStatus || b.status || "").toUpperCase();
  const pending = (b) => PENDING.has(bookingStatus(b));
  const followup = (b) => truthy(b.followUpRequired) || truthy(b.roomConflict);
  const roomsFor = (b) => array(b.allocatedRoomIds).filter((x) => x != null && String(x).trim()).map(String);
  const speciesIcon = (b) => SPECIES[String(b.species || "").toUpperCase()] || "🐾";

  function renderRoomMatrix(year, month, days, todayISO, bookings, roomIds) {
    const dates = Array.from({ length: days }, (_, index) => iso(year, month, index + 1));
    const occupiedByRoomDate = new Map();
    const uncertainDates = new Set();
    const unallocatedBookings = [];
    array(bookings).forEach((booking) => {
      if (!booking || !OCCUPYING.has(bookingStatus(booking))) return;
      const start = String(booking.checkinDate || "").slice(0, 10);
      const end = String(booking.checkoutDate || "").slice(0, 10);
      const validDateRange = Boolean(start && end && end > start);
      const rawRooms = roomsFor(booking);
      const validRooms = rawRooms.filter((room) => roomIds.includes(room));
      const allocationUncertain = !validDateRange || !rawRooms.length || validRooms.length !== rawRooms.length;
      if (allocationUncertain) unallocatedBookings.push(booking);
      dates.forEach((date) => {
        if (validDateRange && (date < start || date >= end)) return;
        if (allocationUncertain) {
          uncertainDates.add(date);
          return;
        }
        validRooms.forEach((room) => {
          const key = `${room}|${date}`;
          const list = occupiedByRoomDate.get(key) || [];
          list.push(booking);
          occupiedByRoomDate.set(key, list);
        });
      });
    });

    const header = dates.map((date) => `<th scope="col" class="room-month-date${date === todayISO ? " is-today" : ""}" title="${esc(date)}">${Number(date.slice(-2))}</th>`).join("");
    const rows = roomIds.map((room) => {
      const cells = dates.map((date) => {
        if (uncertainDates.has(date)) {
          return `<td class="room-state room-state--unknown" title="${esc(date)}：有已確認／入住預約未有有效房號" aria-label="${esc(room)}，${esc(date)}，房態未能確認">?</td>`;
        }
        const occupants = occupiedByRoomDate.get(`${room}|${date}`) || [];
        if (occupants.length > 1) {
          return `<td class="room-state room-state--conflict" title="${esc(date)}：${esc(room)} 有多筆佔房預約" aria-label="${esc(room)}，${esc(date)}，房態衝突">!</td>`;
        }
        if (!occupants.length) {
          return `<td class="room-state room-state--free${date === todayISO ? " is-today" : ""}" title="${esc(room)} · ${esc(date)} · 空房" aria-label="${esc(room)}，${esc(date)}，空房">空</td>`;
        }
        const booking = occupants[0];
        const status = bookingStatus(booking);
        const label = status === "CHECKED_IN" ? "住" : "訂";
        const stateText = status === "CHECKED_IN" ? "入住中" : "已確認佔房";
        const petText = array(booking.petNames).filter(Boolean).join("、");
        const detail = String(booking.bookingId || "");
        const title = `${room} · ${date} · ${stateText}${petText ? ` · ${petText}` : ""}`;
        return `<td class="room-state room-state--${status === "CHECKED_IN" ? "in-house" : "booked"}${date === todayISO ? " is-today" : ""}" title="${esc(title)}" aria-label="${esc(title)}">${detail ? `<button type="button" class="room-state-link" data-detail="${esc(detail)}" aria-label="開啟 ${esc(title)}">${speciesIcon(booking)}${label}</button>` : `${speciesIcon(booking)}${label}`}</td>`;
      }).join("");
      return `<tr><th scope="row" class="room-month-room">${esc(room)}</th>${cells}</tr>`;
    }).join("");
    const warning = unallocatedBookings.length
      ? `<div class="room-month-warning" role="alert"><strong>房態未能完全確認：</strong>以下已確認／入住預約缺少有效日期或實體房號；日期不明時整月以「？」標示，請先核對。<div>${unallocatedBookings.map((booking) => `<button type="button" class="room-warning-link" data-detail="${esc(booking.bookingId || "")}">${esc(booking.bookingId || "預約未編號")} · ${esc(array(booking.petNames).join("、") || "寵物資料未載入")}</button>`).join("")}</div></div>`
      : "";
    return `<section class="room-month-overview" aria-labelledby="room-month-title"><h3 id="room-month-title">全部實體房 · ${year}年${month + 1}月</h3><p class="room-month-note">每行一間實體房、每欄一日；左右滑動查看整月。只計「已確認」及「入住中」佔房；待確認／待付訂金不佔房。S1–S3 為實體房，SS1／SSR1 為組合名稱，不會另列。</p><div class="room-month-legend" aria-label="房態圖例"><span class="legend-free">空 空房</span><span class="legend-booked">訂 已確認</span><span class="legend-in-house">住 入住中</span><span class="legend-conflict">! 衝突</span><span class="legend-unknown">? 未能確認</span></div>${warning}<div class="room-month-scroll" tabindex="0" aria-label="可左右滑動查看每天的房間狀態"><table class="room-month-table"><thead><tr><th scope="col" class="room-month-room room-month-room--head">實體房</th>${header}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }

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
    const requestedRooms = array(o.roomIds).map(String).filter((room) => PHYSICAL_ROOMS.includes(room));
    const roomIds = requestedRooms.length ? requestedRooms : PHYSICAL_ROOMS;
    const cells = [];
    for (let index = 0; index < rows * 7; index += 1) {
      const day = index - offset + 1;
      if (day < 1 || day > days) {
        cells.push('<div class="day-cell muted" aria-hidden="true"></div>');
        continue;
      }
      const date = iso(year, month, day), isToday = date === o.todayISO, isSelected = date === selected;
      const dayBookings = bookings.filter((b) => b && (
        b.checkinDate === date || b.checkoutDate === date ||
        (OCCUPYING.has(bookingStatus(b)) && b.checkinDate <= date && b.checkoutDate > date)
      ));
      const summary = dayBookings.map((b) => {
        const status = bookingStatus(b);
        const isPending = pending(b), isFollowup = followup(b), checkin = b.checkinDate === date, checkout = b.checkoutDate === date;
        const allocated = !isPending && OCCUPYING.has(status) && !checkout && b.checkinDate <= date && b.checkoutDate > date;
        const kind = isPending ? (isFollowup || status === "PENDING_DEPOSIT" ? "pending-followup" : "pending") :
          checkin ? "check-in" : checkout ? "check-out" : allocated ? "in-house" : isFollowup ? "followup" : "booking";
        const label = isPending ? (isFollowup || status === "PENDING_DEPOSIT" ? "待處理／跟進" : "待確認（不佔房）") :
          checkin ? "入住" : checkout ? "退房提醒" : allocated ? "入住中" : isFollowup ? "需跟進" : "預約";
        const physical = allocated ? roomsFor(b).filter((r) => roomIds.includes(String(r))) : [];
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
    const roomMatrix = renderRoomMatrix(year, month, days, o.todayISO, bookings, roomIds);
    return `<section class="staff-calendar" aria-label="${year}年${month + 1}月月曆"><div class="calendar-weekdays" role="row">${WEEKDAYS.map((d) => `<div class="weekday" role="columnheader">${d}</div>`).join("")}</div><div class="month-grid calendar-grid" role="grid" aria-label="${year}年${month + 1}月，星期日起始" data-month="${firstDate.slice(0, 7)}" data-rows="${rows}">${cells.join("")}</div>${roomMatrix}<section class="calendar-schedules" aria-labelledby="selected-schedule-title"><h3 id="selected-schedule-title">${esc(selected)} · 員工班表</h3>${scheduleHtml}</section></section>`;
  }
  return { renderCalendarView };
});
