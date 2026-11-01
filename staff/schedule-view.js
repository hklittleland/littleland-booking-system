(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LittleLandScheduleView = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const arr = (x) => (Array.isArray(x) ? x : []);
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const pick = (obj, keys) => {
    for (const key of keys) if (obj && obj[key] != null && obj[key] !== "") return obj[key];
    return "";
  };
  const isoDate = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    const text = String(value == null ? "" : value);
    const match = text.match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : "";
  };
  const normalizedKind = (entry) => {
    const raw = String(pick(entry, ["type", "status", "scheduleType", "shiftType", "kind"])).toUpperCase();
    return /REST|OFF|休息/.test(raw) ? "rest" : /WORK|SHIFT|當值|工作/.test(raw) ? "work" : "work";
  };
  const timeText = (entry) => {
    const start = pick(entry, ["startTime", "shiftStart", "start", "timeStart"]);
    const end = pick(entry, ["endTime", "shiftEnd", "end", "timeEnd"]);
    if (start && end) return `${esc(start)}–${esc(end)}`;
    return esc(pick(entry, ["time", "hours", "shiftTime", "scheduleTime"]) || "");
  };
  function renderScheduleView({ year, monthIndex, staff, schedules, todayISO } = {}) {
    const y = Number(year), m = Number(monthIndex);
    if (!Number.isInteger(y) || !Number.isInteger(m) || m < 0 || m > 11) return '<section class="schedule-view"><p class="empty">月份資料無效</p></section>';
    const people = arr(staff), rows = arr(schedules), firstDay = new Date(y, m, 1).getDay(), daysInMonth = new Date(y, m + 1, 0).getDate();
    const rowCount = Math.ceil((firstDay + daysInMonth) / 7), monthLabel = `${y}年${m + 1}月`;
    const staffId = (person) => String(pick(person, ["staffId", "id", "email", "username", "displayName"]));
    const staffName = (person) => String(pick(person, ["displayName", "name", "staffName"]) || "未命名員工");
    const byDate = new Map(), counts = new Map(people.map((p) => [staffId(p), new Set()]));
    rows.forEach((entry) => {
      const date = isoDate(pick(entry, ["date", "scheduleDate", "dateISO", "workDate"]));
      if (!date || !date.startsWith(`${y}-${String(m + 1).padStart(2, "0")}-`)) return;
      const personId = String(pick(entry, ["staffId", "employeeId", "staff_id", "id"]));
      const person = people.find((p) => staffId(p) === personId || staffName(p) === String(pick(entry, ["displayName", "staffName", "name"])));
      if (!person) return;
      const item = { person, kind: normalizedKind(entry), time: timeText(entry) };
      if (!byDate.has(date)) byDate.set(date, new Map());
      const dayMap = byDate.get(date), key = staffId(person);
      if (!dayMap.has(key)) dayMap.set(key, []);
      dayMap.get(key).push(item);
    });
    for (const [date, dayMap] of byDate) for (const [id, entries] of dayMap) {
      if (entries.some((e) => e.kind === "rest")) continue;
      if (entries.some((e) => e.kind === "work")) counts.get(id)?.add(date);
    }
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    const cells = weekdays.map((d) => `<div class="schedule-weekday" role="columnheader">星期${d}</div>`);
    for (let i = 0; i < rowCount * 7; i++) {
      const day = i - firstDay + 1;
      if (day < 1 || day > daysInMonth) { cells.push('<div class="schedule-day schedule-day--outside" aria-hidden="true"></div>'); continue; }
      const date = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayMap = byDate.get(date) || new Map();
      const assignments = people.map((person) => {
        const entries = dayMap.get(staffId(person)) || [];
        if (!entries.length) return `<li class="schedule-assignment schedule-assignment--unscheduled"><span class="schedule-label">未排班</span><span class="schedule-staff">${esc(staffName(person))}</span></li>`;
        const rest = entries.some((e) => e.kind === "rest");
        const chosen = rest ? entries.filter((e) => e.kind === "rest") : entries.filter((e) => e.kind === "work");
        const type = rest ? "rest" : "work", label = rest ? "休息日" : "當值";
        const times = rest ? "" : chosen.map((e) => e.time).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join("、");
        return `<li class="schedule-assignment schedule-assignment--${type}"><span class="schedule-label">${label}</span><span class="schedule-staff">${esc(staffName(person))}</span>${times ? `<span class="schedule-time">${times}</span>` : ""}</li>`;
      }).join("");
      cells.push(`<article class="schedule-day${date === isoDate(todayISO) ? " schedule-day--today" : ""}" data-schedule-date="${date}" aria-label="${date}${date === isoDate(todayISO) ? " 今天" : ""}"><header class="schedule-day__header"><time datetime="${date}">${day}</time>${date === isoDate(todayISO) ? '<span class="schedule-today-label">今天（HKT）</span>' : ""}</header>${people.length ? `<ul class="schedule-assignments">${assignments}</ul>` : '<p class="schedule-empty">沒有員工資料</p>'}</article>`);
    }
    const summary = people.length ? `<section class="schedule-summary"><h3>月度當值日數</h3><ul>${people.map((p) => `<li><span>${esc(staffName(p))}</span><strong>${counts.get(staffId(p))?.size || 0} 日</strong></li>`).join("")}</ul></section>` : '<p class="empty schedule-empty-staff">沒有員工資料，無法顯示當值統計。</p>';
    return `<section class="schedule-view"><header class="schedule-view__header"><h2>${monthLabel}員工排班</h2></header>${!rows.length ? '<p class="empty schedule-empty-schedules">本月沒有排班資料；日期會標示為未排班。</p>' : ""}<div class="schedule-month-grid" role="grid" aria-label="${monthLabel}排班月曆">${cells.join("")}</div>${summary}</section>`;
  }
  return { renderScheduleView };
});
