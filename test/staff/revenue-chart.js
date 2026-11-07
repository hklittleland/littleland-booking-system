(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LittleLandRevenueChart = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const fields = [
    ["accommodationRevenue", "住宿預訂金額"],
    ["collected", "實際收款"],
    ["deposits", "已收訂金"],
    ["balances", "已收尾數"],
    ["surcharges", "附加費"],
    ["refunds", "退款"],
  ];
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
  const numberOf = (value) => {
    const number = value == null || value === "" ? 0 : Number(value);
    return Number.isFinite(number) ? number : 0;
  };
  const amount = (value) => `HK$${numberOf(value).toLocaleString("zh-HK", { maximumFractionDigits: 2 })}`;
  const valueOf = (row, key) => numberOf(row && row[key]);

  function renderRevenueChart(data, selectedMonth) {
    const isArray = Array.isArray(data);
    const rows = isArray
      ? data
      : Array.isArray(data && data.months)
        ? data.months
        : Array.isArray(data && data.series)
          ? data.series
          : [];
    const monthPattern = /^\d{4}-\d{2}$/;
    const inputYear = !isArray && data && data.year != null ? String(data.year) : "";
    const firstDatedRow = rows.find((row) => row && monthPattern.test(String(row.month || "")));
    const yearCandidate = inputYear || String(firstDatedRow && firstDatedRow.month || "").slice(0, 4);
    const year = /^\d{4}$/.test(yearCandidate) ? yearCandidate : "";
    const activeMonth = selectedMonth != null
      ? String(selectedMonth)
      : (!isArray && data && data.month != null ? String(data.month) : "");
    const byMonth = new Map(rows.map((row) => [String(row && row.month != null ? row.month : ""), row]));
    const labels = rows.map((row, index) => String(row && row.month != null ? row.month : `第 ${index + 1} 月`));
    const series = [
      { key: "accommodationRevenue", label: "住宿預訂金額", color: "#176b87", dash: "" },
      { key: "collected", label: "實際收款／實收款（按付款日，不含現金按金）", color: "#b54708", dash: "7 4" },
    ];
    const values = series.map((item) => rows.map((row) => valueOf(row, item.key)));
    const max = Math.max(1, ...values.flat());
    const width = 720, height = 300, left = 82, right = 16, top = 24, bottom = 56;
    const plotW = width - left - right, plotH = height - top - bottom;
    const x = (index) => left + (rows.length === 1 ? plotW / 2 : index * plotW / Math.max(1, rows.length - 1));
    const y = (value) => top + plotH - (value / max) * plotH;
    const grid = Array.from({ length: 4 }, (_, index) => {
      const value = max * index / 3, gy = y(value);
      return `<g><line x1="${left}" y1="${gy}" x2="${width - right}" y2="${gy}" stroke="#d9e2e8"/><text x="${left - 8}" y="${gy + 4}" text-anchor="end" fill="#52616b" font-size="11">${escapeHtml(amount(value))}</text></g>`;
    }).join("");
    const paths = series.map((item, seriesIndex) => {
      const coords = values[seriesIndex].map((value, index) => `${x(index)},${y(value)}`);
      const points = values[seriesIndex].map((value, index) =>
        `<circle cx="${x(index)}" cy="${y(value)}" r="3.5" fill="${item.color}"><title>${escapeHtml(labels[index])}：${escapeHtml(item.label)} ${escapeHtml(amount(value))}</title></circle>`
      ).join("");
      return `<g aria-label="${escapeHtml(item.label)}"><polyline fill="none" stroke="${item.color}" stroke-width="3" ${item.dash ? `stroke-dasharray="${item.dash}"` : ""} points="${coords.join(" ")}"/>${points}</g>`;
    }).join("");
    const ticks = labels.map((label, index) =>
      `<text x="${x(index)}" y="${height - 28}" text-anchor="middle" fill="#33434d" font-size="11">${escapeHtml(label)}</text>`
    ).join("");
    const legend = series.map((item) =>
      `<span class="revenue-legend-item"><i aria-hidden="true" style="background:${item.color}"></i>${escapeHtml(item.label)}</span>`
    ).join("");
    const total = (key) => rows.reduce((sum, row) => sum + valueOf(row, key), 0);
    const annual = !isArray && data && data.annual && typeof data.annual === "object" ? data.annual : {};
    const annualValue = (key) => Object.prototype.hasOwnProperty.call(annual, key) ? numberOf(annual[key]) : total(key);
    const summary = fields.map(([key, label]) =>
      `<div class="revenue-summary"><span>${label}</span><strong>${escapeHtml(amount(annualValue(key)))}</strong></div>`
    ).join("");

    let monthSelector = "";
    if (year) {
      const monthButtons = Array.from({ length: 12 }, (_, index) => {
        const key = `${year}-${String(index + 1).padStart(2, "0")}`;
        const chosen = key === activeMonth;
        return `<button type="button" class="revenue-month-option" data-revenue-month="${key}" aria-pressed="${chosen ? "true" : "false"}">${key}</button>`;
      }).join("");
      monthSelector = `<nav class="revenue-month-selector" aria-label="${escapeHtml(year)} 年月份選擇">${monthButtons}</nav>`;
    }

    const selectedRow = byMonth.get(activeMonth) || null;
    const metrics = selectedRow
      ? `<section class="revenue-selected-month" aria-labelledby="revenue-selected-title"><h3 id="revenue-selected-title">${escapeHtml(activeMonth)} 月份摘要</h3><p>住宿預訂金額按入住月份統計；實際收款按付款日統計。現金按金不計入收入。</p><dl>${fields.map(([key, label]) => `<div><dt>${label}</dt><dd>${escapeHtml(amount(valueOf(selectedRow, key)))}</dd></div>`).join("")}<div><dt>住宿晚數</dt><dd>${escapeHtml(String(numberOf(selectedRow.lodgingNights != null ? selectedRow.lodgingNights : selectedRow.nights)))}</dd></div></dl></section>`
      : `<section class="revenue-selected-month" aria-labelledby="revenue-selected-title"><h3 id="revenue-selected-title">${escapeHtml(activeMonth || "月份")}月份摘要</h3><p>目前沒有該月份明細資料；現金按金不計入收入。</p></section>`;

    const tableHead = fields.map(([, label]) => `<th scope="col">${label}</th>`).join("");
    const tableRows = rows.map((row, index) =>
      `<tr><th scope="row">${escapeHtml(labels[index])}</th>${fields.map(([key]) => `<td>${escapeHtml(amount(valueOf(row, key)))}</td>`).join("")}</tr>`
    ).join("");
    const empty = rows.length ? "" : '<p>目前沒有月份營收資料。</p>';
    return `<section class="revenue-chart" aria-labelledby="revenue-chart-title"><h2 id="revenue-chart-title">${year ? `${escapeHtml(year)} 年營收` : "每月營收"}</h2>${empty}${monthSelector}<p id="revenue-chart-description">按月份比較住宿預訂金額與實際收款。住宿預訂金額按入住月份；實際收款按付款日；現金按金不計作收入；現金按金不計作住宿收入或實際收款。</p><div class="revenue-annual-summary" aria-label="年度營收摘要">${summary}</div>${metrics}<div style="display:flex;flex-wrap:wrap;gap:1rem" aria-label="圖例">${legend}</div><div style="width:100%;overflow-x:auto"><svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="revenue-svg-title revenue-svg-desc" style="display:block;width:100%;height:auto;min-width:480px"><title id="revenue-svg-title">每月住宿預訂金額及實際收款</title><desc id="revenue-svg-desc">${escapeHtml(labels.length)} 個月份；實線為住宿收入，虛線為實收款。住宿預訂金額按入住月份，實際收款按付款日統計，不包含現金按金。</desc>${grid}${paths}${ticks}</svg></div><div style="overflow-x:auto"><table><caption>每月營收明細（HK$）</caption><thead><tr><th scope="col">月份</th>${tableHead}</tr></thead><tbody>${tableRows}</tbody></table></div></section>`;
  }
  return { renderRevenueChart };
});
