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
  ];
  const rooms = ["S1", "S2", "S3", "A1", "A2", "A3", "B1", "B2", "C1", "F1"];
  let errorText = "",
    busy = false,
    pendingAction = false;
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
  const arr = (v) => (Array.isArray(v) ? v : []);
  const get = (o, ...ks) => {
    for (const k of ks) if (o && o[k] != null && o[k] !== "") return o[k];
    return "—";
  };
  const amount = (v) =>
    v == null || v === "" ? "—" : `HK$${Number(v).toLocaleString("zh-HK")}`;
  const idOf = (b) => get(b, "bookingId", "id"),
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
  const friendly = (v) =>
    ({
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
    })[String(v)] || v;
  const status = (v) =>
    `<span class="badge ${["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "COMPLETED"].includes(v) ? "status-green" : ["PENDING_CONFIRMATION", "PENDING_DEPOSIT"].includes(v) ? "status-orange" : v === "CANCELLED" ? "status-gray" : "status-purple"}">${esc(labels[v] || v)}</span>`;
  const role = () =>
    String(
      (store.state.staff && store.state.staff.role) ||
        (store.state.summary && store.state.summary.role) ||
        "",
    ).toUpperCase();
  function toast(t) {
    const e = document.getElementById("toast");
    if (e) {
      e.textContent = t;
      e.classList.add("show");
      setTimeout(() => e.classList.remove("show"), 3500);
    }
  }
  function clearPrivate() {
    store.clear();
    store.state.followupDraft = "";
    store.state.depositConflictBookingId = "";
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
        await loadPageData("dashboard");
        StaffRouter.go("dashboard");
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
    `<div class="page-head"><div><h1>${esc(t)}</h1>${s ? `<p>${esc(s)}</p>` : ""}</div></div>`;
  const stat = (t, v) =>
    `<div class="stat"><strong>${esc(v == null ? "—" : v)}</strong><span>${esc(t)}</span></div>`;
  function conflictNotice(b) {
    if (!b || b.roomConflict !== true) return "";
    const paid = b.depositStatus === "PAID";
    return `<span class="room-conflict-warning" role="alert"><strong>房間衝突</strong> — ${paid ? "訂金已收" : "訂金尚未確認已收"}；目前沒有可用房間。未有房間分配，預約未確認。請員工手動聯絡客人跟進；請勿承諾房間。</span>`;
  }
  function card(b) {
    return `<button class="booking-card" data-detail="${esc(idOf(b))}"><span class="title">🐾 ${esc(idOf(b))} · ${esc(get(b, "customerName", "parentName"))}</span>${conflictNotice(b)}<span class="meta">${esc(get(b, "petNames"))}　${esc(get(b, "checkinDate", "checkInDate"))} ${esc(get(b, "checkinTime"))} → ${esc(get(b, "checkoutDate", "checkOutDate"))} ${esc(get(b, "checkoutTime"))}</span><br>${status(statusOf(b))} <span class="meta">${esc(roomNames[b.roomTypeId] || get(b, "roomTypeId"))}</span></button>`;
  }
  const list = (a, e = "目前沒有資料") =>
    arr(a).length
      ? arr(a).map(card).join("")
      : `<div class="empty">${esc(e)}</div>`;
  async function loadPageData(page) {
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
      },
      action = map[page];
    if (!action) return;
    store.state.loading = true;
    errorText = "";
    paint();
    try {
      let p = {};
      if (page === "detail") p = { bookingId: StaffRouter.current().id };
      if (page === "calendar") {
        const d = store.state.calendarDate || new Date();
        p.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }
      if (page === "revenue" || page === "payments") {
        const d = new Date();
        p.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }
      const d = await StaffAPI.request(action, p, store.token);
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
      else if (page === "settings") store.state.settings = d;
      else if (page === "detail") {
        store.state.detail = d;
        store.state.booking = d.detail || d.booking || {};
      }
    } catch (e) {
      if (!handleAuth(e)) errorText = e.message;
    } finally {
      store.state.loading = false;
    }
  }
  function dashboard() {
    const d = store.state.dashboard || {},
      c = d.counts || {};
    return `${head("概覽", "今日營運與近期預約")}<div class="stats">${stat("今日入住", c.todayCheckins)}${stat("今日退房", c.todayCheckouts)}${stat("待確認", c.pendingConfirmation)}${stat("待付訂金", c.pendingDeposit)}${stat("已確認", c.confirmed)}${stat("待跟進", c.followUp)}${stat("房間衝突", c.roomConflicts ?? d.roomConflictCount ?? arr(d.roomConflicts).length)}</div><section class="card"><h2>房間衝突</h2>${list(d.roomConflicts, "目前沒有房間衝突")}</section><section class="card"><h2>今日入住／退房時間表</h2>${list(d.todaySchedule, "今日沒有入住／退房預約")}</section><section class="card"><h2>需要跟進</h2>${list(d.followups, "目前沒有需要跟進的預約")}</section><section class="card"><h2>近期預約</h2>${list(d.recent, "目前沒有近期預約")}</section>`;
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
    const d = store.state.calendar || {},
      now = store.state.calendarDate || new Date(),
      y = now.getFullYear(),
      m = now.getMonth(),
      first = new Date(y, m, 1),
      days = new Date(y, m + 1, 0).getDate(),
      offset = (first.getDay() + 6) % 7,
      today = new Date(),
      selected =
        store.state.selectedCalendarDate ||
        (today.getFullYear() === y && today.getMonth() === m
          ? `${y}-${String(m + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
          : `${y}-${String(m + 1).padStart(2, "0")}-01`),
      bookings = arr(d.bookings),
      cells = Array(offset).fill(
        '<div class="day-cell muted" aria-hidden="true"></div>',
      );
    for (let n = 1; n <= days; n++) {
      const date = `${y}-${String(m + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`,
        active = bookings.filter(
          (b) =>
            ["CONFIRMED", "CHECKED_IN"].includes(statusOf(b)) &&
            String(b.checkinDate || "") <= date &&
            String(b.checkoutDate || "") > date &&
            parseRooms(b).length,
        ),
        pend = bookings.some(
          (b) =>
            ["PENDING_CONFIRMATION", "PENDING_DEPOSIT"].includes(statusOf(b)) &&
            String(b.checkinDate || "") <= date &&
            String(b.checkoutDate || "") > date,
        );
      cells.push(
        `<button class="day-cell ${date === selected ? "selected" : ""}" data-date="${date}" aria-label="${n}日${active.length ? "有已分配房間" : ""}${pend ? "有待處理申請" : ""}"><b>${n}</b><span class="day-markers">${active.length ? '<i class="marker green"></i>' : ""}${pend ? '<i class="marker orange"></i>' : ""}</span></button>`,
      );
    }
    const active = bookings.filter(
        (b) =>
          ["CONFIRMED", "CHECKED_IN"].includes(statusOf(b)) &&
          String(b.checkinDate || "") <= selected &&
          String(b.checkoutDate || "") > selected,
      ),
      pending = bookings.filter(
        (b) =>
          ["PENDING_CONFIRMATION", "PENDING_DEPOSIT"].includes(statusOf(b)) &&
          String(b.checkinDate || "") <= selected &&
          String(b.checkoutDate || "") > selected,
      );
    const roomCards = rooms
      .map((r) => {
        const allocations = active.filter((x) => parseRooms(x).includes(r));
        const conflictRoom = allocations.length > 1;
        return `<div class="room ${conflictRoom ? "conflict" : allocations.length ? "busy" : ""}"><b>${esc(r)}</b>${conflictRoom ? '<strong class="room-conflict-label">房態衝突</strong>' : allocations.length ? "<strong>已佔房</strong>" : "<span>空房</span>"}${allocations.map((b) => `<article class="room-booking"><p>🐾 ${esc(get(b, "petNames"))}</p><p>${esc(get(b, "checkinDate"))} ${esc(get(b, "checkinTime"))} → ${esc(get(b, "checkoutDate"))} ${esc(get(b, "checkoutTime"))}</p><button class="btn secondary" data-detail="${esc(idOf(b))}">Detail · ${esc(idOf(b))}</button></article>`).join("")}</div>`;
      })
      .join("");
    return `${head("房間月曆", "依入住日含、退房日不含顯示實體房；待處理申請不佔房。")}<section class="card"><div class="calendar-head"><button class="btn secondary" data-month="-1">‹ 上月</button><h2>${y}年${m + 1}月</h2><button class="btn secondary" data-month="1">下月 ›</button></div><div class="month-grid">${["一", "二", "三", "四", "五", "六", "日"].map((x) => `<div class="weekday">${x}</div>`).join("")}${cells.join("")}</div><p class="meta">綠色：已確認／入住　橙色：待處理（不佔房）</p></section><section class="card"><h2>${esc(selected)} · 實體房況</h2><div class="room-list">${roomCards}</div><h3 class="section-title">當日待處理申請（不佔房）</h3>${list(pending, "當日沒有待處理申請")}</section>`;
  }
  function whatsapp(b) {
    const phone = String(b.phone || "").replace(/\D/g, "");
    if (!/^[2-9]\d{7}$/.test(phone)) return "";
    const draft = `Booking ${idOf(b)}｜入住日 ${get(b, "checkinDate")}，請 LittleLand 跟進。`;
    return `<a class="btn whatsapp" href="https://wa.me/852${phone}?text=${encodeURIComponent(draft)}" target="_blank" rel="noopener noreferrer">WhatsApp 草稿</a>`;
  }
  function followups() {
    const rows = arr(store.state.followups);
    return `${head("待跟進", "員工手動聯絡；WhatsApp 僅開啟草稿，不會自動發送。")}${rows.length ? rows.map((b) => `<article class="card"><p><b>${esc(idOf(b))} · ${esc(get(b, "parentName", "customerName"))}</b> ${status(statusOf(b))}</p>${conflictNotice(b)}<p>${esc(get(b, "phone"))} · ${esc(roomNames[b.roomTypeId] || get(b, "roomTypeId"))} · 入住 ${esc(get(b, "checkinDate"))}</p><p>最後聯絡：${esc(get(b, "lastContactedAt"))} · ${esc(get(b, "lastContactedBy"))}<br>${esc(get(b, "followUpNote"))}</p><div class="row">${whatsapp(b)}<button class="btn secondary" data-follow="${esc(idOf(b))}">記錄已聯絡／備註</button><button class="btn" data-detail="${esc(idOf(b))}">開啟預約</button></div></article>`).join("") : '<div class="empty">沒有待跟進預約</div>'}`;
  }
  function payments() {
    const d = store.state.paymentData || {},
      s = d.summary || {};
    return `${head("付款", "待收款項及今日已收；操作在 Booking Detail 完成。")}<div class="stats">${stat("待收訂金", amount(s.pendingDepositsTotal))}${stat("待收尾數", amount(s.pendingBalancesTotal))}${stat("待收現金按金", amount(s.pendingCashDepositsTotal))}${stat("待退現金按金", amount(s.cashDepositsToRefundTotal))}${stat("今日已收", amount(s.receivedTodayTotal))}</div><section class="card"><h2>付款相關預約</h2>${list(d.items || d.payments, "沒有付款待辦")}</section>`;
  }
  function customers() {
    const rows = arr(store.state.customers);
    return `${head("客戶", "搜尋姓名、電話或 Email；歷史預訂連到共同 detail")}<div class="field"><label for="customerQ">姓名／電話／Email</label><input id="customerQ" placeholder="搜尋客戶"></div><div id="customerResults">${
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
    const d = store.state.revenue || {};
    return `${head("基本營收", "本月 TEST 營運摘要")}<div class="notice">以下為已收住宿款項，不包括現金按金。</div><div class="stats">${stat("本月已收訂金", amount(d.monthDepositsReceived))}${stat("本月已收尾數", amount(d.monthBalancesReceived))}${stat("本月住宿收入", amount(d.monthAccommodationRevenue))}</div><div class="grid two"><section class="card"><h2>按房型</h2>${groups(d.byRoomType, roomNames)}</section><section class="card"><h2>按寵物種類</h2>${groups(d.bySpecies, speciesNames)}</section></div>`;
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
  function detail() {
    const d = store.state.detail;
    if (!d)
      return `${head("Booking Detail")}<div class="empty">尚未載入預約資料。</div>`;
    const b = d.detail || d.booking || {},
      pets = arr(d.pets),
      payments = arr(d.payments),
      logs = arr(d.logs),
      history = arr(d.followupHistory),
      s = b.bookingStatus,
      viewer = role() === "VIEWER",
      admin = role() === "ADMIN";
    const actions = [];
    if (!viewer) {
      if (s === "PENDING_CONFIRMATION")
        actions.push(["confirmData", "確認資料"]);
      if (s === "PENDING_DEPOSIT")
        actions.push(["confirmDeposit", "確認已收訂金"]);
      if (s === "CHECKED_IN" && b.balanceStatus === "UNPAID")
        actions.push(["recordBalance", "記錄尾數"]);
      if (s === "CHECKED_IN" && b.cashDepositStatus === "NOT_COLLECTED")
        actions.push(["cashDepositCollect", "收現金按金"]);
      if (["COLLECTED", "PARTIALLY_USED"].includes(b.cashDepositStatus)) {
        if (
          Number(b.cashDepositAmount || 0) -
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
      if (admin) actions.push(["edit", "更新資料"]);
    }
    const conflict =
        b.roomConflict === true ||
        (d.confirmed === false && d.roomConflict === true) ||
        store.state.depositConflictBookingId === String(idOf(b)),
      refund =
        b.cashDepositRefundDue != null
          ? b.cashDepositRefundDue
          : get(b, "cashDepositRefundDue", "cashDepositRefundAmount"),
      services = serviceItems(b);
    return `${head("Booking Detail", idOf(b))}${conflict ? `<div class="danger-box" role="alert"><strong>房間衝突：</strong>${b.depositStatus === "PAID" || store.state.depositConflictBookingId === String(idOf(b)) ? "訂金已收" : "訂金尚未確認已收"}；目前沒有可用房間。未有房間分配，預約未確認。請員工手動聯絡客人跟進；請勿承諾房間。</div>` : ""}<section class="card"><h2>預約 ${esc(idOf(b))} ${status(s)}</h2>${kv(
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
    }</section><section class="card"><h2>收費</h2>${kv(b, [
      ["基本房費", "baseRoomFee"],
      ["額外寵物費", "extraPetFee"],
      ["週末附加費", "weekendFee"],
      ["服務費合計", "serviceFees"],
      ["附加費合計", "totalSurcharges"],
      ["預計住宿總額", "estimatedTotal"],
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
    )}${payments.map((p) => `<p>${esc(get(p, "paymentType"))} · ${esc(amount(p.amount))} · ${esc(get(p, "paidAt"))} · ${esc(get(p, "paymentStatus"))}</p>`).join("") || "<p>沒有付款紀錄</p>"}</section><section class="card"><h2>最後聯絡及跟進歷史</h2><p>${esc(get(b, "lastContactedAt"))} · ${esc(get(b, "lastContactedBy"))}<br>${esc(get(b, "followUpNote"))}</p>${history.map((x) => `<p>${esc(get(x, "createdAt"))} · ${esc(get(x, "staffName"))} · ${esc(get(x, "note"))}</p>`).join("") || "<p>沒有跟進歷史</p>"}<form id="followForm" class="field"><label for="followNote">新增跟進備註</label><textarea id="followNote" name="note" required>${esc(store.state.followupDraft || "")}</textarea><button class="btn" ${pendingAction ? "disabled" : ""}>新增跟進</button></form></section><section class="card"><h2>操作 Logs</h2>${logs.map((x) => `<p>${esc(get(x, "createdAt"))} · ${esc(get(x, "action"))} · ${esc(get(x, "summary"))}</p>`).join("") || '<div class="empty">沒有 Logs</div>'}</section>${!viewer ? `<section class="card"><h2>可用操作</h2><div class="action-grid">${actions.map(([a, t]) => `<button class="btn secondary" data-action="${a}" ${pendingAction ? "disabled" : ""}>${esc(t)}</button>`).join("")}</div></section>` : '<div class="notice">唯讀帳戶：沒有可用 mutation 操作。</div>'}${admin ? (() => {
      const draft = store.state.editDraft || {}, fieldValue = (key, fallback) => draft[key] !== undefined ? draft[key] : (fallback == null ? "" : fallback);
      const textField = (label, key, fallback, type = "text") => `<label>${esc(label)}</label><input name="${esc(key)}" type="${type}" value="${esc(fieldValue(key, fallback))}">`;
      const selectField = (label, key, value, options) => `<label>${esc(label)}</label><select name="${esc(key)}">${options.map(([v, title]) => `<option value="${esc(v)}" ${String(fieldValue(key, value)) === String(v) ? "selected" : ""}>${esc(title)}</option>`).join("")}</select>`;
      const yesNo = [["true", "是"], ["false", "否"]];
      const petFields = pets.map((pet, i) => {
        const pd = draft.pets && draft.pets[i] || {}, pv = (key) => pd[key] !== undefined ? pd[key] : (pet[key] == null ? "" : pet[key]);
        const pselect = (key, label, options, fallback) => `<label>${esc(label)}</label><select data-pet-field="${i}:${esc(key)}">${options.map(([v,t]) => `<option value="${esc(v)}" ${String(pv(key) === "" ? fallback : pv(key)) === String(v) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
        const pinput = (key, label, type = "text") => `<label>${esc(label)}</label><input data-pet-field="${i}:${esc(key)}" type="${type}" value="${esc(pv(key))}">`;
        const hamster = b.species === "HAMSTER", male = String(pv("sex") || pet.sex).toLowerCase() === "male";
        return `<article class="pet edit-pet"><h3>寵物 ${i + 1} · ${esc(get(pet,"name","petName"))}</h3>${pinput("name","名稱")}${pinput("breed","品種")}${pinput("ageValue","年齡數值","number")}${pselect("ageUnit","年齡單位",[["month","月"],["year","歲"]],"month")}${pselect("sex","性別",[["male","男孩子"],["female","女孩子"]],"female")}${!hamster ? pselect("sterilized","絕育",yesNo,false) : ""}${!hamster && !male ? pselect("pregnant","懷孕",yesNo,false) : ""}${pselect("recentSurgery30Days","最近 30 日手術",yesNo,false)}${pselect("vetVisit","最近看獸醫",yesNo,false)}${pinput("vetDetails","獸醫詳情")}${pselect("infectiousDisease","傳染病",yesNo,false)}${pinput("infectiousDetails","傳染病詳情")}${pselect("chronicDisease","慢性疾病",yesNo,false)}${pinput("chronicDetails","慢性疾病詳情")}${pselect("medication","正在服藥",yesNo,false)}${pinput("medicationDetails","藥物詳情")}${pinput("specialCare","特殊照顧")}${!hamster ? pselect("fleaTreatment","一個月內杜蝨",yesNo,false) : ""}</article>`;
      }).join("");
      return `<section class="card"><h2>更新資料（管理員）</h2><form id="editForm" class="field">${textField("家長姓名","parentName",b.parentName || b.customerName || "")}${textField("電話","phone",b.phone,"tel")}${textField("Email","email",b.email,"email")}${textField("緊急聯絡人 1","emergency1",b.emergency1)}${textField("緊急聯絡人 2","emergency2",b.emergency2)}${textField("指定獸醫／診所","vet",b.vet)}${selectField("入住時間","checkinTime",b.checkinTime,["14:30–15:30","15:30–16:30","16:30–17:00"].map(x=>[x,x]))}${selectField("退房時間","checkoutTime",b.checkoutTime,["14:30–15:30","15:30–16:30","16:30–17:00"].map(x=>[x,x]))}${textField("主糧","foodMain",b.foodMain)}${textField("牧草","hay",b.hay)}${textField("餵食","feeding",b.feeding)}${selectField("蔬菜","vegetables",b.vegetables,[["","—"],["yes","是"],["no","否"]])}<h3>寵物資料</h3>${petFields}<label>目前管理員密碼（重新驗證）</label><input name="reauthPassword" type="password" autocomplete="current-password" required><button class="btn" ${pendingAction ? "disabled" : ""}>重新驗證並更新</button></form></section>`;
    })() : ""}`;
  }
  function settings() {
    const s = store.state.settings || {};
    return `${head("設定／登出", "TEST 環境帳戶")}<section class="card"><h2>登入資料</h2><p>${esc(get(s, "staff.displayName"))} · ${esc(get(s, "staff.role"))}</p><p class="meta">Session token 只保存在 sessionStorage。</p><button class="btn danger" data-logout>登出並撤銷 Session</button></section>`;
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
      };
    shell(p, (views[p] || dashboard)());
    bind(p);
  }
  function bind(page) {
    const retry = app.querySelector("[data-retry]");
    if (retry) retry.onclick = () => loadPageData(page).then(paint);
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
      cq.oninput = () =>
        app
          .querySelectorAll(".customer")
          .forEach(
            (x) =>
              (x.hidden = !x.textContent
                .toLowerCase()
                .includes(cq.value.toLowerCase())),
          );
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
      const yesKeys = new Set(["sterilized", "pregnant", "recentSurgery30Days", "vetVisit", "infectiousDisease", "chronicDisease", "medication", "fleaTreatment"]);
      const readEdit = () => {
        const data = {};
        ["parentName", "phone", "email", "emergency1", "emergency2", "vet", "checkinTime", "checkoutTime", "foodMain", "hay", "feeding", "vegetables"].forEach((k) => { const el = ef.elements.namedItem(k); if (el) data[k] = el.value; });
        data.pets = arr((store.state.detail || {}).pets).map((pet, i) => {
          const item = { petId: pet.petId };
          ef.querySelectorAll(`[data-pet-field^="${i}:"]`).forEach((el) => {
            const key = el.dataset.petField.slice(el.dataset.petField.indexOf(":") + 1);
            item[key] = yesKeys.has(key) ? el.value === "true" : el.value;
          });
          const age = Number(item.ageValue);
          item.ageInMonths = item.ageUnit === "year" ? age * 12 : age;
          return item;
        });
        return data;
      };
      ef.querySelectorAll('[data-pet-field$=":sex"]').forEach((el) => el.addEventListener("change", () => {
        const i = el.dataset.petField.split(":")[0], pregnancy = ef.querySelector(`[data-pet-field="${i}:pregnant"]`);
        if (pregnancy) { pregnancy.hidden = el.value === "male"; if (pregnancy.previousElementSibling) pregnancy.previousElementSibling.hidden = el.value === "male"; }
      }));
      ef.onsubmit = (e) => {
        e.preventDefault();
        const data = readEdit();
        store.state.editDraft = data;
        if (!confirm("確認更新聯絡、飲食／時間及現有寵物資料？寵物數量、種類、狀態、房間、價格及付款資料不會更改。")) return;
        mutate("edit", StaffRouter.current().id, { data, reauthPassword: ef.elements.reauthPassword.value }, ef);
      };
    }
    app
      .querySelectorAll("[data-action]")
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
    if (action === "edit" && role() !== "ADMIN") {
      pendingAction = false;
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
})();
