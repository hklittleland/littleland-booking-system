# TASK-001 — Booking Frontend UI

狀態：完成（TASK-001 Booking Frontend UI + Mock Data及本次補充）。本 Task 已停止並回報，等待使用者確認；不得開始 TASK-002。

## 1. 手機優先預約介面與五步導覽

- 建立 `/booking/index.html`、`/booking/styles.css`、`/booking/booking.js`，並僅使用本 Task 要求的 Mock Data。
- 預約主要五步為「時間 → 種類 → 房型 → 寵物資料 → 確認」，頂部使用圓角 Step Indicator；流程同時完整呈現聯絡、飲食、服務、收費摘要及模擬完成頁。
- 沿用 LittleLand 可愛、柔和、簡潔風格：淡粉紅＋淡藍＋淡綠漸層背景、紫色至粉紅色品牌色及主要按鈕、白色大圓角卡片及柔和陰影、Nunito 與 Noto Sans TC；房型使用卡片而非普通 Select，選中卡片呈紫色邊框與淡紫背景；成功綠色、警告黃色／橙色、錯誤紅色；成功畫面有 🎉 及 Confetti 動畫。
- 毛孩種類選擇卡使用兔子、天竺鼠、倉鼠各一張原創清新手繪小動物插圖，三張視覺風格一致，透明底、適合手機顯示。
- Mobile First；不得有橫向捲動、手機按鈕太細、iPhone 顯示全白或以 x-cloak 隱藏整個頁面。

## 2. 日期、時段及客人可見的 Mock 房態

- 入住日期不可早於今日；退房日期必須晚於入住日期，不可同日入住退房，最少 1 晚。入住日期包括，退房日期不包括。日期重疊判定規則為 `newCheckout > existingCheckin AND newCheckin < existingCheckout`；例如 11 月 1 日入住、11 月 3 日退房代表入住 1 日與 2 日兩晚，下一位可在 3 日入住。
- 客人選擇或更改入住／退房日期後，第一步須即時判斷既有週末短住規則；入住日在星期五／六／日且只住 1 晚時，立即清楚提醒將收取 HK$250 週末短住附加費。若更改日期後條件不再成立，須同步移除該提醒；不得改變既有費用或適用日規則。
- 入住時段為 14:30–15:30、15:30–16:30、16:30–17:00；提早入住一次性附加 HK$200。退房時段為 14:30–15:30、15:30–16:30、16:30–17:00；17:00 後延遲退房一次性附加 HK$200。提早入住與延遲退房各自不可重複收費。
- 只以 Mock Data 呈現客人可見房態「可預訂／不可預訂／查詢中／暫時無法確認」；不得顯示實體房 ID、Virtual Room ID、其他 Booking ID、其他客人、待付訂金、員工 Follow-up 或不可預訂原因。本 Task 不呼叫真實房態 API。

## 3. 寵物種類、房型卡片、數量及寵物資料

- 寵物種類僅兔子、天竺鼠、倉鼠；一張訂單一個房間，只可有多隻同種類寵物，不同物種不可混住；如需兩房必須分兩張訂單。
- 使用以下 ID 作唯一代碼，中文名稱僅作顯示名：`DELUXE_ROOM`、`PRIVATE_SUITE`、`DELUXE_SUITE`、`VERY_DELUXE_SUITE`、`STANDARD_ROOM`、`HAMSTER_BOX`、`OWN_CAGE`。
- 價格／入住上限：兔子「豪華房」HK$178／晚、最多 1 隻；「獨立套房」HK$278／晚、最多 2 隻；「豪華套房」HK$350／晚、最多 3 隻；「非常.豪華套房」HK$600／晚、最多 3 隻。天竺鼠「標準房」HK$98／晚、最多 1 隻；「豪華房」HK$178／晚、最多 3 隻；「獨立套房」HK$278／晚、最多 3 隻；「豪華套房」HK$350／晚、最多 5 隻；「非常.豪華套房」HK$600／晚、最多 5 隻。倉鼠「標準房」HK$98／晚、最多 1 隻；「整理箱」HK$65／晚、最多 1 隻；「自備籠」HK$50／晚、最多 1 隻。
- 寵物數量使用 Number Input，必須為整數、>=1 且 <= 該物種／房型上限；拒絕 0、負數、小數、文字及空白。更改房型後立即重新驗證；超出上限顯示錯誤且不能下一步，不可自動截斷數量；數量或房型無效時，費用摘要的總額與訂金顯示「待修正」並提示修正，不能把超限輸入計成有效報價；恢復有效組合後即時重算。
- 按數量動態產生相同數量的 Pet Profile。每隻資料包括寵物名稱*、品種*、年齡*（數值＋月／歲，不接受自由文字；轉換為 `ageInMonths`）、性別*（選項顯示「男孩子／女孩子」）、絕育、是否懷孕*、最近 30 日是否接受過手術*、最近看獸醫*、傳染病*、慢性疾病*、正在服用藥物*、特殊照顧需求、一個月內杜蝨處理*。倉鼠不顯示絕育、懷孕及杜蝨欄位；選「男孩子」不顯示懷孕欄位；只有適用的欄位需要驗證。
- 最低入住年齡：兔子 >= 3 個月，天竺鼠 >= 3 個月，倉鼠 >= 2 個月；種類選擇卡清楚標示「最低入住年齡：X 個月」，表單亦顯示年齡單位「月／歲」及對應最低入住年齡。低於最低年齡不可一般預約。懷孕或最近 30 日內接受手術不可接受入住。最近看獸醫、傳染病、慢性疾病、服藥選「是」時顯示詳情並標記 `HEALTH_REVIEW_REQUIRED`，提示需人工確認健康情況。

## 4. 聯絡、飲食、服務及同意事項

- 家長聯絡資料區段圖示使用 `📲`。聯絡必填家長姓名、香港 8 位電話、Email、第 1 位及第 2 位緊急聯絡人；指定獸醫／診所選填。
- 主糧選項：兔子「Oxbow 成兔糧／Momi T（成兔）／Momi A（幼兔）／自行攜帶」；天竺鼠「Oxbow 天竺鼠糧／Momi 天竺鼠糧／自行攜帶」；倉鼠「BUNNY 倉鼠糧／自行攜帶」。
- 牧草只供兔子／天竺鼠，選項為「Joy & Fibre 1st cut／Momi 1st cut／Chewbo 1st cut／自行攜帶」。兔子／天竺鼠的餵食頻率為「每日一次／每日兩次／早晚各一次」；逢星期日或假期只能餵一次但提供雙倍份量。新鮮蔬菜只供兔子／天竺鼠，提供是／否。倉鼠為長擺糧，不顯示餵食次數選項，亦不顯示星期日／假期餵食提醒。
- 服務：單次梳毛 HK$70；每日梳毛 HK$50 × nights；每日餵藥 1 次 HK$80 × nights；每日餵藥 2 次 HK$150 × nights。每日餵藥 1 次與 2 次互斥。
- 提交前六項同意必須全部勾選：(1) 已知悉入住時需預支 HK$1,000／隻現金備用金／按金；(2) 已知悉需預付基本房費 50% 作訂金，附加費於尾數收取；(3) 已知悉訂金一經支付，不設退還；(4) 已閱讀並同意入住須知及寄養條款，並可點擊「小寵物酒店服務」連結（`https://www.hklittleland.com/%E5%B0%8F%E5%AF%B5%E7%89%A9%E9%85%92%E5%BA%97%E6%9C%8D%E5%8B%99`）另開頁面查閱；條款連結必須獨立於 checkbox label，點擊連結不得自動勾選同意；(5) 已如實申報健康狀況；(6) 如遇緊急情況，同意 LittleLand 安排獸醫診治，並承擔醫療、交通及陪診等相關費用。

## 5. 收費摘要、草稿及模擬完成頁

- 基本房費 `baseRoomFee = roomPrice * nights`。額外寵物費 `extraPetFee = Math.max(0, qty - 1) * 50 * nights`。沿用已確認的 V3.0 週末短住規則：入住日在星期五／六／日且 `nights === 1` 時 `weekendFee = 250`，否則為 0。`totalSurcharges = extraPetFee + weekendFee + serviceFees`。`estimatedTotal = baseRoomFee + totalSurcharges`。`depositAmount = baseRoomFee * 0.5`，訂金只計基本房費 50%，不可用估算總額的一半。`remainingBalance = estimatedTotal - depositAmount`。`cashDeposit = qty * 1000`，現金按金不可計入住宿總額、訂金或尾數。
- 收費摘要清晰顯示房型、每晚房價、晚數、寵物種類、數量、基本房費、額外寵物費、週末附加費、每項額外服務、附加費合計、預計住宿總額、現在需支付訂金、預計尾數、現金備用金／按金；週末附加費列須清楚說明適用入住日及一晚規則；所有實際附加費金額與合計以紅色字標示；尾數明確標示於入住當日支付，並說明其金額由基本房費餘額加上附加費合計組成。第 5 步「預約內容確認」中的家長姓名必須在家長姓名欄輸入後即時同步更新。
- 預計尾數之後，將按金提醒放在收費摘要末尾，清楚顯示「💰現金備用金／按金 HK$1,000／隻」及「請於入住當日準備，不計入住宿總額、訂金或尾數」。訂金提醒仍需顯示「⚠️ 訂金一經支付，不設退還。」
- 使用 localStorage 保存未提交表格的日期、房型、寵物資料、聯絡、食物及額外服務；不得保存 Terms Checkbox、Booking ID、房態結果、付款狀態或 Staff Session；模擬成功提交後執行 `clearDraft()`。
- 僅模擬提交，不得接 API 或提交真實資料。成功頁文案為「🎉 已收到您的預約申請！」，不得聲稱房間已正式確認；顯示 Mock Booking ID、家長、寵物、房型、入住／退房、住宿總額、訂金、預計尾數、現金按金；提示 LittleLand 將確認預約及提供訂金付款安排，完成訂金付款及確認後房間才正式保留，訂金一經支付不設退還；WhatsApp 為 62886598。
- 成功頁 WhatsApp 按鈕開啟 LittleLand 的 WhatsApp 對話並自動預填短訊，告知客人已提交預約申請，附上 Booking 示範編號、家長／寵物／房型／入住退房／主要費用等摘要，並請 LittleLand 盡快協助確認；以少量、對應內容的圖示整理文字，使訊息生活化且易讀；只開啟預填草稿，不自動發送訊息。

## 6. 範圍界線與交付

- 本 Task 僅建立預約前端 UI + Mock Data；不建立／連接 Google Apps Script、Google Sheets、Staff Login、後台、API、真實提交、Production 或付款功能。
- 本 Task 完成後停止、回報結果並等待使用者確認，不得開始 TASK-002 Pricing Engine。

---

# TASK-002 — Pricing Engine

狀態：完成。獨立計價引擎及其測試已通過；本 Task 已停止並回報，等待使用者確認；不得開始 TASK-003。

## 1. 獨立計價模組

- 新增 `booking/pricing.js`，實作純 JavaScript、無副作用、無第三方依賴的 Pricing Engine，可於瀏覽器和 Node.js 使用；匯出房型目錄、`calculatePricing(input)` 和可機器辨識的 `PricingError`。
- 輸入包括入住日、退房日、寵物種類、Room Type ID、寵物數量及服務選項；單價和上限只由引擎內建目錄查得，不接受呼叫端傳入或覆寫房價。
- 使用 Room Type ID：`DELUXE_ROOM`、`PRIVATE_SUITE`、`DELUXE_SUITE`、`VERY_DELUXE_SUITE`、`STANDARD_ROOM`、`HAMSTER_BOX`、`OWN_CAGE`；中文名稱只作顯示名稱。
- 房價／上限必須精確為：兔子：`DELUXE_ROOM` HK$178／晚、最多 1 隻；`PRIVATE_SUITE` HK$278／晚、最多 2 隻；`DELUXE_SUITE` HK$350／晚、最多 3 隻；`VERY_DELUXE_SUITE` HK$600／晚、最多 3 隻。天竺鼠：`STANDARD_ROOM` HK$98／晚、最多 1 隻；`DELUXE_ROOM` HK$178／晚、最多 3 隻；`PRIVATE_SUITE` HK$278／晚、最多 3 隻；`DELUXE_SUITE` HK$350／晚、最多 5 隻；`VERY_DELUXE_SUITE` HK$600／晚、最多 5 隻。倉鼠：`STANDARD_ROOM` HK$98／晚、最多 1 隻；`HAMSTER_BOX` HK$65／晚、最多 1 隻；`OWN_CAGE` HK$50／晚、最多 1 隻。
- 接受有效的真實 ISO `YYYY-MM-DD` 日期；`nights` 依入住日含、退房日不含計算，退房必須晚於入住。計價核心不自行新增「不可預訂日期」或最早預約日規則。
- 拒絕無效日期格式／不存在日期、退房不晚於入住、未知物種／房型、房型不屬於指定物種、數量非整數或小於 1、數量超過該物種房型上限、無效服務值、互斥餵藥服務同時選取及同一服務重複輸入；錯誤提供穩定錯誤碼，不以 UI 訊息作判斷。

## 2. 計價規則與結果

- `nights = checkout - checkin` 的曆日數；房費 `baseRoomFee = roomPrice * nights`。
- `extraPetFee = Math.max(0, quantity - 1) * 50 * nights`。
- 若入住日為星期五、星期六或星期日且 `nights === 1`，`weekendFee = 250`；否則 `weekendFee = 0`。
- 服務費：單次梳毛 HK$70；每日梳毛 HK$50 × nights；每日餵藥 1 次 HK$80 × nights；每日餵藥 2 次 HK$150 × nights。提早入住一次性 HK$200；17:00 後延遲退房一次性 HK$200。早入住／延遲退房各只收一次；每日餵藥一次與兩次互斥。
- `totalSurcharges = extraPetFee + weekendFee + serviceFees`；`estimatedTotal = baseRoomFee + totalSurcharges`。
- `depositAmount = baseRoomFee * 0.5`，訂金只按基本房費計算，不得按住宿總額計算。
- `remainingBalance = estimatedTotal - depositAmount`，作入住當日支付的預計尾數。
- `cashDeposit = quantity * 1000`；按金須獨立回傳，絕不可計入住宿總額、訂金或尾數。
- 回傳資料須逐項提供房型、每晚價格、晚數、物種、數量、基本房費、額外寵物費、週末費、各服務費及服務費小計、附加費合計、預計總額、訂金、尾數和現金按金；所有金額為 HKD 整數／可精確表示數值。
- 日期以 UTC 曆日計算，不受瀏覽器時區或夏令時間影響；星期五／六／日規則按入住日判定。

## 3. 定價測試

- 新增 `tests/pricing.test.js`，使用 Node 內建測試工具，不增加 npm dependencies。測試全部房型與物種對應價格／容量、結果公式、所有費用項目、有效週末和非適用邊界、按金與住宿金額隔離，以及所有拒絕條件。
- 必須包含指定案例：3 隻兔、豪華套房、2 晚：基本房費 HK$700、額外寵物費 HK$200、總額 HK$900、訂金 HK$350、尾數 HK$550、現金按金 HK$3,000。
- 週末核心案例：星期五入住 1 晚 +HK$250；星期六入住 1 晚 +HK$250；星期日入住 1 晚 +HK$250；星期五入住 2 晚 +HK$0；星期四入住 1 晚 +HK$0。
- 本次不把計價模組接入 `booking/booking.js` 或預約 UI；不建立 Apps Script、Sheets、API、房態、付款、後台或 Production，不部署、不合併到 `develop`／`main`。


# 最新進度更新（2026-10-30；取代上方舊的等待確認狀態）

- TASK-001 Booking Frontend UI：完成並已接受。
- TASK-002 Pricing Engine：完成並已驗收；Commit `6f002fd9ea921c313ecf90502091f1de051f332c`。
- TASK-003 Frontend Validation：依使用者指示跳過，不另行開發。
- TASK-004 TEST Sheets Schema + Initialization：已完成並驗證；只完成下列 TEST schema／初始化範圍，未合併 develop/main，交付後停止並等候驗收。

# TASK-004 — Google Sheets TEST Schema + Initialization

狀態：已完成（TEST Spreadsheet 已建立並讀回驗證；Apps Script initializer source 已完成並通過語法／mock 安全測試；未部署任何 API）。

## 1. TEST 試算表、安全界線與分頁

- 只建立一份新的 Google Spreadsheet，名稱精確為 `LittleLand_TEST`，使用已連接帳戶的預設 My Drive，不分享給其他人。建立前先檢查是否有同名檔；如有同名檔案，停止並詢問使用者，不自動重用、改名、清空或覆寫。
- 只建立原規格指定的八個工作表，名稱精確為 `Bookings`、`Pets`、`Payments`、`Rooms`、`Logs`、`IdempotencyKeys`、`Staff`、`Sessions`；欄名置於第一列，使用穩定 camelCase 欄名。
- 只用 TEST 資料庫；不可連接、讀取、匯入、複製、修改或寫入正式 LittleLand 資料或正式試算表；不可使用真實客人資料。Bookings、Pets、Payments、Logs、IdempotencyKeys、Staff、Sessions 不預填客人、付款、員工、登入 Session 或防重複提交記錄。
- 業務記錄使用獨立 ID，不可用 Google Sheet row number 作 Booking ID；測試 Booking ID 格式使用 `TEST-LL-...`。本 Task 不建立任何 Booking ID。

## 2. Schema 欄位與既定狀態

- `Bookings` 一列代表一張訂單，欄位包含獨立 `bookingId`、建立／更新時間、版本、訂單狀態、入住／退房日期與時段、物種、Room Type ID、數量、實體房間分配欄、家長姓名／電話／Email／兩位緊急聯絡人／指定獸醫、目前前台使用的訂單層主糧／牧草／餵食頻率／蔬菜欄位、額外服務、六項同意及同意時間、房價與完整計價 snapshot、`priceVersion`／`policyVersion`／`roomRuleVersion`、訂金／尾數／現金按金金額及狀態、現金按金收取／使用／退還紀錄，以及員工 follow-up 欄位。飲食欄位須符合已接受前台：倉鼠長擺糧，倉鼠餵食頻率留空且不顯示星期日／假期餵食次數欄位。
- `Bookings` 的 booking 狀態僅使用 V3.0 值：`PENDING_CONFIRMATION`、`PENDING_DEPOSIT`、`CONFIRMED`、`CHECKED_IN`、`CHECKED_OUT`、`COMPLETED`、`CANCELLED`。不佔房狀態是 `PENDING_CONFIRMATION`、`CANCELLED`、`CHECKED_OUT`、`COMPLETED`；佔房狀態是 `PENDING_DEPOSIT`、`CONFIRMED`、`CHECKED_IN`。`PENDING_DEPOSIT` 無固定付款期限，不自動倒數、取消或釋放房間。
- Booking 與 payment 狀態分開：`depositStatus` 使用 `UNPAID`／`PAID`／`REFUNDED`；`balanceStatus` 使用 `UNPAID`／`PAID`；`cashDepositStatus` 使用 `NOT_COLLECTED`／`COLLECTED`／`PARTIALLY_USED`／`REFUNDED`。按金欄位保存 `cashDepositAmount`、`cashDepositCollected`、`cashDepositCollectedAt`、`cashDepositUsedAmount`、`cashDepositRefundedAmount`、`cashDepositRefundedAt`、`cashDepositNote`。
- 訂金 snapshot 必須按 `baseRoomFee * 0.5`，附加費在尾數收取；`cashDeposit = qty * 1000`，不可計入住宿總額、訂金或尾數。保存 `roomPrice`、`nights`、`baseRoomFee`、`extraPetFee`、`weekendFee`、逐項服務費／`serviceFees`、`totalSurcharges`、`estimatedTotal`、`depositAmount`、`remainingBalance`、`cashDeposit` 及價格／政策／房規版本；前端價格不可當後端權威價格。
- `Pets` 一隻毛孩一列，以唯一 `petId` 關聯 `bookingId`；包含寵物序號、名稱、品種、年齡數值、年齡單位（月／歲）、`ageInMonths`、性別、絕育、懷孕、最近 30 日是否接受手術、最近看獸醫與詳情、傳染病與詳情、慢性疾病與詳情、服藥與詳情、特殊照顧、一個月內杜蝨及健康覆核欄位。需人工覆核時 `healthReviewStatus` 保存 `HEALTH_REVIEW_REQUIRED`，不可自動批准入住。倉鼠不適用欄位留空。
- `Payments` 以唯一 `paymentId` 關聯 `bookingId`，欄位包含付款種類、金額、幣別、付款狀態、付款方法、交易參考、付款時間、記錄員工、退款金額／時間、備註及建立時間；不接付款服務、不建立交易、不預填付款列。
- `Rooms` 保存固定房間主檔，列出 10 個實體房：S1、S2、S3 為獨立套房空間；A1、A2、A3 為豪華房；B1、B2 為標準房；C1 為整理箱；F1 為自備籠。另列 SS1（豪華套房）及 SSR1（非常.豪華套房）兩個虛擬房，以 `roomKind` 明確區分 PHYSICAL／VIRTUAL；虛擬房不得作額外實體房計數。SS1 僅可用 S1+S2 或 S2+S3，不可 S1+S3；SSR1 固定 S1+S2+S3。保留分配優先序：獨立套房 S1→S2→S3；豪華套房 S1+S2→S2+S3；豪華房 A1→A2→A3；標準房 B1→B2；整理箱 C1；自備籠 F1。房價及物種別入住上限以已確認 V3.0／Pricing Engine 為準，不建立第二個價格或容量權威來源。
- `Logs` 包含事件時間、actor 類型／員工 ID、動作、目標類型／ID、request ID、精簡摘要及變更欄位資料，供重要後台修改追蹤；不可記錄明文密碼、原始 Session token 或不必要的完整個人資料。
- `IdempotencyKeys` 包含唯一 `idempotencyKey`、操作範圍、payload hash、處理狀態、結果 Booking ID、回應代碼／可重用回應 snapshot、request ID 及建立／更新時間；相同 key 不得建立第二張訂單。規格未定義保留期限，本 Task 不新增自動 TTL。
- `Staff` 包含唯一 `staffId`、username、display name、角色、password hash／salt、active 狀態、建立／更新時間及最後登入時間欄位；角色遵從 `VIEWER`、`STAFF`、`ADMIN`。不建立員工帳號，不存明文密碼。
- `Sessions` 包含唯一 `sessionId`、`staffId`、token hash、角色 snapshot、建立／到期／撤銷／最後使用時間欄位；只保存 token hash，不保存原始 token，不建立登入 Session。原規格未定義的 Session 時限、password hash 演算法、付款方式及資料保留期，本 Task 不自行設定政策。

## 3. 初始化器與交付界線

- 建立 `docs/SHEETS-SCHEMA.md`，列出八個工作表、欄位用途、主鍵／關聯、已定義狀態值、敏感資料限制及 TEST-only 初始化方式。
- 建立 `apps-script/InitializeTestSheets.gs`，提供手動 `initializeLittleLandTestSheets(spreadsheetId)`。初始化器只接受名稱精確為 `LittleLand_TEST` 的試算表；只建立缺少的工作表及空白表頭；遇到不符表頭時停止且保留資料；不得清空或覆寫現有資料；按唯一 `roomId` 冪等補入 10 個實體房及 2 個虛擬房主檔；不得建立任何客人、寵物、付款、員工、Session 或 IdempotencyKeys 記錄。初始化器不是 API，不部署或連接正式環境。
- 建立後讀回並核對試算表名稱、八個分頁名稱／表頭及 Rooms 12 筆固定房間主檔；確認其他七表只有標題列、沒有個人／預約／付款資料。
- 本 Task 不實作 TASK-005 Inventory Engine、TASK-006 Availability API、TASK-007 Create Booking API、Staff Login/Auth API、付款系統、正式 Session、部署或 Production；不修改已接受的客人前台與 Pricing Engine。
- 使用新分支 `feature/test-sheets-schema`，所有保留程式碼／文件推送至 GitHub `hklittleland/littleland-booking-system`；不得自行 merge 到 `develop` 或 `main`。TASK-004 完成後停止並回報，等待使用者驗收。

- 初始化器必須同時驗證 Apps Script Script Property `LITTLELAND_TEST_SPREADSHEET_ID` 與目標 spreadsheet ID 完全相同，並驗證試算表名稱精確為 `LittleLand_TEST`；未設定或不符一律停止，絕不自動尋找／猜測／連接正式資料表。

## TASK-004 完成證據（2026-10-30）

已在已授權 Google Workspace 帳戶的預設 My Drive 建立 `LittleLand_TEST`，timezone 為 `Asia/Hong_Kong`，未設定共享。讀回確認名稱與八個分頁完全符合規格；八張表的欄名均與版本化 initializer 一致；`Rooms` 有 12 筆固定主檔（10 個實體房、2 個虛擬房），其餘七表各只有標題列，沒有客人、寵物、付款、員工、Session 或 Idempotency 記錄。`InitializeTestSheets.gs` 通過 Node 語法檢查；mock 驗證首次初始化、重複執行冪等、TEST ID／名稱限制及表頭／分頁／房間資料異常時 fail-closed 並保留資料。此 Apps Script source 尚未部署；未建立預約、付款、Staff Login、Session、Inventory Engine、Availability API 或 Production 資料。


# 最新進度更新（2026-10-30；本段取代前述舊階段界線）

- TASK-001 Booking Frontend UI：完成並已接受。
- TASK-002 Pricing Engine：完成並已驗收；Commit `6f002fd9ea921c313ecf90502091f1de051f332c`。
- TASK-003 Frontend Validation：依使用者指示跳過；本次不重新開啟。
- TASK-004 TEST Sheets Schema + Initialization：完成並已推送；`LittleLand_TEST` 只含八表表頭及 12 筆 Rooms 主檔。
- TASK-005 Inventory Engine、TASK-006 Availability API、TASK-007 TEST Create Booking API + Idempotency：完成 Apps Script source 與 Node mock tests；60 項測試通過。沒有寫入 Google Sheets、建立 TEST 預約列、建立／部署 Apps Script Web App、接線前台或合併 `develop`／`main`。本組任務完成後停止並回報等候驗收。

# TASK-005 — TEST Room Inventory／Physical Allocation Engine

狀態：完成（房態、實體房分配及 fail-closed 行為已用 mock 驗證；無實表寫入）。

- 新增 Apps Script inventory service，只讀 `Rooms`、`Bookings`，並只接受 Script Property `LITTLELAND_TEST_SPREADSHEET_ID` 指定且名稱精確為 `LittleLand_TEST` 的 Spreadsheet；request 不可指定其他 Spreadsheet ID。ID、名稱、必要分頁／表頭、狀態或 allocation 資料不符時 fail-closed，不能回報可用，也不能猜測、覆寫、取消或釋放房間。
- 只把 `PENDING_DEPOSIT`、`CONFIRMED`、`CHECKED_IN` 視為佔房；`PENDING_CONFIRMATION`、`CANCELLED`、`CHECKED_OUT`、`COMPLETED` 不佔房。`PENDING_DEPOSIT` 沒有固定付款期限；不得自動倒數、自動取消或自動釋放房間。員工後續跟進留待 Staff 後台 Task。
- 日期區間入住日含、退房日不含；有效訂單與新申請重疊 iff `newCheckout > existingCheckin && newCheckin < existingCheckout`；同日退房及下一位入住不視為重疊。
- 房間主檔只包含 10 個實體房：獨立套房空間 `S1`,`S2`,`S3`；豪華房 `A1`,`A2`,`A3`；標準房 `B1`,`B2`；整理箱 `C1`；自備籠 `F1`。虛擬房 `SS1` 只能表示 `S1+S2` 或 `S2+S3`，禁止 `S1+S3`；`SSR1` 固定表示 `S1+S2+S3`。SS1／SSR1 不是額外實體房，實際 allocation JSON 只保存底層實體 ID。
- 分配優先次序：獨立套房 `S1→S2→S3`；豪華套房 `S1+S2→S2+S3`；非常.豪華套房 `S1+S2+S3`；豪華房 `A1→A2→A3`；標準房 `B1→B2`；整理箱 `C1`；自備籠 `F1`。虛擬房任何組成的實體 ID 被同日期區間佔用，就不可再分配該組合。
- 只使用以上實體房；佔房 Booking 缺失 allocation、allocation 含重複／未知／虛擬 ID、套房組合非法或日期資料無效時 fail-closed，回 V3.0 房間完整性 error code，不回 available。不得將 `SS1`／`SSR1` 當作可獨立佔用的實體房。
- 新的 `PENDING_CONFIRMATION` Booking 可保存暫定 allocation，但此狀態按 V3.0 不佔房、暫定 allocation 不代表保留；之後員工把它轉至 `PENDING_DEPOSIT` 或 `CONFIRMED` 前，必須再次重查房態及分配。本 Task 不建立該 Staff 操作流程。

# TASK-006 — TEST Availability API

狀態：完成（`doGet?action=availability` 僅回安全 `available` 布林值及 V3.0 envelope；不部署）。

- 新增 Apps Script `doGet?action=availability` endpoint，接受有效入住／退房日期及所查房型；每次查詢讀取最新 TEST inventory。V3.0 取消 5 秒 polling；查詢時機為完成日期選擇、更改日期、進入／返回房型頁及正式提交前。普通查詢可用 Cache，但本實作不使用 availability Cache；正式提交不得信任 Cache。
- Availability 對客人只回傳安全布林 `available=true/false` 與 V3.0 API envelope，不回傳實體房 ID、虛擬房 ID、Booking ID、其他客人、待付訂金狀態、員工 follow-up 或不可預訂原因。無可用房是成功查詢中的 `available=false`；房間／Sheet／系統讀取錯誤回 `success:false`，不可誤報 `available=true`。客人可見的查詢中、可預訂、不可預訂、暫時無法確認文字映射留待 TASK-008 前台接線。
- 成功 envelope 包含 `success:true`、`code:"OK"`、`message`、`requestId`、ISO `timestamp`、`data`；失敗 envelope 包含 `success:false`、穩定 `code`、`message`、`requestId`、`timestamp`、`retryable`。應用依 `code` 判斷，不依 message 文字判斷。不得為 Availability API 建立公開部署網址。

# TASK-007 — TEST Create Booking API + Idempotency

狀態：完成（`doPost`、後端重算、TEST-only allow-list 與 Idempotency 已完成；全部以 mock 驗證）。

- 新增 Apps Script `doPost` Create Booking JSON endpoint；請求使用穩定 `idempotencyKey`、入住／退房日期與時段、物種／房型／數量、每隻 Pets 資料、家長聯絡、飲食、額外服務、六項 consent、client pricing snapshot。後端不可接受或信任呼叫端的 Spreadsheet ID、Booking ID、物理房間分配、Booking／付款狀態或價格。
- 建單流程固定為 `Validate → Check Idempotency Key → Acquire Script Lock → Backend Price Recalculation → Read Latest Inventory → Check Availability Again → Allocate Physical Rooms → Create Booking ID → Save → Log → Clear Cache → Release Lock`；取得 `LockService.getScriptLock()` 後必須重新檢查 key。任何重要步驟失敗都不得回報成功。最後房態檢查及分配不可使用 Cache。
- 日期使用真實 ISO `YYYY-MM-DD`；使用 `Asia/Hong_Kong` 判斷入住日不可早於當日；退房必須晚於入住、至少一晚。時段為入住／退房各 `14:30–15:30`、`15:30–16:30`、`16:30–17:00`；提早入住每次 HK$200、17:00 後延遲退房每次 HK$200，各自只可收一次。
- 寵物種類只可 `rabbit`／`guineaPig`／`hamster`；同一 Booking 只可一個物種及一個房型。寵物數量整數且至少 1、不可超過既定上限，pets 陣列列數必須等於 quantity。已驗收物種／房型價格與上限必須完全一致：兔子 `DELUXE_ROOM` HK$178／晚、上限 1；`PRIVATE_SUITE` HK$278／晚、上限 2；`DELUXE_SUITE` HK$350／晚、上限 3；`VERY_DELUXE_SUITE` HK$600／晚、上限 3。天竺鼠 `STANDARD_ROOM` HK$98／晚、上限 1；`DELUXE_ROOM` HK$178／晚、上限 3；`PRIVATE_SUITE` HK$278／晚、上限 3；`DELUXE_SUITE` HK$350／晚、上限 5；`VERY_DELUXE_SUITE` HK$600／晚、上限 5。倉鼠 `STANDARD_ROOM` HK$98／晚、上限 1；`HAMSTER_BOX` HK$65／晚、上限 1；`OWN_CAGE` HK$50／晚、上限 1。資料庫只存 Room Type ID，不接受客戶自訂房價。
- 年齡必須是數值與 `month`／`year` 單位，轉換並保存 `ageInMonths`；沿用已接受前台最新規則：兔子最低 3 個月、天竺鼠最低 3 個月、倉鼠最低 2 個月。低於最低年齡不建單。懷孕中的兔／天竺鼠及最近 30 日接受手術的毛孩不可一般預約；回 `PET_PREGNANT_NOT_ACCEPTED`／`PET_RECENT_SURGERY_NOT_ACCEPTED`，不得寫入預約。倉鼠不要求或保存絕育、懷孕、杜蝨欄位；男孩子不顯示／要求懷孕欄位。
- 寵物必填名稱、品種、年齡、性別；按物種收取適用健康欄位。最近看獸醫、傳染病、慢性病、服藥選「是」時必須提供詳情；依使用者已確認的規則，允許提交，將 `Pets.healthReviewStatus` 設為 `HEALTH_REVIEW_REQUIRED`，Booking 維持 `PENDING_CONFIRMATION`，留待人工覆核；這不代表健康批准，不得用 `PET_HEALTH_REVIEW_REQUIRED` 阻止此類申請。特殊照顧欄按前台保存。倉鼠為長擺糧，不要求餵食次數或假期提醒。
- 家長姓名、香港 8 位電話、Email、第 1 及第 2 位緊急聯絡人必填；指定獸醫／診所選填。六項 consent 全部必須 `true`：HK$1,000／隻現金備用金／按金、基本房費 50% 訂金及附加費於尾數收取、訂金不退款、同意入住須知及寄養條款、健康申報屬實、緊急獸醫診治及醫療／交通／陪診費；由伺服器記錄同意時間。
- 飲食選項只接受既定值：兔糧 `Oxbow 成兔糧`／`Momi T（成兔）`／`Momi A（幼兔）`／自行攜帶；天竺鼠糧 `Oxbow 天竺鼠糧`／`Momi 天竺鼠糧`／自行攜帶；倉鼠糧 `BUNNY 倉鼠糧`／自行攜帶。兔／天竺鼠牧草 `Joy & Fibre 1st cut`／`Momi 1st cut`／`Chewbo 1st cut`／自行攜帶；餵食為每日一次或每日兩次，星期日／假期只能餵一次但雙倍份量；兔／天竺鼠可選新鮮蔬菜。倉鼠不帶餵食次數、假期提醒或不適用飲食欄位。
- 後端只用已驗收 `booking/pricing.js` 的房價目錄與公式；建立 GAS V8 mirror，Node mock tests 必須檢查 mirror 與正式引擎輸出相同。`nights = checkout - checkin`；`baseRoomFee = roomPrice * nights`；`extraPetFee = Math.max(0, quantity - 1) * 50 * nights`；僅入住星期五／六／日且一晚時 `weekendFee = 250`，其他情況為 0；`serviceFees` 為所有選擇的服務費總和，其中單次梳毛 HK$70 一次、每日梳毛 HK$50 × nights、餵藥每日一次 HK$80 × nights、餵藥每日兩次 HK$150 × nights、提早入住 HK$200 一次、延遲退房 HK$200 一次；餵藥一次及兩次互斥。`totalSurcharges = extraPetFee + weekendFee + serviceFees`；`estimatedTotal = baseRoomFee + totalSurcharges`；`depositAmount = baseRoomFee * 0.5`，不可按 estimatedTotal 的 50% 計；`remainingBalance = estimatedTotal - depositAmount`；`cashDeposit = quantity * 1000`，絕不併入住宿總額、訂金或尾數。若 client price version 已過期回 `PRICE_VERSION_EXPIRED`；client quote 不符回 `PRICE_CLIENT_MISMATCH`；後端永遠保存後端重算結果。
- Booking ID 使用唯一 `TEST-LL-<香港日期>-<UUID 短碼>`，不可使用 Sheets row number。成功建立狀態為 `PENDING_CONFIRMATION`，該狀態不佔房，已分配房間僅為暫定；房間正式保留須待後續確認／訂金流程，不可在成功頁或 API response 稱已正式確認。保存 Price Snapshot `roomPrice`、`priceVersion`、`policyVersion`、`roomRuleVersion` 及所有計費 snapshot。使用者同意健康覆核申請可提交並留待人工覆核。
- 成功寫入一筆 `Bookings`、每隻毛孩一筆 `Pets`、一筆不含不必要個人資料的 `Logs` 及一筆 `IdempotencyKeys`；不建立 `Payments` 資料列、不處理付款。初始 `depositStatus=UNPAID`、`balanceStatus=UNPAID`、`cashDepositStatus=NOT_COLLECTED`。成功 API response 含 V3.0 `success:true`、`code:"OK"`、`message`、`requestId`、`timestamp`、`data`，只回 Booking ID、`PENDING_CONFIRMATION` 及計費摘要，不返回實體房 ID 或其他客人資料；失敗使用 `success:false`、穩定 error `code`、`message`、`requestId`、`timestamp`、`retryable`，客戶端依 `code` 判斷而非 message。
- IdempotencyKeys 使用 `idempotencyKey`、`operation`、canonical `payloadHash`、技術狀態 `PROCESSING`／`COMPLETED`／`FAILED`、`bookingId`、`requestId`、`responseCode`、`responseSnapshotJson` 及時間；技術狀態不可混作 Booking Status，不設 TTL／不自動刪除。同 key + 同 operation + 同 hash 的已完成重送回放同一 response，不再建立第二 Booking／Pets／Logs 或重做房間分配；同 key 搭配不同 operation 或 payload 回 `DUPLICATE_REQUEST`；lock 逾時回 `LOCK_TIMEOUT`。Response snapshot 不含原始 request 或不必要個人資料。Sheets 多分頁並非資料庫交易；任何部分寫入故障保留 `PROCESSING` 及穩定 Booking ID、回錯誤不回成功，重送不得新增第二份；不自動刪除／猜測修復，交由人工 reconciliation。
- 保持 V3.0 API errors：`VALIDATION_FAILED`、`DATE_INVALID_FORMAT`、`DATE_CHECKIN_IN_PAST`、`DATE_CHECKOUT_NOT_AFTER_CHECKIN`、`PET_QTY_INVALID`、`PET_QTY_EXCEEDS_LIMIT`、`PET_AGE_BELOW_MINIMUM`、`PET_PREGNANT_NOT_ACCEPTED`、`PET_RECENT_SURGERY_NOT_ACCEPTED`、`ROOM_TYPE_FULL`、`ROOM_COMBINATION_UNAVAILABLE`、`ROOM_NO_LONGER_AVAILABLE`、`ROOM_INVALID_ALLOCATION`、`ROOM_OVERLAP_DETECTED`、`ROOM_ALLOCATION_FAILED`、`PRICE_CLIENT_MISMATCH`、`PRICE_CALCULATION_FAILED`、`PRICE_VERSION_EXPIRED`、`PRICE_DUPLICATE_SERVICE`、`DUPLICATE_REQUEST`、`LOCK_TIMEOUT`、`SHEET_READ_FAILED`、`SHEET_WRITE_FAILED`、`QUOTA_EXCEEDED`、`EXECUTION_TIMEOUT`、`SYSTEM_UNAVAILABLE`、`INTERNAL_ERROR`。房態無房不可誤報可預訂；API 任何錯誤不可回成功；健康需人工覆核則依上方使用者核准規則允許建立待確認申請並設定標記。
- 全部 Node `node:test` 使用 fake Sheets、Script Properties、LockService、Utilities、ContentService 等 mock；Availability cache 不啟用，故不呼叫 CacheService。不得讀寫實際 `LittleLand_TEST` 或 Production。使用者明確選擇本階段不寫入任何試算表 row、不建立 Apps Script 專案、不部署 Web App、不提供 API URL、不連接前台。後續若需實表測試／部署須另行授權。
- 完成後同步到 `hklittleland/littleland-booking-system` 新 feature branch（建議 `feature/test-booking-api`）；不得推送內部 `origin`，不得合併 `develop`／`main`，不部署。此組 TASK-005／006／007 完成後停止並回報，等候使用者驗收，再開始其他任務。


## TASK-005／006／007 完成證據（2026-10-30）

- Apps Script modules：`TestSpreadsheetAccess.gs`（固定 TEST ID allow-list、精確名稱/schema 驗證與公式字串防護）、`PricingEngine.gs`（與已驗收 `booking/pricing.js` 完全一致）、`BookingValidation.gs`、`RoomAvailability.gs`、`IdempotencyService.gs`、`BookingApi.gs`。
- 新增純記憶體 Node mock harness、Pricing parity、Room Availability 與 Idempotency/API 測試。`node --test`：60 passed、0 failed；所有 `.gs` 與測試 `.js` 通過 `node --check`；`git diff --check` 無錯誤。
- 完成獨立只讀驗收，未發現阻斷問題。真實 Apps Script runtime、實際 Google Sheets、GAS 併發配額、部署及前台接線仍未測／未做，符合使用者指定的 code + mock-only 界線。
- 本階段沒有新增或修改任何 Google Sheets 資料列、沒有建立真實預約／付款資料、沒有部署 Web App、沒有連接前台、沒有合併 `develop` 或 `main`。
