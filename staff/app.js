(function () {
  "use strict";
  const app = document.getElementById("app"),
    store = StaffStore;
  const navs = [
    ["dashboard", "概覽", "⌂"],
    ["calendar", "房間月曆", "▦"],
    ["bookings", "預訂", "▤"],
    ["followups", "待跟進", "♧"],
    ["payments", "付款", "$"],
    ["customers", "客戶", "♡"],
    ["revenue", "基本營收", "↗"],
    ["settings", "設定／登出", "⚙"],
    ["schedule", "員工排班", "▦"],
    ["new-booking", "新增預約", "+"],
  ];
  const rooms = ["S1", "S2", "S3", "A1", "A2", "A3", "B1", "B2", "C1", "F1"];
  let errorText = "",
    busy = false,
    pendingAction = false,
    loadSequence = 0;
  const readCache = new Map(),
    readCacheTtlMs = 5000;
  const esc = (v) =>
    String(v == null || v === "" ? "—" : v).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const escValue = StaffEditFormUtils.escapeFormValue;
  const arr = (v) => (Array.isArray(v) ? v : []);
  const get = (o, ...ks) => {
    for (const k of ks) if (o && o[k] != null && o[k] !== "") return o[k];
    return "—";
  };
  const amount = (v) =>
    v == null || v === "" ? "—" : `HK$${Number(v).toLocaleString("zh-HK")}`;
  const fullIdOf = (b) => String(get(b, "bookingId", "id")),
    shortRef = (b) => window.LittleLandBookingReference ? window.LittleLandBookingReference.format(fullIdOf(b)) : fullIdOf(b),
    idOf = (b) => get(b, "bookingId", "id"),
    statusOf = (b) => get(b, "bookingStatus", "status");
  const labels = {
    PENDING_CONFIRMATION: "待確認",
    PENDING_DEPOSIT: "待付訂金",
    CONFIRMED: "已確認",
    CHECKED_IN: "已入住",
    CHECKED_OUT: "已退房",
    COMPLETED: "已完成",
    CANCELLED: "已取消",
  };
  const roomNames = {
    DELUXE_ROOM: "豪華房",
    PRIVATE_SUITE: "獨立套房",
    DELUXE_SUITE: "豪華套房",
    VERY_DELUXE_SUITE: "非常豪華套房",
    STANDARD_ROOM: "標準房",
    HAMSTER_BOX: "整理箱",
    OWN_CAGE: "自備籠",
  };
  const speciesNames = {
    RABBIT: "兔子",
    GUINEA_PIG: "天竺鼠",
    HAMSTER: "倉鼠",
  };
  function formatStaffTime(value) {
    const text = value instanceof Date ? value.toISOString() : String(value ?? "");
    if (!text || text === "—") return text;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const range = text.match(
      /^(\d{1,2}:\d{2})(?::\d{2})?\s*[–-]\s*(\d{1,2}:\d{2})(?::\d{2})?$/,
    );
    if (range) return `${range[1]}–${range[2]}`;
    const clock = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (clock) return `${clock[1].padStart(2, "0")}:${clock[2]}`;
    if (!/^\d{4}-\d{2}-\d{2}T/.test(text)) return text;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`;
  }
  const friendly = (v) => {
    const translated = ({
      male: "男孩子",
      female: "女孩子",
      month: "月",
      year: "歲",
      true: "是",
      false: "否",
      YES: "是",
      NO: "否",
      yes: "是",
      no: "否",
    })[String(v)];
    if (translated !== undefined) return translated;
    return typeof v === "string" || v instanceof Date ? formatStaffTime(v) : v;
  };
  const status = (v) => {
    const className =
      ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "COMPLETED"].includes(v)
        ? "status-green"
        : v === "PENDING_DEPOSIT"
          ? "status-red"
          : v === "PENDING_CONFIRMATION"
            ? "status-orange"
            : v === "CANCELLED"
              ? "status-gray"
              : "status-purple";
    return `<span class="badge ${className}">${esc(labels[v] || v)}</span>`;
  };
  const truthy = (v) => v === true || String(v).toLowerCase() === "true";
  function depositBadge(b) {
    if (String(b?.depositStatus || "").toUpperCase() === "PAID")
      return '<span class="badge status-green">已收訂金</span>';
    return "";
  }
  function followupBadge(b) {
    return b?.roomConflict === true || truthy(b?.followUpRequired)
      ? '<span class="badge status-red">需跟進</span>'
      : "";
  }
  function toast(t) {
    const e = document.getElementById("toast");
    if (e) {
      e.textContent = t;
      e.classList.add("show");
      setTimeout(() => e.classList.remove("show"), 3500);
    }
  }
  function clearPrivate() {
    readCache.clear();
    store.clear();
    store.state.followupDraft = "";
    store.state.depositConflictBookingId = "";
  }
  function pageCacheKey(page) {
    const current = StaffRouter.current();
    if (page === "detail") return `detail:${String(current.id || "")}`;
    if (page === "calendar" || page === "payments" || page === "revenue") {
      const d = page === "calendar" ? store.state.calendarDate || new Date() : new Date();
      return `${page}:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    return page;
  }
  function handleAuth(e) {
    if (
      [
        "STAFF_AUTH_REQUIRED",
        "STAFF_AUTH_INVALID",
        "UNAUTHENTICATED",
        "SESSION_INVALID",
        "SESSION_EXPIRED",
      ].includes(e.code)
    ) {
      clearPrivate();
      errorText = "登入已失效，請重新登入。";
      return true;
    }
    return false;
  }
  function login() {
    app.innerHTML = `<main class="login-wrap"><section class="login-card"><div class="brand">LittleLand<small>STAFF · TEST 環境</small></div><h1>員工登入</h1><p>登入後才會向 TEST API 讀取後台資料。</p>${errorText ? `<div class="error" role="alert">${esc(errorText)}</div>` : ""}<form id="loginForm"><div class="field"><label for="username">員工帳號</label><input id="username" name="username" autocomplete="username" required></div><div class="field"><label for="password">密碼</label><input id="password" name="password" type="password" autocomplete="current-password" required></div><button class="btn" ${busy ? "disabled" : ""}>${busy ? "登入中…" : "登入 TEST 員工後台"}</button></form></section></main>`;
    document.getElementById("loginForm").onsubmit = async (e) => {
      e.preventDefault();
      if (busy) return;
      busy = true;
      const f = e.currentTarget;
      try {
        const d = await StaffAPI.request("login", {
          username: f.username.value,
          password: f.password.value,
        });
        store.setToken(d.token);
        store.state.staff = d.staff || {};
        errorText = "";
        if (StaffRouter.current().page !== "dashboard") {
          history.replaceState(null, "", "#/dashboard");
        }
        await loadPageData("dashboard");
      } catch (x) {
        errorText = x.message;
      } finally {
        busy = false;
        paint();
      }
    };
  }
  function shell(page, body) {
    const buttons = navs
      .map(
        ([p, t, i]) =>
          `<button class="${p === page ? "active" : ""}" data-go="${p}"><span>${esc(i)}</span> ${esc(t)}</button>`,
      )
      .join("");
    app.innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand">LittleLand<small>員工營運台 · TEST</small></div><nav class="side-nav">${buttons}</nav><div class="side-foot meta">資料只來自 TEST API<br><button class="btn ghost" data-logout>登出</button></div></aside><main><header class="topbar"><div class="brand">LittleLand<small>${esc(page)} · TEST</small></div><button class="btn ghost" data-logout>登出</button></header><nav class="bottom-nav">${navs
      .map(
        ([p, t, i]) =>
          `<button class="${p === page ? "active" : ""}" data-go="${p}"><span class="ico">${esc(i)}</span>${esc(t)}</button>`,
      )
      .join(
        "",
      )}</nav><div class="content">${store.state.loading ? '<div class="loading" role="status">正在載入 TEST 資料…</div>' : ""}${errorText ? `<div class="error" role="alert">${esc(errorText)}<br><button class="btn secondary" data-retry>重試載入</button></div>` : ""}${body}</div></main></div>`;
    app
      .querySelectorAll("[data-go]")
      .forEach((x) => (x.onclick = () => StaffRouter.go(x.dataset.go)));
    app.querySelectorAll("[data-logout]").forEach((x) => (x.onclick = logout));
    app
      .querySelectorAll("[data-detail]")
      .forEach(
        (x) => (x.onclick = () => StaffRouter.go("detail", x.dataset.detail)),
      );
  }
  const head = (t, s = "") =>
    `<div class="page-head"><div><h1>${esc(t)}</h1>${s ? `<p>${esc(s)}</p>` : ""}</div>${t === "Booking Detail" ? '<button type="button" class="btn secondary" data-print-booking>列印／另存 PDF</button>' : ""}</div>`;
  const stat = (t, v) =>
    `<div class="stat"><strong>${esc(v == null ? "—" : v)}</strong><span>${esc(t)}</span></div>`;
  function conflictNotice(b) {
    if (!b || b.roomConflict !== true) return "";
    const paid = b.depositStatus === "PAID";
    return `<span class="room-conflict-warning" role="alert"><strong>房間衝突</strong> — ${paid ? "訂金已收" : "訂金尚未確認已收"}；目前沒有可用房間。未有房間分配，預約未確認。請員工手動聯絡客人跟進；請勿承諾房間。</span>`;
  }
  function card(b) {
    return `<button class="booking-card" data-detail="${esc(fullIdOf(b))}"><span class="title">🐾 ${esc(shortRef(b))} <small>${esc(fullIdOf(b))}</small> · ${esc(get(b, "customerName", "parentName"))}</span>${conflictNotice(b)}<span class="meta">${esc(get(b, "petNames"))}　${esc(get(b, "checkinDate", "checkInDate"))} ${esc(friendly(get(b, "checkinTime")))} → ${esc(get(b, "checkoutDate", "checkOutDate"))} ${esc(friendly(get(b, "checkoutTime")))}</span><br>${status(statusOf(b))} ${depositBadge(b)} ${followupBadge(b)} <span class="meta">${esc(roomNames[b.roomTypeId] || get(b, "roomTypeId"))}</span></button>`;
  }
  const list = (a, e = "目前沒有資料") =>
    arr(a).length
      ? arr(a).map(card).join("")
      : `<div class="empty">${esc(e)}</div>`;
  async function loadPageData(page, options = {}) {
    if (!store.token) return;
    const map = {
        dashboard: "dashboard",
        bookings: "bookings",
        calendar: "calendar",
        followups: "followups",
        payments: "payments",
        customers: "customers",
        revenue: "revenue",
        settings: "settings",
        detail: "bookingDetail",
        schedule: "schedules",
      },
      action = map[page];
    if (!action) return;
    const cacheKey = pageCacheKey(page),
      cachedAt = readCache.get(cacheKey);
    if (!options.force && cachedAt && Date.now() - cachedAt < readCacheTtlMs) {
      store.state.loading = false;
      errorText = "";
      return;
    }
    const sequence = ++loadSequence;
    store.state.loading = true;
    errorText = "";
    paint();
    try {
      let p = {};
      if (page === "detail") p = { bookingId: StaffRouter.current().id };
      if (page === "schedule") { const d=store.state.scheduleDate||new Date(); p.month=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
      if (page === "revenue") {
        p.year = store.state.revenueYear || "2026";
        p.month = store.state.revenueMonth || `${p.year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      }
      if (page === "calendar") {
        const d = store.state.calendarDate || new Date();
        p.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }
      if (page === "payments") {
        const d = new Date();
        p.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }
      const d = await StaffAPI.request(action, p, store.token);
      if (sequence !== loadSequence) return;
      if (page === "dashboard") {
        store.state.dashboard = d;
        store.state.summary = d.counts || {};
      } else if (page === "bookings") store.state.records = d.bookings || [];
      else if (page === "calendar") {
        store.state.calendar = d;
        store.state.records = d.bookings || [];
      } else if (page === "followups")
        store.state.followups = d.bookings || d.followups || [];
      else if (page === "payments") {
        store.state.paymentData = d;
        store.state.payments = d.items || d.payments || [];
      } else if (page === "customers")
        store.state.customers = d.customers || [];
      else if (page === "revenue") store.state.revenue = d;
      else if (page === "schedule") store.state.schedules = d;
      else if (page === "settings") store.state.settings = d;
      else if (page === "detail") {
        store.state.detail = d;
        store.state.booking = d.detail || d.booking || {};
      }
      readCache.set(cacheKey, Date.now());
    } catch (e) {
      if (sequence !== loadSequence) return;
      if (!handleAuth(e)) errorText = e.message;
    } finally {
      if (sequence === loadSequence) store.state.loading = false;
    }
  }
  function dashboard() {
    const d = store.state.dashboard || {}, c = d.counts || {};
    const revenue = store.state.revenue || {};
    return `${head("概覽", "今日營運與近期預約")}<div class="stats">${stat("今日入住", c.todayCheckins)}${stat("今日退房", c.todayCheckouts)}${stat("待確認", c.pendingConfirmation)}${stat("待付訂金", c.pendingDeposit)}${stat("本月預訂住宿", amount(revenue.monthBookedRevenue ?? revenue.monthAccommodationRevenue))}${stat("本月實際收款", amount(revenue.monthCollected))}</div><p><button class="btn secondary" data-go="schedule">查看員工排班</button> <button class="btn" data-go="new-booking">新增預約</button></p><section class="card"><h2>今日入住／退房提醒</h2>${list(d.todaySchedule, "今日沒有入住／退房預約")}</section><section class="card"><h2>房間衝突／待跟進</h2>${list(d.roomConflicts || d.followups, "目前沒有需處理事項")}</section><section class="card"><h2>近期預約</h2>${list(d.recent, "目前沒有近期預約")}</section>`;
  }
  function bookings() {
    return `${head("預訂", "搜尋及篩選目前 TEST API 預訂清單")}<div class="filters"><div class="field"><label for="bookingQ">Booking ID／客人／電話／寵物</label><input id="bookingQ" placeholder="搜尋"></div><div class="field"><label for="bookingStatus">預訂狀態</label><select id="bookingStatus"><option value="">全部</option>${Object.entries(
      labels,
    )
      .map(([v, l]) => `<option value="${v}">${l}</option>`)
      .join(
        "",
      )}</select></div><div class="field"><label for="bookingRoom">房型 ID</label><input id="bookingRoom" placeholder="例如 PRIVATE_SUITE"></div><div class="field"><label for="bookingCheckin">入住日期</label><input id="bookingCheckin" type="date"></div><div class="field"><label for="bookingCheckout">退房日期</label><input id="bookingCheckout" type="date"></div></div><div id="bookingResults">${list(store.state.records, "沒有符合預訂")}</div>`;
  }
  function parseJson(v) {
    if (Array.isArray(v)) return v;
    if (typeof v !== "string" || !v.trim()) return [];
    try {
      const x = JSON.parse(v);
      return Array.isArray(x) ? x : [];
    } catch (_) {
      return [];
    }
  }
  function parseRooms(b) {
    let v = b.allocatedRoomIds || parseJson(b.allocatedRoomIdsJson);
    if (typeof v === "string") v = parseJson(v);
    return arr(v).filter((x) => rooms.includes(x));
  }
  function calendar() {
    const d = store.state.calendar || {}, now = store.state.calendarDate || new Date();
    const hkt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const todayISO = hkt.replace(/\//g, "-");
    const selected = store.state.selectedCalendarDate || (todayISO.slice(0,7) === `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}` ? todayISO : `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`);
    const helper = window.LittleLandCalendarView;
    const monthHtml = helper ? helper.renderCalendarView({year:now.getFullYear(),monthIndex:now.getMonth(),todayISO,selectedDate:selected,bookings:arr(d.bookings),schedules:arr(d.schedules),roomIds:rooms,roomNames:roomNames}) : '<div class="empty">月曆元件未載入。</div>';
    const selectedItems = arr(d.bookings).filter(b => String(b.checkinDate||"") === selected || String(b.checkoutDate||"") === selected || (["CONFIRMED","CHECKED_IN"].includes(statusOf(b)) && String(b.checkinDate||"") <= selected && String(b.checkoutDate||"") > selected));
    return `${head("房間月曆", "香港時間今日提醒；退房日不佔房。待確認及待付訂金不會顯示為佔房。")}<section class="card"><div class="calendar-head"><button class="btn secondary" data-month="-1">‹ 上月</button><h2>${now.getFullYear()}年${now.getMonth()+1}月</h2><button class="btn secondary" data-month="1">下月 ›</button><button class="btn" data-today>今日</button></div>${monthHtml}</section><section class="card"><h2>${esc(selected)} · 當日詳情</h2>${list(selectedItems,"當日沒有入住、退房或在住房間")}<h3>在職房間／寵物</h3>${rooms.map(r=>{const b=selectedItems.find(x=>["CONFIRMED","CHECKED_IN"].includes(statusOf(x)) && String(x.checkinDate||"")<=selected && String(x.checkoutDate||"")>selected && parseRooms(x).includes(r)); return `<p>${esc(r)} · ${b?`🐾 ${esc(get(b,"petNames"))} · ${esc(roomNames[b.roomTypeId]||b.roomTypeId)} · ${esc(fullIdOf(b))}`:"空房"}</p>`}).join("")}</section>`;
  }
  function whatsapp(b) {
    const phone = String(b.phone || "").replace(/\D/g, "");
    if (!/^[2-9]\d{7}$/.test(phone)) return "";
    const draft = `Booking ${idOf(b)}｜入住日 ${get(b, "checkinDate")}，請 LittleLand 跟進。`;
    return `<a class="btn whatsapp" href="https://wa.me/852${phone}?text=${encodeURIComponent(draft)}" target="_blank" rel="noopener noreferrer">WhatsApp 草稿</a>`;
  }
  function followups() {
    const rows = arr(store.state.followups);
    return `${head("待跟進", "員工手動聯絡；WhatsApp 僅開啟草稿，不會自動發送。")}${rows.length ? rows.map((b) => `<article class="card followup-item"><p><b>${esc(idOf(b))} · ${esc(get(b, "parentName", "customerName"))}</b> ${status(statusOf(b))} ${depositBadge(b)} ${followupBadge(b)}</p>${conflictNotice(b)}<p>${esc(get(b, "phone"))} · ${esc(roomNames[b.roomTypeId] || get(b, "roomTypeId"))} · 入住 ${esc(get(b, "checkinDate"))}</p><p>最後聯絡：${esc(friendly(get(b, "lastContactedAt")))} · ${esc(get(b, "lastContactedBy"))}<br>${esc(get(b, "followUpNote"))}</p><div class="row">${whatsapp(b)}<button class="btn secondary" data-follow="${esc(idOf(b))}">記錄已聯絡／備註</button><button class="btn" data-detail="${esc(idOf(b))}">開啟預約</button></div></article>`).join("") : '<div class="empty">沒有待跟進預約</div>'}`;
  }
  function payments() {
    const d = store.state.paymentData || {},
      s = d.summary || {};
    return `${head("付款", "待收款項及今日已收；操作在 Booking Detail 完成。")}<div class="stats">${stat("待收訂金", amount(s.pendingDepositsTotal))}${stat("待收尾數", amount(s.pendingBalancesTotal))}${stat("待收現金按金", amount(s.pendingCashDepositsTotal))}${stat("待退現金按金", amount(s.cashDepositsToRefundTotal))}${stat("今日已收", amount(s.receivedTodayTotal))}</div><section class="card"><h2>付款相關預約</h2>${list(d.items || d.payments, "沒有付款待辦")}</section>`;
  }
  function customers() {
    const rows = arr(store.state.customers);
    return `${head("客戶", "只按標準化電話號碼聚合／搜尋；不會預填客人資料。歷史預訂連到共同 detail")}<div class="field"><label for="customerQ">電話號碼</label><input id="customerQ" placeholder="電話號碼" inputmode="tel"></div><div id="customerResults">${
      rows
        .map(
          (c) =>
            `<article class="card customer"><h2>${esc(get(c, "name"))}</h2><p>${esc(get(c, "phone"))} · ${esc(get(c, "email"))}</p><p>寵物：${esc(
              arr(c.petNames).join(", ") ||
                arr(c.pets)
                  .map((p) => p.name)
                  .join(", "),
            )}</p><h3>過往預訂</h3>${list(c.bookings, "沒有歷史預訂")}</article>`,
        )
        .join("") || '<div class="empty">沒有客戶資料</div>'
    }</div>`;
  }
  function groups(items, map) {
    return (
      arr(items)
        .map(
          (x) =>
            `<p>${esc(map[x.name] || x.name || "—")}　<strong>${esc(amount(x.amount))}</strong></p>`,
        )
        .join("") || '<div class="empty">暫無資料</div>'
    );
  }
  function revenue() {
    const d = store.state.revenue || {},
      year = String(store.state.revenueYear || d.year || "2026"),
      selectedMonth = String(store.state.revenueMonth || d.month || `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`),
      chart = window.LittleLandRevenueChart
        ? window.LittleLandRevenueChart.renderRevenueChart(d, selectedMonth)
        : '<p class="empty">營收圖表元件未載入。</p>';
    return `${head("營收分析", `${year} 全年 12 個月 TEST 營收總覽；住宿預訂按入住月份、實際收款按付款日統計；現金按金不計住宿收入。`)}<form id="revenueYearForm" class="revenue-year-form"><label for="revenueYear">檢視年度</label><input id="revenueYear" name="year" type="number" min="2020" max="2100" value="${escValue(year)}"><button class="btn secondary">載入年度</button></form><section class="card">${chart}</section><div class="grid two"><section class="card"><h2>按房型</h2>${groups(d.byRoomType, roomNames)}</section><section class="card"><h2>按寵物種類</h2>${groups(d.bySpecies, speciesNames)}</section></div>`;
  }
  function schedule() {
    const d = store.state.schedules || {}, date = store.state.scheduleDate || new Date();
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const html = window.LittleLandScheduleView ? window.LittleLandScheduleView.renderScheduleView({year:date.getFullYear(),monthIndex:date.getMonth(),staff:arr(d.staff),schedules:arr(d.schedules),todayISO:new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Hong_Kong"}).format(new Date()),draftAssignments:(store.state.scheduleDrafts||{})[monthKey]||{},pending:!!store.state.scheduleSaving}) : '<p class="empty">排班月曆元件未載入。</p>';
    return `${head("員工排班", "每月日曆直接選擇已設定的排班員工，再按一次儲存整月。未安排表示當日無人值班。更新只影響本月。")}<section class="card"><div class="calendar-head"><button class="btn secondary" data-schedule-month="-1">‹ 上月</button><button class="btn secondary" data-schedule-month="1">下月 ›</button></div>${html}</section>`;
  }
  function newBooking() {
    const view = window.LittleLandStaffNewBookingView;
    if (!view) return `${head("新增預約")}<section class="card"><div class="error">新預約表單未載入，請重新整理頁面。</div></section>`;
    if (!store.state.newBookingDraft) store.state.newBookingDraft = view.blankDraft();
    return view.render({ draft: store.state.newBookingDraft, availability: store.state.newBookingAvailability, pending: pendingAction });
  }

  function kv(o, fields) {
    return `<div class="kv">${fields.map(([l, ...ks]) => `<div><b>${esc(l)}</b>${esc(friendly(get(o, ...ks)))}</div>`).join("")}</div>`;
  }
  function serviceItems(b) {
    const x = b.serviceItemsJson;
    if (Array.isArray(x)) return x;
    if (typeof x === "string") {
      try {
        const v = JSON.parse(x);
        return Array.isArray(v) ? v : [];
      } catch (_) {
        return [];
      }
    }
    return [];
  }
  function printBooking() {
    const data = store.state.detail;
    if (!data || !window.LittleLandBookingPrint) {
      toast("列印頁未能載入，請重新整理後再試。");
      return;
    }
    const booking = data.detail || data.booking || {};
    const baseUrl = window.location.href.split("#")[0];
    const assetBase = new URL("assets/booking-print/", baseUrl).toString();
    const logoUrl = new URL("../assets/brand/littleland-logo.png", baseUrl).toString();
    const popup = window.open("", "_blank");
    if (!popup) {
      toast("瀏覽器封鎖了列印視窗，請允許此網站開啟新視窗後再試。");
      return;
    }
    const html = window.LittleLandBookingPrint.render({
      booking,
      pets: arr(data.pets).filter((pet) => !["REMOVED", "ARCHIVED"].includes(String(pet.petStatus || "").toUpperCase())),
      payments: arr(data.payments),
      adjustments: arr(data.adjustments),
      services: serviceItems(booking),
    }, { shortReference: shortRef(booking), assetBase, logoUrl });
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }
  function detail() {
    const d = store.state.detail;
    if (!d)
      return `${head("Booking Detail")}<div class="empty">尚未載入預約資料。</div>`;
    const b = d.detail || d.booking || {},
      allPets = arr(d.pets),
      pets = window.LittleLandBookingChangesView ? window.LittleLandBookingChangesView.activePets(allPets) : allPets,
      removedPets = allPets.filter((pet) => ["REMOVED", "ARCHIVED"].includes(String(pet.petStatus || "").toUpperCase())),
      payments = arr(d.payments),
      adjustments = arr(d.adjustments),
      logs = arr(d.logs),
      history = arr(d.followupHistory),
      s = b.bookingStatus;
    const actions = [];
    if (s === "PENDING_CONFIRMATION")
      actions.push(["confirmData", "確認資料"]);
    if (s === "PENDING_DEPOSIT")
      actions.push(["confirmDeposit", "確認已收訂金"]);
    if (["CHECKED_IN", "CHECKED_OUT", "COMPLETED"].includes(s) && b.depositStatus === "PAID" && Number(b.remainingBalance || 0) > 0)
      actions.push(["recordBalance", "記錄尾數"]);
    if (s === "CHECKED_IN" && b.cashDepositStatus === "NOT_COLLECTED")
      actions.push(["cashDepositCollect", "收現金按金"]);
    if (["COLLECTED", "PARTIALLY_USED"].includes(b.cashDepositStatus)) {
      if (
        Number(b.cashDepositCollectedAmount || b.cashDepositAmount || 0) -
          Number(b.cashDepositUsedAmount || 0) -
          Number(b.cashDepositRefundedAmount || 0) >
        0
      )
        actions.push(["cashDepositUse", "使用現金按金"]);
      if (
        ["CHECKED_OUT", "COMPLETED"].includes(s) &&
        Number(b.cashDepositRefundDue || 0) > 0
      )
        actions.push(["cashDepositRefund", "退現金按金"]);
    }
    if (s === "CONFIRMED") actions.push(["checkIn", "辦理入住"]);
    if (s === "CHECKED_IN") actions.push(["checkOut", "辦理退房"]);
    if (s === "CHECKED_OUT") actions.push(["complete", "完成預約"]);
    if (["PENDING_CONFIRMATION", "PENDING_DEPOSIT", "CONFIRMED"].includes(s))
      actions.push(["cancel", "取消預約"]);
    actions.push(["edit", "更新資料"]);
    if (s === "CHECKED_IN") actions.push(["earlyCheckout","記錄提早退房"]);
    const conflict =
        b.roomConflict === true ||
        (d.confirmed === false && d.roomConflict === true) ||
        store.state.depositConflictBookingId === String(idOf(b)),
      refund =
        b.cashDepositRefundDue != null
          ? b.cashDepositRefundDue
          : get(b, "cashDepositRefundDue", "cashDepositRefundAmount"),
      services = serviceItems(b);
    const manualAdjustmentTotal = adjustments.filter((entry) => ["SURCHARGE", "REVERSAL"].includes(String(entry.type))).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const feeDisplay = Object.assign({}, b, {
      manualAdjustmentTotal,
      displaySurcharges: Number(b.totalSurcharges || 0) + manualAdjustmentTotal,
      currentTotal: Number(b.estimatedTotal || 0) + manualAdjustmentTotal,
    });
    const bookingChangeControls = window.LittleLandBookingChangesView
      ? window.LittleLandBookingChangesView.render({ booking: b, pets: pets, payments: payments, adjustments: adjustments, pending: pendingAction })
      : "";
    const whatsappPanel = window.LittleLandWhatsAppMessages
      ? window.LittleLandWhatsAppMessages.render({ booking: feeDisplay, pets, payments, roomNames, allocatedRooms: parseRooms(b), roomConflict: conflict })
      : "";
    return `${head("Booking Detail", idOf(b))}${conflict ? `<div class="danger-box" role="alert"><strong>房間衝突：</strong>${b.depositStatus === "PAID" || store.state.depositConflictBookingId === String(idOf(b)) ? "訂金已收" : "訂金尚未確認已收"}；目前沒有可用房間。未有房間分配，預約未確認。請員工手動聯絡客人跟進；請勿承諾房間。</div>` : ""}<section class="card"><h2>預約 ${esc(idOf(b))} ${status(s)} ${depositBadge(b)} ${followupBadge(b)}</h2>${kv(
      b,
      [
        ["提交時間", "createdAt", "submittedAt"],
        ["入住日期", "checkinDate"],
        ["入住時間", "checkinTime"],
        ["退房日期", "checkoutDate"],
        ["退房時間", "checkoutTime"],
        ["晚數", "nights"],
        ["房型", roomNames[b.roomTypeId] || b.roomTypeId],
        ["內部分配房號", parseRooms(b).join(", ") || "未分配"],
        ["訂金狀態", "depositStatus"],
        ["尾數狀態", "balanceStatus"],
        ["按金狀態", "cashDepositStatus"],
        ["版本", "recordVersion"],
      ],
    )}<details><summary>原始 detail 資料</summary><pre>${esc(JSON.stringify(b, null, 2))}</pre></details></section><section class="card"><h2>客人</h2>${kv(
      b,
      [
        ["姓名", "parentName", "customerName"],
        ["電話", "phone"],
        ["Email", "email"],
        ["緊急聯絡人 1", "emergency1"],
        ["緊急聯絡人 2", "emergency2"],
        ["指定獸醫／診所", "vet"],
      ],
    )}</section><section class="card"><h2>飲食（預約資料）</h2>${kv(b, [
      ["主糧", "foodMain"],
      ["餵食", "feeding"],
      ["牧草", "hay"],
      ["蔬菜", "vegetables"],
    ])}</section><section class="card"><h2>寵物</h2>${
      pets
        .map(
          (p) =>
            `<article class="pet"><h3>🐾 ${esc(get(p, "name", "petName"))}</h3><p><b>種類</b> ${esc(speciesNames[b.species] || b.species || "—")}</p>${kv(
              p,
              [
                ["品種", "breed"],
                ["年齡", "ageValue"],
                ["年齡單位", "ageUnit"],
                ["年齡（月）", "ageInMonths"],
                ["性別", "sex"],
                ["絕育", "sterilized"],
                ["懷孕", "pregnant"],
                ["最近 30 日手術", "recentSurgery30Days"],
                ["看獸醫", "vetVisit"],
                ["獸醫詳情", "vetDetails"],
                ["傳染病", "infectiousDisease"],
                ["傳染病詳情", "infectiousDetails"],
                ["慢性疾病", "chronicDisease"],
                ["慢性疾病詳情", "chronicDetails"],
                ["藥物", "medication"],
                ["藥物詳情", "medicationDetails"],
                ["特殊照顧", "specialCare"],
                ["杜蝨處理", "fleaTreatment"],
                ["健康審核狀態", "healthReviewStatus"],
              ],
            )}</article>`,
        )
        .join("") || '<div class="empty">沒有寵物資料</div>'
    }</section>${removedPets.length ? `<section class="card"><h2>已移除寵物（保留歷史）</h2>${removedPets.map((pet) => `<article class="pet archived"><h3>🐾 ${esc(get(pet,"name","petName"))} · 已移除</h3><p>${esc(get(pet,"removeReason"))}</p><small>${esc(friendly(get(pet,"removedAt")))}</small></article>`).join("")}</section>` : ""}<section class="card"><h2>收費</h2>${kv(feeDisplay, [
      ["基本房費", "baseRoomFee"],
      ["額外寵物費", "extraPetFee"],
      ["週末附加費", "weekendFee"],
      ["服務費合計", "serviceFees"],
      ["原 Pricing Engine 附加費合計", "totalSurcharges"],
      ["人工附加費／減項淨額", "manualAdjustmentTotal"],
      ["目前附加費合計（含人工調整）", "displaySurcharges"],
      ["目前住宿總額", "currentTotal"],
      ["訂金", "depositAmount"],
      ["尾數", "remainingBalance"],
      ["現金按金", "cashDepositAmount"],
      ["應退現金按金", refund],
    ])}<h3>客人同意</h3>${kv(b, [
      ["現金按金同意", "consentCashDeposit"],
      ["訂金及尾數同意", "consentDepositAndBalance"],
      ["訂金不退同意", "consentDepositNonRefundable"],
      ["寄養條款同意", "consentBoardingTerms"],
      ["健康申報同意", "consentHealthDeclaration"],
      ["緊急獸醫同意", "consentEmergencyVet"],
      ["同意時間", "consentedAt"],
    ])}<h3>額外服務</h3>${services.map((x) => `<p>${esc(typeof x === "string" ? x : get(x, "label", "name", "serviceName", "serviceId", "id"))}${typeof x === "object" ? ` · ${esc(get(x, "amount"))}` : ""}</p>`).join("") || "<p>沒有額外服務</p>"}</section><section class="card"><h2>付款紀錄</h2>${kv(
      b,
      [
        ["訂金狀態", "depositStatus"],
        ["訂金金額", "depositAmount"],
        ["尾數狀態", "balanceStatus"],
        ["尾數金額", "remainingBalance"],
        ["現金按金狀態", "cashDepositStatus"],
        ["已使用按金", "cashDepositUsedAmount"],
        ["應退按金", refund],
      ],
    )}${payments.map((p) => `<p>${esc(get(p, "paymentType"))} · ${esc(amount(p.amount))} · ${esc(friendly(get(p, "paidAt")))} · ${esc(get(p, "paymentStatus"))}</p>`).join("") || "<p>沒有付款紀錄</p>"}</section>${bookingChangeControls}${whatsappPanel}<section class="card"><h2>最後聯絡及跟進歷史</h2><p>${esc(friendly(get(b, "lastContactedAt")))} · ${esc(get(b, "lastContactedBy"))}<br>${esc(get(b, "followUpNote"))}</p>${history.map((x) => `<p>${esc(friendly(get(x, "createdAt", "time")))} · ${esc(get(x, "staffName", "actorStaffNameSnapshot", "actorStaffId"))} · ${esc(get(x, "note", "summary"))}</p>`).join("") || "<p>沒有跟進歷史</p>"}<form id="followForm" class="field"><label for="followNote">新增跟進備註</label><textarea id="followNote" name="note" required>${escValue(store.state.followupDraft || "")}</textarea><button class="btn" ${pendingAction ? "disabled" : ""}>新增跟進</button></form></section><section class="card"><h2>操作 Logs</h2>${logs.map((x) => `<p>${esc(friendly(get(x, "createdAt")))} · <strong>${esc(get(x, "actorStaffNameSnapshot", "staffName") || get(x, "actorStaffId") || (x.actorType === "SYSTEM" ? "系統" : "未知操作者"))}</strong> · ${esc(get(x, "action"))} · ${esc(get(x, "summary"))}</p>`).join("") || '<div class="empty">沒有 Logs</div>'}</section><section class="card"><h2>可用操作</h2><div class="action-grid">${actions.map(([a, t]) => a === "earlyCheckout" ? `<button class="btn secondary" data-adjust="${a}" ${pendingAction ? "disabled" : ""}>${esc(t)}</button>` : `<button class="btn secondary" data-action="${a}" ${pendingAction ? "disabled" : ""}>${esc(t)}</button>`).join("")}</div></section>${(() => {
      const draft = store.state.editDraft || {}, fieldValue = (key, fallback) => draft[key] !== undefined ? draft[key] : (fallback == null ? "" : fallback);
      const textField = (label, key, fallback, type = "text") => `<label>${esc(label)}</label><input name="${esc(key)}" type="${type}" value="${escValue(fieldValue(key, fallback))}">`;
      const selectField = (label, key, value, options) => `<label>${esc(label)}</label><select name="${esc(key)}">${options.map(([v, title]) => `<option value="${escValue(v)}" ${String(fieldValue(key, value)) === String(v) ? "selected" : ""}>${esc(title)}</option>`).join("")}</select>`;
      const yesNo = [["yes","是"],["no","否"]];
      const petFields = pets.map((pet, i) => {
        const pd = draft.pets && draft.pets[i] || {}, pv = (key) => pd[key] !== undefined ? pd[key] : (pet[key] == null ? "" : pet[key]);
        const pselect = (key, label, options, fallback) => {
          const selectedValue = StaffEditFormUtils.toYesNoOption(key, pv(key), fallback);
          return `<label>${esc(label)}</label><select data-pet-field="${i}:${esc(key)}">${options.map(([v,t]) => `<option value="${escValue(v)}" ${String(selectedValue) === String(v) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
        };
        const pinput = (key, label, type = "text") => `<label>${esc(label)}</label><input data-pet-field="${i}:${esc(key)}" type="${type}" value="${escValue(pv(key))}">`;
        const hamster = StaffEditFormUtils.isHamsterSpecies(b.species), male = String(pv("sex") || pet.sex).toLowerCase() === "male";
        const pregnancyField = !hamster
          ? (() => {
              const selected = StaffEditFormUtils.toYesNoOption("pregnant", pv("pregnant"), "");
              const options = [["", "請選擇"], ...yesNo].map(([v, t]) => `<option value="${escValue(v)}" ${String(selected) === String(v) ? "selected" : ""}>${esc(t)}</option>`).join("");
              return `<label data-pregnancy-label="${i}" ${male ? "hidden" : ""}>懷孕</label><select data-pet-field="${i}:pregnant" ${male ? "hidden disabled" : "required"}>${options}</select>`;
            })()
          : "";
        return `<article class="pet edit-pet"><h3>寵物 ${i + 1} · ${esc(get(pet,"name","petName"))}</h3>${pinput("name","名稱")}${pinput("breed","品種")}${pinput("ageValue","年齡數值","number")}${pselect("ageUnit","年齡單位",[["month","月"],["year","歲"]],"month")}${pselect("sex","性別",[["male","男孩子"],["female","女孩子"]],"female")}${!hamster ? pselect("sterilized","絕育",yesNo,false) : ""}${pregnancyField}${pselect("recentSurgery30Days","最近 30 日手術",yesNo,false)}${pselect("vetVisit","最近看獸醫",yesNo,false)}${pinput("vetDetails","獸醫詳情")}${pselect("infectiousDisease","傳染病",yesNo,false)}${pinput("infectiousDetails","傳染病詳情")}${pselect("chronicDisease","慢性疾病",yesNo,false)}${pinput("chronicDetails","慢性疾病詳情")}${pselect("medication","正在服藥",yesNo,false)}${pinput("medicationDetails","藥物詳情")}${pinput("specialCare","特殊照顧")}${!hamster ? pselect("fleaTreatment","一個月內杜蝨",yesNo,false) : ""}</article>`;
      }).join("");
      return `<section class="card"><h2>更新資料</h2><form id="editForm" class="field">${textField("家長姓名","parentName",b.parentName || b.customerName || "")}${textField("電話","phone",b.phone,"tel")}${textField("Email","email",b.email,"email")}${textField("緊急聯絡人 1","emergency1",b.emergency1)}${textField("緊急聯絡人 2","emergency2",b.emergency2)}${textField("指定獸醫／診所","vet",b.vet)}${selectField("入住時間","checkinTime",b.checkinTime,["14:30–15:30","15:30–16:30","16:30–17:00"].map(x=>[x,x]))}${selectField("退房時間","checkoutTime",b.checkoutTime,["14:30–15:30","15:30–16:30","16:30–17:00"].map(x=>[x,x]))}${textField("主糧","foodMain",b.foodMain)}${textField("牧草","hay",b.hay)}${textField("餵食","feeding",b.feeding)}${selectField("蔬菜","vegetables",StaffEditFormUtils.toVegetablesOption(b.vegetables),[["","—"],["是","是"],["否","否"]])}<h3>寵物資料</h3>${petFields}<button class="btn" ${pendingAction ? "disabled" : ""}>更新資料</button></form></section>`;
    })()}`;
  }
  function settings() {
    const s = store.state.settings || {};
    const employees = arr(s.scheduleEmployees);
    const employeeValue = (index) => {
      const employee = employees.find((item) => Number(item.sortOrder) === index + 1) || employees[index] || {};
      return String(employee.displayName || "");
    };
    return `${head("設定／登出", "TEST 環境帳戶")}<section class="card"><h2>排班員工名稱</h2><p class="meta">設定 2–3 位用於排班下拉選單的員工名稱。這份名冊與登入帳號及權限分開；不會新增登入帳號。</p><form id="scheduleEmployeesForm" class="field schedule-employee-settings-form"><label for="scheduleEmployeeA">員工 A 名稱</label><input id="scheduleEmployeeA" name="employeeA" type="text" maxlength="40" required value="${escValue(employeeValue(0))}" autocomplete="off"><label for="scheduleEmployeeB">員工 B 名稱</label><input id="scheduleEmployeeB" name="employeeB" type="text" maxlength="40" required value="${escValue(employeeValue(1))}" autocomplete="off"><label for="scheduleEmployeeC">員工 C 名稱（選填）</label><input id="scheduleEmployeeC" name="employeeC" type="text" maxlength="40" value="${escValue(employeeValue(2))}" autocomplete="off"><p class="field-help">員工 A、B 必須填寫；C 可留空。每個名稱最多 40 字，且不可重複。</p><button class="btn" type="submit" ${pendingAction ? "disabled" : ""}>儲存排班員工名稱</button></form></section><section class="card"><h2>登入資料</h2><p>${esc(get(s, "staff.displayName"))} · 完整管理權限（TEST）</p><p class="meta">Session token 只保存在 sessionStorage。</p><button class="btn danger" data-logout>登出並撤銷 Session</button></section>`;
  }
  function paint() {
    if (!store.token) {
      login();
      return;
    }
    const p = StaffRouter.current().page,
      views = {
        dashboard,
        bookings,
        calendar,
        followups,
        payments,
        customers,
        revenue,
        settings,
        detail,
        schedule,
        "new-booking": newBooking,
      };
    shell(p, (views[p] || dashboard)());
    bind(p);
  }
  function bind(page) {
    const retry = app.querySelector("[data-retry]");
    if (retry) retry.onclick = () => loadPageData(page, { force: true }).then(paint);
    const printButton = app.querySelector("[data-print-booking]");
    if (printButton) printButton.onclick = printBooking;
    const todayButton = app.querySelector("[data-today]"); if (todayButton) todayButton.onclick = async () => { const t = new Date(new Date().toLocaleString("en-US", {timeZone:"Asia/Hong_Kong"})); store.state.calendarDate=t; store.state.selectedCalendarDate=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Hong_Kong"}).format(new Date()); await loadPageData("calendar",{force:true}); paint(); };
    app.querySelectorAll("[data-month]").forEach(
      (x) =>
        (x.onclick = async () => {
          const d = store.state.calendarDate || new Date();
          store.state.calendarDate = new Date(
            d.getFullYear(),
            d.getMonth() + Number(x.dataset.month),
            1,
          );
          store.state.selectedCalendarDate = `${store.state.calendarDate.getFullYear()}-${String(store.state.calendarDate.getMonth() + 1).padStart(2, "0")}-01`;
          await loadPageData("calendar");
          paint();
        }),
    );
    app.querySelectorAll("[data-schedule-month]").forEach((button) => {
      button.onclick = async () => {
        const current = store.state.scheduleDate || new Date();
        store.state.scheduleDate = new Date(current.getFullYear(), current.getMonth() + Number(button.dataset.scheduleMonth), 1);
        await loadPageData("schedule", { force: true });
        paint();
      };
    });
    app.querySelectorAll("[data-date]").forEach(
      (x) =>
        (x.onclick = () => {
          store.state.selectedCalendarDate = x.dataset.date;
          paint();
        }),
    );
    const q = app.querySelector("#bookingQ");
    if (q) {
      const filter = () => {
        const val = (id) => app.querySelector(id)?.value || "",
          term = val("#bookingQ").toLowerCase(),
          st = val("#bookingStatus"),
          room = val("#bookingRoom").toLowerCase(),
          ci = val("#bookingCheckin"),
          co = val("#bookingCheckout");
        const filtered = arr(store.state.records).filter((b) => {
          const hay = [
            idOf(b),
            b.customerName,
            b.parentName,
            b.phone,
            b.petNames,
            arr(b.pets)
              .map((p) => p.name)
              .join(" "),
          ]
            .join(" ")
            .toLowerCase();
          return (
            hay.includes(term) &&
            (!st || statusOf(b) === st) &&
            (!room ||
              String(b.roomTypeId || "")
                .toLowerCase()
                .includes(room)) &&
            (!ci || String(b.checkinDate || "") === ci) &&
            (!co || String(b.checkoutDate || "") === co)
          );
        });
        const box = app.querySelector("#bookingResults");
        box.innerHTML = list(filtered, "沒有符合預訂");
        box
          .querySelectorAll("[data-detail]")
          .forEach(
            (x) =>
              (x.onclick = () => StaffRouter.go("detail", x.dataset.detail)),
          );
      };
      [
        "#bookingQ",
        "#bookingStatus",
        "#bookingRoom",
        "#bookingCheckin",
        "#bookingCheckout",
      ].forEach((sel) => {
        const el = app.querySelector(sel);
        el.addEventListener(
          el.tagName === "SELECT" ? "change" : "input",
          filter,
        );
      });
    }
    const cq = app.querySelector("#customerQ");
    if (cq)
      cq.oninput = () => { const norm = v => String(v||"").replace(/\D/g,"").replace(/^852(?=\d{8}$)/,"").replace(/^00852(?=\d{8}$)/,""); const term=norm(cq.value); app.querySelectorAll(".customer").forEach(x => { const phone=norm(x.querySelector("p")?.textContent); x.hidden=!!term && !phone.includes(term); }); };
    const form = app.querySelector("#followForm");
    if (form) {
      form.note.oninput = () => {
        store.state.followupDraft = form.note.value;
      };
      form.onsubmit = (e) => {
        e.preventDefault();
        store.state.followupDraft = form.note.value;
        mutate(
          "followup",
          StaffRouter.current().id,
          { data: { note: form.note.value, required: true } },
          form,
        );
      };
    }
      const ef = app.querySelector("#editForm");
      if (ef) {
      const readEdit = () => {
        const data = {}, detailState = store.state.detail || {};
        const currentBooking = detailState.detail || detailState.booking || {};
        ["parentName", "phone", "email", "emergency1", "emergency2", "vet", "checkinTime", "checkoutTime", "foodMain", "hay", "feeding", "vegetables"].forEach((k) => { const el = ef.elements.namedItem(k); if (el) data[k] = el.value; });
        data.pets = arr((store.state.detail || {}).pets).filter((pet) => ["", "ACTIVE", "STAYING"].includes(String(pet.petStatus || "").toUpperCase())).map((pet, i) => {
          const fields = {};
          ef.querySelectorAll(`[data-pet-field^="${i}:"]`).forEach((el) => {
            const key = el.dataset.petField.slice(el.dataset.petField.indexOf(":") + 1);
            fields[key] = el.value;
          });
          return StaffEditFormUtils.createPetEditInput(pet.petId, fields, currentBooking.species);
        });
        return data;
      };
      ef.querySelectorAll('[data-pet-field$=":sex"]').forEach((el) => el.addEventListener("change", () => {
        const i = el.dataset.petField.split(":")[0], isMale = el.value === "male";
        const pregnancy = ef.querySelector(`[data-pet-field="${i}:pregnant"]`), label = ef.querySelector(`[data-pregnancy-label="${i}"]`);
        if (pregnancy) { pregnancy.hidden = isMale; pregnancy.disabled = isMale; pregnancy.required = !isMale; if (isMale) pregnancy.value = ""; }
        if (label) label.hidden = isMale;
      }));
      ef.onsubmit = (e) => {
        e.preventDefault();
        const data = readEdit();
        store.state.editDraft = data;
        if (!confirm("確認更新聯絡、飲食／時間及現有寵物資料？寵物數量、種類、狀態、房間、價格及付款資料不會更改。")) return;
        mutate("edit", StaffRouter.current().id, { data }, ef);
      };
    }
    const submitApi = async (action, payload, form, onSuccess) => {
      if (pendingAction) return;
      const requestBody = Object.assign({}, payload);
      const suppliedIdempotencyKey = String(requestBody.idempotencyKey || "");
      delete requestBody.idempotencyKey;
      const fingerprint = JSON.stringify(requestBody);
      const formControls = form ? Array.from(form.querySelectorAll("button,input,select,textarea"), (control) => ({ control, disabled: control.disabled })) : [];
      if (form) {
        if (form.dataset.idempotencyFingerprint !== fingerprint || !form.dataset.idempotencyKey) {
          form.dataset.idempotencyFingerprint = fingerprint;
          form.dataset.idempotencyKey = suppliedIdempotencyKey || uuid();
        } else if (suppliedIdempotencyKey) {
          form.dataset.idempotencyKey = suppliedIdempotencyKey;
        }
        requestBody.idempotencyKey = form.dataset.idempotencyKey;
      } else {
        requestBody.idempotencyKey = suppliedIdempotencyKey || uuid();
      }
      pendingAction = true;
      formControls.forEach(({ control }) => { control.disabled = true; });
      let repaint = false, mutationSucceeded = false;
      try {
        try {
          await StaffAPI.request(action, requestBody, store.token);
          mutationSucceeded = true;
          if (typeof onSuccess === "function") onSuccess();
          if (form) { delete form.dataset.idempotencyFingerprint; delete form.dataset.idempotencyKey; }
          readCache.clear();
          toast("TEST API 已確認操作。");
        } catch (e) {
          const handled = handleAuth(e);
          if (handled) repaint = true;
          else if (form && form.isConnected) {
            let error = form.querySelector(".form-error");
            if (!error) { error = document.createElement("p"); error.className = "form-error"; error.setAttribute("role", "alert"); form.prepend(error); }
            error.textContent = e.message;
          } else {
            errorText = e.message;
            repaint = true;
          }
        }
        if (mutationSucceeded) {
          try { await loadPageData(StaffRouter.current().page, { force: true }); }
          catch (refreshError) { errorText = "操作已成功，但無法重新載入資料；請重新整理頁面。"; }
          repaint = true;
        }
      } finally {
        pendingAction = false;
        if (repaint) paint();
        else if (form && form.isConnected) formControls.forEach(({ control, disabled }) => { control.disabled = disabled; });
      }
      return mutationSucceeded;
    };
    const scheduleEmployeesForm = app.querySelector("#scheduleEmployeesForm");
    if (scheduleEmployeesForm) {
      scheduleEmployeesForm.onsubmit = (event) => {
        event.preventDefault();
        const names = [scheduleEmployeesForm.elements.employeeA.value, scheduleEmployeesForm.elements.employeeB.value, scheduleEmployeesForm.elements.employeeC.value].map((value) => value.trim());
        const nonEmpty = names.filter(Boolean);
        const unique = new Set(nonEmpty.map((name) => name.toLocaleLowerCase())).size === nonEmpty.length;
        if (!names[0] || !names[1] || names.some((name) => name.length > 40) || !unique) {
          let error = scheduleEmployeesForm.querySelector(".form-error");
          if (!error) { error = document.createElement("p"); error.className = "form-error"; error.setAttribute("role", "alert"); scheduleEmployeesForm.prepend(error); }
          error.textContent = "請填寫至少兩位不同的員工名稱；第三位可留空，每個名稱最多 40 字。";
          return;
        }
        submitApi("scheduleEmployeesSave", { data: { employees: names.map((displayName) => ({ displayName })) } }, scheduleEmployeesForm);
      };
    }
    const scheduleMonthForm = app.querySelector("#scheduleMonthForm");
    if (scheduleMonthForm) {
      const year = Number(scheduleMonthForm.dataset.scheduleYear);
      const month = Number(scheduleMonthForm.dataset.scheduleMonth);
      const monthKey = `${year}-${String(month).padStart(2, "0")}`;
      scheduleMonthForm.addEventListener("change", (event) => {
        const control = event.target.closest("[data-schedule-day]");
        if (!control) return;
        store.state.scheduleDrafts = store.state.scheduleDrafts || {};
        const draft = store.state.scheduleDrafts[monthKey] || (store.state.scheduleDrafts[monthKey] = {});
        draft[control.dataset.date] = control.value;
      });
      scheduleMonthForm.onsubmit = async (event) => {
        event.preventDefault();
        const assignments = Array.from(scheduleMonthForm.querySelectorAll("[data-schedule-day]"), (control) => ({ workDate: control.dataset.date, staffId: control.value || "" }));
        const data = { year, month, assignments };
        const fingerprint = JSON.stringify(data);
        store.state.scheduleMonthIdempotency = store.state.scheduleMonthIdempotency || {};
        let retry = store.state.scheduleMonthIdempotency[monthKey];
        if (!retry || retry.fingerprint !== fingerprint) {
          retry = { fingerprint, key: uuid() };
          store.state.scheduleMonthIdempotency[monthKey] = retry;
        }
        await submitApi("scheduleMonthSave", { data, idempotencyKey: retry.key }, scheduleMonthForm, () => {
          if (store.state.scheduleDrafts) delete store.state.scheduleDrafts[monthKey];
          if (store.state.scheduleMonthIdempotency) delete store.state.scheduleMonthIdempotency[monthKey];
        });
      };
    }
    const changesView = window.LittleLandBookingChangesView;
    if (changesView) changesView.bind(app);
    const detailState = store.state.detail || {};
    const currentBooking = detailState.detail || detailState.booking || {};
    const currentBookingId = currentBooking.bookingId || StaffRouter.current().id;
    const currentVersion = { bookingId: currentBookingId, expectedRecordVersion: currentBooking.recordVersion, expectedStatus: currentBooking.bookingStatus };
    const adjustmentForm = app.querySelector("#bookingAdjustmentForm");
    if (adjustmentForm) adjustmentForm.onsubmit = (event) => {
      event.preventDefault();
      const description = adjustmentForm.elements.description.value.trim();
      const reason = adjustmentForm.elements.reason.value.trim();
      const enteredAmount = Number(adjustmentForm.elements.amount.value);
      const selectedPets = Array.from(adjustmentForm.querySelectorAll('[name="petIds"]:checked')).map((input) => input.value);
      if (!description || !reason || !Number.isFinite(enteredAmount) || enteredAmount <= 0) return;
      const sign = adjustmentForm.elements.direction.value === "reduce" ? -1 : 1;
      const data = { description, amount: Math.round(enteredAmount * sign * 100) / 100, reason, petIds: selectedPets };
      const scope = selectedPets.length ? `${selectedPets.length} 隻寵物 × ` : "整張預約 × ";
      if (!confirm(`確認${sign < 0 ? "減少／抵扣" : "新增"}附加費：${description}，${scope}HK$${enteredAmount.toFixed(2)}？若形成多收款項，不會自動退款。`)) return;
      submitApi("addSurcharge", Object.assign({}, currentVersion, { data }), adjustmentForm);
    };
    const refundForm = app.querySelector("#bookingRefundForm");
    if (refundForm) refundForm.onsubmit = (event) => {
      event.preventDefault();
      const sourcePaymentId = refundForm.elements.sourcePaymentId.value;
      const enteredAmount = Number(refundForm.elements.amount.value);
      const reason = refundForm.elements.reason.value.trim();
      const selected = refundForm.elements.sourcePaymentId.options[refundForm.elements.sourcePaymentId.selectedIndex];
      const refundable = Number(selected && selected.dataset.refundable || 0);
      if (!sourcePaymentId || !reason || !refundForm.elements.confirmRefund.checked || !Number.isFinite(enteredAmount) || enteredAmount <= 0 || enteredAmount > refundable) {
        const error = refundForm.querySelector(".form-error") || document.createElement("p");
        error.className = "form-error"; error.setAttribute("role", "alert"); error.textContent = "退款金額須大於零且不可超過該筆住宿款的尚可退款額；請確認已在系統外實際完成退款。";
        if (!error.isConnected) refundForm.prepend(error);
        return;
      }
      const data = { sourcePaymentId, amount: Math.round(enteredAmount * 100) / 100, reason, confirmRefund: true };
      if (!confirm(`確認記錄已實際退回 HK$${enteredAmount.toFixed(2)}？此動作只記錄人工退款，不會執行付款。`)) return;
      submitApi("refundDeposit", Object.assign({}, currentVersion, { data }), refundForm);
    };
    const petCountForm = app.querySelector("#bookingPetCountForm");
    if (petCountForm) petCountForm.onsubmit = (event) => {
      event.preventDefault();
      const removePetIds = Array.from(petCountForm.querySelectorAll('[name="removePetIds"]:checked')).map((input) => input.value);
      const reason = petCountForm.elements.reason.value.trim();
      const addPet = petCountForm.elements.addPet.checked;
      const newPetMap = [];
      if (addPet) petCountForm.querySelectorAll('[name^="newPets["]').forEach((input) => {
        if (input.disabled) return;
        const match = input.name.match(/^newPets\[(\d+)\]\.([A-Za-z0-9]+)$/);
        if (!match) return;
        const index = Number(match[1]);
        newPetMap[index] = newPetMap[index] || {};
        newPetMap[index][match[2]] = input.value;
      });
      const newPets = newPetMap.filter(Boolean);
      if (!reason || (!removePetIds.length && !newPets.length)) {
        const error = petCountForm.querySelector(".form-error") || document.createElement("p");
        error.className = "form-error"; error.setAttribute("role", "alert"); error.textContent = "請選擇新增／移除寵物，並填寫變更原因。";
        if (!error.isConnected) petCountForm.prepend(error);
        return;
      }
      if (!confirm(`確認入住寵物數量由 ${Number(currentBooking.quantity || 0)} 改為 ${Number(currentBooking.quantity || 0) - removePetIds.length + newPets.length}？系統會依原 Pricing Engine 重算費用；已收訂金金額會保留，並只更新尾數。`)) return;
      submitApi("petCountUpdate", Object.assign({}, currentVersion, { data: { removePetIds, newPets, reason } }), petCountForm);
    };
    const newBookingView = window.LittleLandStaffNewBookingView;
    if (newBookingView) newBookingView.bind({
      app, store, api: StaffAPI, router: StaffRouter, readCache, toast, handleAuth, paint,
      isPending: () => pendingAction,
      setPending: (value) => { pendingAction = value; },
      setError: (value) => { errorText = value || ""; },
    });
    const sf=app.querySelector("#scheduleForm"); if(sf) sf.onsubmit=e=>{e.preventDefault();submitApi("scheduleSave",{schedule:{workDate:sf.date.value,staffId:sf.staffId.value,status:sf.status.value,startTime:sf.startTime.value,endTime:sf.endTime.value,notes:sf.note.value}},sf);};
    const sw=app.querySelector("#swapForm"); if(sw) sw.onsubmit=e=>{e.preventDefault();if(sw.staffId.value===sw.targetStaffId.value){errorText="請選擇兩位不同員工。";paint();return;}submitApi("scheduleSwap",{schedule:{workDate:sw.date.value,staffId:sw.staffId.value,targetStaffId:sw.targetStaffId.value}},sw);};
    const rf = app.querySelector("#revenueYearForm");
    if (rf) rf.onsubmit = (event) => {
      event.preventDefault();
      const year = String(rf.elements.year.value);
      store.state.revenueYear = year;
      if (!String(store.state.revenueMonth || "").startsWith(year + "-")) store.state.revenueMonth = `${year}-01`;
      readCache.clear();
      loadPageData("revenue", { force: true }).then(paint);
    };
    app.querySelectorAll("[data-revenue-month]").forEach((button) => button.onclick = async () => {
      store.state.revenueMonth = button.dataset.revenueMonth;
      store.state.revenueYear = button.dataset.revenueMonth.slice(0, 4);
      readCache.clear();
      await loadPageData("revenue", { force: true });
      paint();
    });
    app.querySelectorAll("[data-copy-whatsapp]").forEach((button) => button.onclick = async () => {
      let text;
      try { text = decodeURIComponent(button.dataset.copyWhatsapp || ""); }
      catch (_) { toast("草稿內容無法讀取，請重新整理頁面。"); return; }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
        else {
          const input = document.createElement("textarea"); input.value = text; input.setAttribute("readonly", ""); input.style.position = "fixed"; input.style.opacity = "0";
          document.body.appendChild(input); input.select(); const copied = document.execCommand("copy"); input.remove();
          if (!copied) throw new Error("clipboard unavailable");
        }
        toast("WhatsApp 草稿已複製；傳送前請核對內容。");
      } catch (_) { toast("無法自動複製，請展開訊息預覽後手動複製。"); }
    });
    app.querySelectorAll("[data-adjust='earlyCheckout']").forEach((button) => button.onclick = () => {
      const actualCheckoutDate = prompt("輸入實際退房日期 YYYY-MM-DD");
      if (!actualCheckoutDate) return;
      const reason = prompt("提早退房原因");
      if (!reason || !confirm(`確認記錄實際退房日 ${actualCheckoutDate}？`)) return;
      submitApi("earlyCheckout", Object.assign({}, currentVersion, { data: { actualCheckoutDate, reason, description: "員工記錄提早退房" } }), null);
    });
    app.querySelectorAll("[data-action]")
      .forEach(
        (x) =>
          (x.onclick = () =>
            mutate(x.dataset.action, StaffRouter.current().id)),
      );
    app.querySelectorAll("[data-follow]").forEach(
      (x) =>
        (x.onclick = () => {
          const n = prompt("請輸入聯絡結果／備註");
          if (n && n.trim())
            mutate("followup", x.dataset.follow, {
              data: { note: n, required: false },
            });
        }),
    );
  }
  function uuid() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  function findBooking(bookingId) {
    const id = String(bookingId);
    const detail = store.state.detail || {};
    const candidates = [
      detail.detail,
      detail.booking,
      ...arr(store.state.records),
      ...arr(store.state.dashboard?.todaySchedule),
      ...arr(store.state.dashboard?.recent),
      ...arr(store.state.dashboard?.followups),
      ...arr(store.state.followups),
      ...arr(store.state.payments),
      ...arr(store.state.paymentData?.items),
      ...arr(store.state.calendar?.bookings),
    ];
    return candidates.find((x) => x && String(idOf(x)) === id) || null;
  }
  async function mutate(action, bookingId, extra = {}, form) {
    if (pendingAction) return;
    pendingAction = true;
    if (form)
      form.querySelectorAll("button").forEach((x) => (x.disabled = true));
    const detail = store.state.detail || {},
      currentPage = StaffRouter.current().page,
      b = findBooking(bookingId) || detail.detail || detail.booking || {},
      payload = Object.assign(
        {
          bookingId,
          expectedRecordVersion: b.recordVersion,
          expectedStatus: b.bookingStatus,
          idempotencyKey: uuid(),
        },
        extra,
      );
    if (action === "cancel") {
      const r = prompt("請輸入取消原因");
      if (r == null || !r.trim()) {
        pendingAction = false;
        paint();
        return;
      }
      payload.reason = r.trim();
      if (!confirm("確認取消此預約？不會自動退款。")) {
        pendingAction = false;
        paint();
        return;
      }
    }
    if (["cashDepositUse", "cashDepositRefund"].includes(action)) {
      const maxAmount =
        action === "cashDepositRefund"
          ? Number(b.cashDepositRefundDue || 0)
          : Math.max(
              0,
              Number(b.cashDepositAmount || 0) -
                Number(b.cashDepositUsedAmount || 0) -
                Number(b.cashDepositRefundedAmount || 0),
            );
      const a = prompt(`輸入金額（上限 ${amount(maxAmount)}）`);
      if (a == null || !a.trim()) {
        pendingAction = false;
        paint();
        return;
      }
      const amountValue = Number(a);
      if (
        !Number.isFinite(amountValue) ||
        amountValue <= 0 ||
        amountValue > maxAmount
      ) {
        errorText = "金額必須大於 HK$0，且不可超過可使用／應退金額。";
        pendingAction = false;
        paint();
        return;
      }
      payload.data = Object.assign({}, payload.data, { amount: amountValue });
    }
    if (
      ["recordBalance", "cashDepositCollect"].includes(action) &&
      !confirm(
        action === "recordBalance"
          ? "確認已實際收到尾數？"
          : "確認已實際收取現金按金？",
      )
    ) {
      pendingAction = false;
      paint();
      return;
    }
    if (
      action === "confirmDeposit" &&
      !confirm(
        "請確認已實際收到訂金。系統會再次檢查房態；如衝突不會確認或佔房。",
      )
    ) {
      pendingAction = false;
      paint();
      return;
    }
    try {
      if (
        (!payload.expectedRecordVersion || !payload.expectedStatus) &&
        bookingId
      ) {
        const latest = await StaffAPI.request(
          "bookingDetail",
          { bookingId },
          store.token,
        );
        const latestBooking = latest.detail || latest.booking || {};
        payload.expectedRecordVersion = latestBooking.recordVersion;
        payload.expectedStatus = latestBooking.bookingStatus;
      }
      const r = await StaffAPI.request(action, payload, store.token);
      if (
        action === "confirmDeposit" &&
        r.confirmed === false &&
        r.roomConflict
      ) {
        store.state.depositConflictBookingId = String(bookingId);
        errorText = "";
        toast("訂金已記錄，但仍待處理、未分房，請人工跟進");
      } else toast("操作已由 TEST API 確認。");
      if (action === "followup" && payload.data?.required)
        store.state.followupDraft = "";
      if (action === "edit") store.state.editDraft = null;
      readCache.clear();
      await loadPageData(currentPage === "detail" ? "detail" : currentPage);
    } catch (e) {
      if (!handleAuth(e))
        errorText = e.conflict
          ? `資料衝突，請重新載入後核對；輸入已保留。${e.message}`
          : e.message;
    } finally {
      pendingAction = false;
      paint();
    }
  }
  async function logout() {
    const token = store.token;
    clearPrivate();
    errorText = "";
    paint();
    if (token)
      try {
        await StaffAPI.request("logout", {}, token);
      } catch (_) {
        toast("本機 token 已清除；遠端撤銷未能確認。");
      }
  }
  async function route() {
    if (!store.token) {
      paint();
      return;
    }
    await loadPageData(StaffRouter.current().page);
    paint();
  }
  window.addEventListener("hashchange", route);
  if (store.token)
    StaffAPI.request("session", {}, store.token)
      .then((d) => {
        store.state.staff = d.staff || {};
        route();
      })
      .catch((e) => {
        handleAuth(e);
        if (store.token) clearPrivate();
        paint();
      });
  else paint();
  ["booking-reference.js", "calendar-view.js", "revenue-chart.js", "schedule-view.js"].forEach((src) => {
    if (src === "booking-reference.js" && window.LittleLandBookingReference) return;
    const script = document.createElement("script"); script.src = src; script.onload = () => { if (store.token) route(); else paint(); }; document.head.appendChild(script);
  });
})();
