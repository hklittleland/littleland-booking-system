(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LittleLandScheduleView = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const arr = (value) => (Array.isArray(value) ? value : []);
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const pick = (object, keys) => {
    for (const key of keys) if (object && object[key] != null && object[key] !== "") return object[key];
    return "";
  };
  const isoDate = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    const match = String(value == null ? "" : value).match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : "";
  };
  const staffId = (person) => String(pick(person, ["staffId", "id", "email", "username"]));
  const staffName = (person) => String(pick(person, ["displayName", "name", "staffName"]) || "未命名員工");
  const staffOptions = (people) => people.map((person, index) => ({ id: staffId(person), name: staffName(person), label: `員工 ${String.fromCharCode(65 + index)}` }));

  function renderScheduleView({ year, monthIndex, staff, schedules, todayISO, draftAssignments, pending } = {}) {
    const y = Number(year), month = Number(monthIndex), people = arr(staff), rows = arr(schedules);
    if (!Number.isInteger(y) || !Number.isInteger(month) || month < 0 || month > 11) return '<section class="schedule-view"><p class="empty">月份資料無效</p></section>';
    const monthNumber = month + 1, monthKey = `${y}-${String(monthNumber).padStart(2, "0")}`;
    const daysInMonth = new Date(y, monthNumber, 0).getDate();
    const firstDay = new Date(y, month, 1).getDay();
    const rowCount = Math.ceil((firstDay + daysInMonth) / 7);
    const monthLabel = `${y}年${monthNumber}月`;
    const peopleOptions = staffOptions(people);
    const activeIds = new Set(peopleOptions.map((person) => person.id));
    const workByDate = new Map(), restByDate = new Map();
    rows.forEach((entry) => {
      const date = isoDate(pick(entry, ["workDate", "date", "scheduleDate", "dateISO"]));
      const id = String(pick(entry, ["staffId", "employeeId", "staff_id"]));
      const status = String(pick(entry, ["status", "type", "shiftType"])).toUpperCase();
      if (!date.startsWith(`${monthKey}-`) || !activeIds.has(id) || status !== "REST") return;
      if (!restByDate.has(date)) restByDate.set(date, new Set());
      restByDate.get(date).add(id);
    });
    rows.forEach((entry) => {
      const date = isoDate(pick(entry, ["workDate", "date", "scheduleDate", "dateISO"]));
      const id = String(pick(entry, ["staffId", "employeeId", "staff_id"]));
      const status = String(pick(entry, ["status", "type", "shiftType"])).toUpperCase();
      if (!date.startsWith(`${monthKey}-`) || !activeIds.has(id) || !["WORK", "SHIFT", "當值", "工作"].includes(status)) return;
      if (restByDate.get(date) && restByDate.get(date).has(id)) return;
      if (!workByDate.has(date)) workByDate.set(date, new Set());
      workByDate.get(date).add(id);
    });
    const draft = draftAssignments && typeof draftAssignments === "object" ? draftAssignments : {};
    const selections = {};
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${monthKey}-${String(day).padStart(2, "0")}`;
      const assigned = Array.from(workByDate.get(date) || []);
      selections[date] = Object.prototype.hasOwnProperty.call(draft, date) ? String(draft[date] || "") : assigned.length === 1 ? assigned[0] : "";
    }
    const staffLegend = peopleOptions.length
      ? `<ul class="schedule-staff-legend">${peopleOptions.map((person) => `<li><span class="schedule-staff-short">${esc(person.label)}</span><span>${esc(person.name)}</span></li>`).join("")}</ul>`
      : '<p class="empty">沒有有效員工資料，無法編輯本月排班。</p>';
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    const cells = weekdays.map((day) => `<div class="schedule-weekday" role="columnheader">${day}</div>`);
    for (let index = 0; index < rowCount * 7; index += 1) {
      const day = index - firstDay + 1;
      if (day < 1 || day > daysInMonth) {
        cells.push('<div class="schedule-day schedule-day--outside" aria-hidden="true"></div>');
        continue;
      }
      const date = `${monthKey}-${String(day).padStart(2, "0")}`;
      const assignedIds = Array.from(workByDate.get(date) || []);
      const conflict = assignedIds.length > 1;
      const chosen = selections[date];
      const selectedPerson = peopleOptions.find((person) => person.id === chosen);
      const isToday = date === isoDate(todayISO);
      const options = `<option value=""${chosen ? "" : " selected"}>未安排</option>${peopleOptions.map((person) => `<option value="${esc(person.id)}"${person.id === chosen ? " selected" : ""}>${esc(person.label)} · ${esc(person.name)}</option>`).join("")}`;
      const selectControl = peopleOptions.length >= 2 && peopleOptions.length <= 3
        ? `<label class="sr-only" for="schedule-${date}">${date} 當值員工</label><select id="schedule-${date}" class="schedule-day-select" data-schedule-day data-schedule-day-date="${date}" aria-label="${date} 選擇當值員工" ${pending ? "disabled" : ""}>${options}</select>`
        : '<span class="schedule-disabled-cell" aria-label="需要兩至三位有效排班員工">—</span>';
      cells.push(`<article class="schedule-day${isToday ? " schedule-day--today" : ""}${conflict ? " schedule-day--conflict" : ""}" data-schedule-date="${date}"><header class="schedule-day__header"><time datetime="${date}">${day}</time>${isToday ? '<span class="schedule-today-label">今天</span>' : ""}</header>${conflict ? '<p class="schedule-conflict-note">需選一位</p>' : selectedPerson ? `<p class="schedule-current-name">${esc(selectedPerson.name)}</p>` : '<p class="schedule-current-name schedule-current-name--none">休息／未安排</p>'}${selectControl}</article>`);
    }
    const counts = new Map(peopleOptions.map((person) => [person.id, 0]));
    Object.values(selections).forEach((id) => { if (counts.has(id)) counts.set(id, counts.get(id) + 1); });
    const summary = peopleOptions.length
      ? `<section class="schedule-summary"><h3>本月當值日數</h3><ul>${peopleOptions.map((person) => `<li><span>${esc(person.label)} · ${esc(person.name)}</span><strong>${counts.get(person.id)} 日</strong></li>`).join("")}<li><span>未安排／兩位休息</span><strong>${Object.values(selections).filter((id) => !id).length} 日</strong></li></ul></section>`
      : "";
    const rosterReady = peopleOptions.length >= 2 && peopleOptions.length <= 3;
    const staffCountNotice = !rosterReady ? '<p class="notice warning">請先在「設定／登出」設定 2–3 位排班員工名稱。</p>' : "";
    return `<section class="schedule-view"><header class="schedule-view__header"><div><h2>${monthLabel}員工排班</h2><p class="meta">每天直接選擇排班員工姓名；未安排表示當日所有有效員工均休息。</p></div></header>${staffLegend}${staffCountNotice}<form id="scheduleMonthForm" data-schedule-year="${y}" data-schedule-month="${monthNumber}"><div class="schedule-month-grid" role="grid" aria-label="${monthLabel}排班月曆">${cells.join("")}</div>${summary}<div class="schedule-month-actions"><button class="btn" type="submit" ${!rosterReady || pending ? "disabled" : ""}>${pending ? "正在儲存…" : "儲存本月排班"}</button><p class="meta">一次保存整月選擇；修改前的其他月份資料不會更動。</p></div></form></section>`;
  }

  return Object.freeze({ renderScheduleView });
});
