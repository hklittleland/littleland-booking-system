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
- `Bookings` 的 booking 狀態僅使用 V3.0 值：`PENDING_CONFIRMATION`、`PENDING_DEPOSIT`、`CONFIRMED`、`CHECKED_IN`、`CHECKED_OUT`、`COMPLETED`、`CANCELLED`。只有 `CONFIRMED`、`CHECKED_IN` 佔房；`PENDING_CONFIRMATION`、`PENDING_DEPOSIT`、`CANCELLED`、`CHECKED_OUT`、`COMPLETED` 均不佔房。`PENDING_DEPOSIT` 無固定付款期限，不自動倒數、取消或釋放房間。
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
- 只把 `CONFIRMED`、`CHECKED_IN` 視為佔房；`PENDING_CONFIRMATION`、`PENDING_DEPOSIT`、`CANCELLED`、`CHECKED_OUT`、`COMPLETED` 不佔房。`PENDING_DEPOSIT` 沒有固定付款期限；不得自動倒數、自動取消或自動釋放房間。員工後續跟進留待 Staff 後台 Task。
- 日期區間入住日含、退房日不含；有效訂單與新申請重疊 iff `newCheckout > existingCheckin && newCheckin < existingCheckout`；同日退房及下一位入住不視為重疊。
- 房間主檔只包含 10 個實體房：獨立套房空間 `S1`,`S2`,`S3`；豪華房 `A1`,`A2`,`A3`；標準房 `B1`,`B2`；整理箱 `C1`；自備籠 `F1`。虛擬房 `SS1` 只能表示 `S1+S2` 或 `S2+S3`，禁止 `S1+S3`；`SSR1` 固定表示 `S1+S2+S3`。SS1／SSR1 不是額外實體房，實際 allocation JSON 只保存底層實體 ID。
- 分配優先次序：獨立套房 `S1→S2→S3`；豪華套房 `S1+S2→S2+S3`；非常.豪華套房 `S1+S2+S3`；豪華房 `A1→A2→A3`；標準房 `B1→B2`；整理箱 `C1`；自備籠 `F1`。虛擬房任何組成的實體 ID 被同日期區間佔用，就不可再分配該組合。
- 只使用以上實體房；佔房 Booking 缺失 allocation、allocation 含重複／未知／虛擬 ID、套房組合非法或日期資料無效時 fail-closed，回 V3.0 房間完整性 error code，不回 available。不得將 `SS1`／`SSR1` 當作可獨立佔用的實體房。
- 新的 `PENDING_CONFIRMATION` 及 `PENDING_DEPOSIT` Booking 均保存空 allocation `[]`，不暫留實體房。員工確認收到訂金並準備轉 `CONFIRMED` 時，必須在鎖內重查最新房態；只有成功分配合法實體房後才可同時儲存 allocation 並轉 `CONFIRMED`。若其他申請先確認導致無房，不自動取消其他待付訂金申請，留待員工聯絡；本 Task 不建立 Staff 操作流程。

# TASK-006 — TEST Availability API

狀態：完成（`doGet?action=availability` 僅回安全 `available` 布林值及 V3.0 envelope；不部署）。

- 新增 Apps Script `doGet?action=availability` endpoint，接受有效入住／退房日期及所查房型；每次查詢讀取最新 TEST inventory。V3.0 取消 5 秒 polling；查詢時機為完成日期選擇、更改日期、進入／返回房型頁及正式提交前。普通查詢可用 Cache，但本實作不使用 availability Cache；正式提交不得信任 Cache。
- Availability 對客人只回傳安全布林 `available=true/false` 與 V3.0 API envelope，不回傳實體房 ID、虛擬房 ID、Booking ID、其他客人、待付訂金狀態、員工 follow-up 或不可預訂原因。無可用房是成功查詢中的 `available=false`；房間／Sheet／系統讀取錯誤回 `success:false`，不可誤報 `available=true`。客人可見的查詢中、可預訂、不可預訂、暫時無法確認文字映射留待 TASK-008 前台接線。
- 成功 envelope 包含 `success:true`、`code:"OK"`、`message`、`requestId`、ISO `timestamp`、`data`；失敗 envelope 包含 `success:false`、穩定 `code`、`message`、`requestId`、`timestamp`、`retryable`。應用依 `code` 判斷，不依 message 文字判斷。不得為 Availability API 建立公開部署網址。

# TASK-007 — TEST Create Booking API + Idempotency

狀態：完成（`doPost`、後端重算、TEST-only allow-list 與 Idempotency 已完成；全部以 mock 驗證）。

- 新增 Apps Script `doPost` Create Booking JSON endpoint；請求使用穩定 `idempotencyKey`、入住／退房日期與時段、物種／房型／數量、每隻 Pets 資料、家長聯絡、飲食、額外服務、六項 consent、client pricing snapshot。後端不可接受或信任呼叫端的 Spreadsheet ID、Booking ID、物理房間分配、Booking／付款狀態或價格。
- Create Booking 流程固定為 `Validate → Check Idempotency Key → Acquire Script Lock → Backend Price Recalculation → Read Latest Inventory → Check Current Availability → Create Booking ID → Save PENDING_CONFIRMATION with allocatedRoomIdsJson=[] → Log → Clear Cache → Release Lock`；取得 `LockService.getScriptLock()` 後必須重新檢查 key。新申請只檢查房態、不分配或保留實體房；任何重要步驟失敗都不得回報成功。日後員工確認已收訂金、準備改為 `CONFIRMED` 時，須另在鎖內重查最新房態、分配實體房並更新該 Booking；本 TASK 不建立此 Staff API／Dashboard。
- 日期使用真實 ISO `YYYY-MM-DD`；使用 `Asia/Hong_Kong` 判斷入住日不可早於當日；退房必須晚於入住、至少一晚。時段為入住／退房各 `14:30–15:30`、`15:30–16:30`、`16:30–17:00`；提早入住每次 HK$200、17:00 後延遲退房每次 HK$200，各自只可收一次。
- 寵物種類只可 `rabbit`／`guineaPig`／`hamster`；同一 Booking 只可一個物種及一個房型。寵物數量整數且至少 1、不可超過既定上限，pets 陣列列數必須等於 quantity。已驗收物種／房型價格與上限必須完全一致：兔子 `DELUXE_ROOM` HK$178／晚、上限 1；`PRIVATE_SUITE` HK$278／晚、上限 2；`DELUXE_SUITE` HK$350／晚、上限 3；`VERY_DELUXE_SUITE` HK$600／晚、上限 3。天竺鼠 `STANDARD_ROOM` HK$98／晚、上限 1；`DELUXE_ROOM` HK$178／晚、上限 3；`PRIVATE_SUITE` HK$278／晚、上限 3；`DELUXE_SUITE` HK$350／晚、上限 5；`VERY_DELUXE_SUITE` HK$600／晚、上限 5。倉鼠 `STANDARD_ROOM` HK$98／晚、上限 1；`HAMSTER_BOX` HK$65／晚、上限 1；`OWN_CAGE` HK$50／晚、上限 1。資料庫只存 Room Type ID，不接受客戶自訂房價。
- 年齡必須是數值與 `month`／`year` 單位，轉換並保存 `ageInMonths`；沿用已接受前台最新規則：兔子最低 3 個月、天竺鼠最低 3 個月、倉鼠最低 2 個月。低於最低年齡不建單。懷孕中的兔／天竺鼠及最近 30 日接受手術的毛孩不可一般預約；回 `PET_PREGNANT_NOT_ACCEPTED`／`PET_RECENT_SURGERY_NOT_ACCEPTED`，不得寫入預約。倉鼠不要求或保存絕育、懷孕、杜蝨欄位；男孩子不顯示／要求懷孕欄位。
- 寵物必填名稱、品種、年齡、性別；按物種收取適用健康欄位。最近看獸醫、傳染病、慢性病、服藥選「是」時必須提供詳情；依使用者已確認的規則，允許提交，將 `Pets.healthReviewStatus` 設為 `HEALTH_REVIEW_REQUIRED`，Booking 維持 `PENDING_CONFIRMATION`，留待人工覆核；這不代表健康批准，不得用 `PET_HEALTH_REVIEW_REQUIRED` 阻止此類申請。特殊照顧欄按前台保存。倉鼠為長擺糧，不要求餵食次數或假期提醒。
- 家長姓名、香港 8 位電話、Email、第 1 及第 2 位緊急聯絡人必填；指定獸醫／診所選填。六項 consent 全部必須 `true`：HK$1,000／隻現金備用金／按金、基本房費 50% 訂金及附加費於尾數收取、訂金不退款、同意入住須知及寄養條款、健康申報屬實、緊急獸醫診治及醫療／交通／陪診費；由伺服器記錄同意時間。
- 飲食選項只接受既定值：兔糧 `Oxbow 成兔糧`／`Momi T（成兔）`／`Momi A（幼兔）`／自行攜帶；天竺鼠糧 `Oxbow 天竺鼠糧`／`Momi 天竺鼠糧`／自行攜帶；倉鼠糧 `BUNNY 倉鼠糧`／自行攜帶。兔／天竺鼠牧草 `Joy & Fibre 1st cut`／`Momi 1st cut`／`Chewbo 1st cut`／自行攜帶；餵食為每日一次或每日兩次，星期日／假期只能餵一次但雙倍份量；兔／天竺鼠可選新鮮蔬菜。倉鼠不帶餵食次數、假期提醒或不適用飲食欄位。
- 後端只用已驗收 `booking/pricing.js` 的房價目錄與公式；建立 GAS V8 mirror，Node mock tests 必須檢查 mirror 與正式引擎輸出相同。`nights = checkout - checkin`；`baseRoomFee = roomPrice * nights`；`extraPetFee = Math.max(0, quantity - 1) * 50 * nights`；僅入住星期五／六／日且一晚時 `weekendFee = 250`，其他情況為 0；`serviceFees` 為所有選擇的服務費總和，其中單次梳毛 HK$70 一次、每日梳毛 HK$50 × nights、餵藥每日一次 HK$80 × nights、餵藥每日兩次 HK$150 × nights、提早入住 HK$200 一次、延遲退房 HK$200 一次；餵藥一次及兩次互斥。`totalSurcharges = extraPetFee + weekendFee + serviceFees`；`estimatedTotal = baseRoomFee + totalSurcharges`；`depositAmount = baseRoomFee * 0.5`，不可按 estimatedTotal 的 50% 計；`remainingBalance = estimatedTotal - depositAmount`；`cashDeposit = quantity * 1000`，絕不併入住宿總額、訂金或尾數。若 client price version 已過期回 `PRICE_VERSION_EXPIRED`；client quote 不符回 `PRICE_CLIENT_MISMATCH`；後端永遠保存後端重算結果。
- Booking ID 使用唯一 `TEST-LL-<香港日期>-<UUID 短碼>`，不可使用 Sheets row number。Create Booking 成功狀態為 `PENDING_CONFIRMATION`，不分配／保留實體房，`allocatedRoomIdsJson=[]`；成功頁及 API response 不可稱房間已正式確認。保存 Price Snapshot `roomPrice`、`priceVersion`、`policyVersion`、`roomRuleVersion` 及所有計費 snapshot。使用者同意健康覆核申請可提交並留待人工覆核。
- 成功寫入一筆 `Bookings`、每隻毛孩一筆 `Pets`、一筆不含不必要個人資料的 `CREATE_BOOKING` `Logs` 及一筆 `IdempotencyKeys`；已通過輸入驗證並取得 idempotency claim、但在任何 Booking／Pet 寫入前失敗的請求，另寫精簡 `REJECT_BOOKING` Log（只保存 request ID／錯誤碼，不存表單／個資），並記錄 `FAILED` Idempotency 狀態；相同失敗 key 重播不得重複寫 Log。不建立 `Payments` 資料列、不處理付款。初始 `depositStatus=UNPAID`、`balanceStatus=UNPAID`、`cashDepositStatus=NOT_COLLECTED`。成功 API response 含 V3.0 `success:true`、`code:"OK"`、`message`、`requestId`、`timestamp`、`data`，只回 Booking ID、`PENDING_CONFIRMATION` 及計費摘要，不返回實體房 ID 或其他客人資料；失敗使用 `success:false`、穩定 error `code`、`message`、`requestId`、`timestamp`、`retryable`，客戶端依 `code` 判斷而非 message。
- IdempotencyKeys 使用 `idempotencyKey`、`operation`、canonical `payloadHash`、技術狀態 `PROCESSING`／`COMPLETED`／`FAILED`、`bookingId`、`requestId`、`responseCode`、`responseSnapshotJson` 及時間；技術狀態不可混作 Booking Status，不設 TTL／不自動刪除。同 key + 同 operation + 同 hash 的已完成重送回放同一 response，不再建立第二 Booking／Pets／Logs 或重做房間分配；同 key 搭配不同 operation 或 payload 回 `DUPLICATE_REQUEST`；lock 逾時回 `LOCK_TIMEOUT`。Response snapshot 不含原始 request 或不必要個人資料。Sheets 多分頁並非資料庫交易；任何部分寫入故障保留 `PROCESSING` 及穩定 Booking ID、回錯誤不回成功，重送不得新增第二份；不自動刪除／猜測修復，交由人工 reconciliation。
- 保持 V3.0 API errors：`VALIDATION_FAILED`、`DATE_INVALID_FORMAT`、`DATE_CHECKIN_IN_PAST`、`DATE_CHECKOUT_NOT_AFTER_CHECKIN`、`PET_QTY_INVALID`、`PET_QTY_EXCEEDS_LIMIT`、`PET_AGE_BELOW_MINIMUM`、`PET_PREGNANT_NOT_ACCEPTED`、`PET_RECENT_SURGERY_NOT_ACCEPTED`、`ROOM_TYPE_FULL`、`ROOM_COMBINATION_UNAVAILABLE`、`ROOM_NO_LONGER_AVAILABLE`、`ROOM_INVALID_ALLOCATION`、`ROOM_OVERLAP_DETECTED`、`ROOM_ALLOCATION_FAILED`、`PRICE_CLIENT_MISMATCH`、`PRICE_CALCULATION_FAILED`、`PRICE_VERSION_EXPIRED`、`PRICE_DUPLICATE_SERVICE`、`DUPLICATE_REQUEST`、`LOCK_TIMEOUT`、`SHEET_READ_FAILED`、`SHEET_WRITE_FAILED`、`QUOTA_EXCEEDED`、`EXECUTION_TIMEOUT`、`SYSTEM_UNAVAILABLE`、`INTERNAL_ERROR`。房態無房不可誤報可預訂；API 任何錯誤不可回成功；健康需人工覆核則依上方使用者核准規則允許建立待確認申請並設定標記。
- 全部 Node `node:test` 使用 fake Sheets、Script Properties、LockService、Utilities、ContentService 等 mock；Availability cache 不啟用，故不呼叫 CacheService。Unit tests 不讀寫實際 Sheet；只有使用者另外明確授權的 E2E／壓力驗收才可寫入 `LittleLand_TEST`，絕不連接 Production。
- 程式碼同步到 `hklittleland/littleland-booking-system` 的 `feature/test-booking-api`；不得推送內部 `origin`，不得合併 `develop`／`main`。當前 Apps Script Web App 是 TEST 部署；不部署 Production。


## TASK-005／006／007 完成證據（2026-10-30）

- Apps Script modules：`TestSpreadsheetAccess.gs`（固定 TEST ID allow-list、精確名稱/schema 驗證與公式字串防護）、`PricingEngine.gs`（與已驗收 `booking/pricing.js` 完全一致）、`BookingValidation.gs`、`RoomAvailability.gs`、`IdempotencyService.gs`、`BookingApi.gs`。
- 新增純記憶體 Node mock harness、Pricing parity、Room Availability 與 Idempotency/API 測試。`node --test`：60 passed、0 failed；所有 `.gs` 與測試 `.js` 通過 `node --check`；`git diff --check` 無錯誤。
- 完成獨立只讀驗收，未發現阻斷問題。真實 Apps Script runtime、實際 Google Sheets、GAS 併發配額、部署及前台接線仍未測／未做，符合使用者指定的 code + mock-only 界線。
- 本階段沒有新增或修改任何 Google Sheets 資料列、沒有建立真實預約／付款資料、沒有部署 Web App、沒有連接前台、沒有合併 `develop` 或 `main`。


# TEST Apps Script target 設定檢查點（2026-10-30）

狀態：完成（已授權建立 TEST 專案及 Script Property，並回讀確認）。

- Drive 唯讀查找確認目標是唯一、名稱精確為 `LittleLand_TEST` 的試算表；Apps Script 專案以該試算表為 parent 建立，並在登入的 LittleLand 帳戶中將 `LITTLELAND_TEST_SPREADSHEET_ID` 綁定至該 TEST ID。
- 保存後重新載入 Apps Script 設定頁，核對 property key/value 仍存在。Spreadsheet ID 不保存於 GitHub repository；實際專案連結與 Script ID 由本次交付訊息提供。
- 本次僅建立專案與 allow-list property；沒有上傳 LittleLand source、沒有執行 initializer/API、沒有修改任何試算表資料列、沒有建立真實測試預約、沒有部署 Web App 或建立 API URL。
- 後續若要把 repository 內 source 上傳至該專案、執行實表初始化／測試或建立部署，需另按當時範圍操作；任何公開／可匿名存取的 deployment 都必須先另行取得使用者明確授權。Production 永遠不可作為測試目標。


# TEST Apps Script 上傳與 Web App 部署更新（2026-10-31）

- 完成原先尚未上傳的 `apps-script/BookingApi.gs`，並在 `LittleLand TEST Booking API` 專案保存。載入後內容 SHA-256 與 repository 原始檔一致：`a180fb027ef2759fe3dc338cb57a3c80a1d8dde38256b78839da718e2e6dbeb0`。`IdempotencyService.gs` 亦已保存且 SHA-256 一致：`97bc37b78470e9d6086be55b3936808a988b6f69f254425a178ca7ba48abfc29`。其餘來源檔在本專案先前已上傳／驗證。
- 依使用者授權建立 Apps Script Web App，Version 1；Execute as：專案擁有人；Access：Anyone（供匿名客人前端呼叫）。Script Property `LITTLELAND_TEST_SPREADSHEET_ID` 已在部署前核對為 TEST 試算表綁定。未連接或修改 Production。
- API URL、公開存取風險、TEST-only 邊界及驗證紀錄存於 `docs/TEST-API-DEPLOYMENT.md`。由於 access 為 Anyone，公開 URL 可被匿名呼叫；POST 可能建立 TEST 預約，禁止提供真實客人資料或用於 Production。
- 唯讀 live smoke check：匿名 GET `action=availability` 回 HTTP 200、`success:true`、`code:OK`、`available:true`。沒有發出 POST；沒有建立或修改預約、寵物、付款、Logs、IdempotencyKeys 記錄。
- 自動測試命令 `node --test tests/apps-script/*.test.js tests/pricing.test.js`：60 passed、0 failed。
- 本次沒有變更 Apps Script 業務邏輯，沒有接線前台，沒有合併 `develop` 或 `main`。部署回執見 `docs/TEST-API-DEPLOYMENT.md`。


# TASK-008 — 客人預約前台連接 TEST API

狀態：已完成（2026-10-31）。已連接 TEST API，完成自動測試及一筆合成資料的網站→TEST API→Google Sheets E2E；只改資料連線與狀態處理，不重新設計 UI。

### 真實房態查詢

- 驗收：選擇 2026-11-23 至 2026-11-24、兔子後，以 TEST API 查詢四種可選房型；豪華房 `DELUXE_ROOM` 回傳可預訂。房態對客人只顯示四種允許狀態，沒有顯示內部房號或其他客人資料。

- 日期選好後，網站使用 TEST API 查詢 `LittleLand_TEST` 的真實房態；依有效日期、寵物種類及可選房型查詢 Availability。
- 房型對客人只顯示「可預訂」、「不可預訂」、「查詢中」、「暫時無法確認」；不可顯示內部 S1/S2/S3、SS1/SSR1、待付訂金原因或其他客人資料。

### 真實建單及成功頁

- 提交預約時改用 TEST Create Booking API；提交期間停用提交按鈕，避免重複 Submit。
- API 成功且取得有效 Booking ID 後，才可以顯示「已收到您的預約申請」。
- 完成頁顯示 Booking ID、房型、入住／退房、寵物、住宿總額、訂金、尾數及現金按金。
- 若 API 回傳房間剛被其他客人取得，返回房型頁重新查詢，不可顯示成功。

### 失敗保護與資料邊界

- API 或網路失敗時保留客人已填資料並提供重試，不可建立假成功結果。
- 全部只使用 TEST API 及 TEST 資料；不可連 Production、不可開始 Staff Dashboard、不可 Merge main。
- 使用者明確要求經網站→TEST API→Google Sheets→Booking ID 完成至少一張預約；只能使用明確合成的 TEST 客人／寵物資料，不使用真實客人資料。
- 完成回報修改檔案、Availability 測試、Create Booking 測試、TEST Booking ID、Sheets 寫入結果、錯誤處理測試、Branch、Commit SHA、已知問題；完成後停止。
- 程式碼及驗收文件只推送 `hklittleland/littleland-booking-system` 的 `feature/test-booking-api`，不推送／merge `main`。


### Create Booking 與 Sheets 寫入驗證

- 使用合成測試資料 `TEST Guest`／`TEST Bunny` 經預約頁提交；API 回 HTTP 200、`success:true`、`code:OK`，有效 ID 為 `TEST-LL-20261031-087BFA29`，狀態 `PENDING_CONFIRMATION`。完成頁只在驗證有效 Booking ID 後出現。
- Google Sheets 唯讀讀回確認：`Bookings` 恰有 1 列該 ID，資料為 2026-11-23 至 24、兔子、`DELUXE_ROOM`、1 晚／1 隻；`baseRoomFee HK$178`、`estimatedTotal HK$178`、`depositAmount HK$89`、`remainingBalance HK$89`、`cashDepositAmount HK$1,000`。`Pets` 有一列對應合成毛孩；`Logs` 有 `CREATE_BOOKING`；`IdempotencyKeys` 狀態為 `COMPLETED`。未建立正式預約、未付款。
- 首次建單請求超過前端原 25 秒等待上限，頁面保留資料並提供重試；沿用同一幂等 key 重試後取得同一 Booking ID，Sheet 核對只有一列。為避免 Sheets 寫入延遲導致誤報失敗，adapter timeout 改為 60 秒，並新增 regression test。

### 錯誤處理與自動測試

- Availability 對選定日期/物種的四個房型送出 TEST 查詢；只有允許的四種房態字樣會呈現，不洩露內部資料。
- 以不連線、不寫入 Sheet 的前端 fake network failure 驗證：顯示重試、保留已填資料、不顯示成功頁；以 fake `ROOM_NO_LONGER_AVAILABLE` 驗證：返回房型步驟重新查詢、不顯示成功。真實提交期間已確認提交按鈕停用。
- 語法檢查：`node --check booking/api-client.js`、`node --check booking/booking.js`、`node --check tests/booking-api-client.test.js` 均通過；`python3 -m json.tool manus-routes.json` 及 `git diff --check` 通過。
- 完整自動測試：`node --test tests/apps-script/*.test.js tests/pricing.test.js tests/booking-api-client.test.js` — 69 passed、0 failed。
- Branch：`feature/test-booking-api`。無 production 連接、Staff Dashboard、或 `main` merge。
- 已知風險：Apps Script Web App 為匿名可呼叫（部署設定 `Anyone`），故只應使用合成 TEST 資料；POST 可能新增 TEST 列。API URL 與 TEST-only 安全提示記於 `docs/TEST-API-DEPLOYMENT.md`。


# TASK-009 — TEST Booking 壓力／房態驗收

狀態：完成（2026-10-31）。只用合成 TEST 值；未啟動 Staff Dashboard／確認 API，未使用 Production。逐筆 ID、價格、Sheet 核對與限制見 [TASK-009 TEST Booking 壓力／房態驗收](docs/TEST-BOOKING-STRESS-20261031.md)。

### 十組 Create Booking 情境

建立十張有效 TEST 訂單，所有新單均為 `PENDING_CONFIRMATION`、`allocatedRoomIdsJson=[]`，測試不同晚數、週末與額外服務；完整價格需與 canonical `pricing.js` 和 TEST Sheet snapshots 一致：

1. 兔子／豪華房 `DELUXE_ROOM`，1 隻，2026-11-03 至 11-05，2 晚：單次梳毛、每日梳毛、提早入住。
2. 兔子／獨立套房 `PRIVATE_SUITE`，2 隻，2026-11-04 至 11-05，1 晚：每日餵藥 1 次、每日梳毛、延遲退房。
3. 兔子／豪華套房 `DELUXE_SUITE`，3 隻，2026-11-06 至 11-07，星期五入住 1 晚：每日餵藥 2 次、單次梳毛。
4. 兔子／非常.豪華套房 `VERY_DELUXE_SUITE`，3 隻，2026-11-07 至 11-09，2 晚：每日梳毛、提早入住。
5. 天竺鼠／標準房 `STANDARD_ROOM`，1 隻，2026-11-10 至 11-13，3 晚：單次梳毛。
6. 天竺鼠／豪華房 `DELUXE_ROOM`，3 隻，與第 1 組相同日期，2 晚：每日餵藥 1 次；用來驗證相同物理房型日期的待確認申請不分配／佔用。
7. 天竺鼠／獨立套房 `PRIVATE_SUITE`，3 隻，2026-11-14 至 11-17，3 晚：每日餵藥 2 次、每日梳毛、延遲退房。
8. 天竺鼠／豪華套房 `DELUXE_SUITE`，5 隻，2026-11-20 至 11-24，4 晚：單次梳毛、每日餵藥 1 次、提早入住。
9. 倉鼠／整理箱 `HAMSTER_BOX`，1 隻，2026-11-15 至 11-16，星期日入住 1 晚：每日餵藥 1 次；倉鼠牧草／餵食次數欄留空。
10. 倉鼠／自備籠 `OWN_CAGE`，1 隻，2026-11-16 至 11-18，2 晚：無額外服務；倉鼠不帶不適用飲食欄位。

使用相同 idempotency key 重送其中一張完全相同訂單，不得建立第二張 Booking、Pets 或 CREATE_BOOKING Log；以不同 idempotency key 同時提交第 1／6 組相同日期房型，依新規則兩張待確認申請皆可成功，且兩者 allocation 都是 `[]`。

### 更新後房態驗收（覆蓋舊版佔房假設）

- 唯一佔房狀態為 `CONFIRMED`、`CHECKED_IN`。`PENDING_CONFIRMATION`、`PENDING_DEPOSIT`、`CANCELLED`、`CHECKED_OUT`、`COMPLETED` 不佔房；提交不分配實體房。
- A：相同／重疊日期的待確認申請可共存，但不得重複分配任何實體房（目前皆無 allocation）。實際分配只可在日後由待付訂金轉為 `CONFIRMED` 時發生，且須鎖內重查房態。
- B：已確認 Booking 佔用 S1 時，豪華套房 `DELUXE_SUITE` 應使用合法替代組合 S2+S3。
- C：已確認 Booking 佔用 S2 時，豪華套房不可預訂；不得使用違法 S1+S3。
- D：豪華套房已佔用 S1+S2 時，重疊日期獨立套房只可分配 S3。
- E：非常.豪華套房佔用 S1+S2+S3 後，重疊日期所有 S 區房型均不可用。
- F：既有 Booking 退房日等於新 Booking 入住日，依半開區間規則可沿用房間；真正重疊仍不可。
- G：同一 idempotencyKey、同一 payload 重送回放原 Booking ID，不增加第二筆 Booking。
- H：在客人提交階段，兩筆平行的 `PENDING_CONFIRMATION` 可同時成功且都不佔房；「同時確認已收訂金、競爭最後一間房只允許一筆 CONFIRMED」屬日後 confirmation transaction，當前無 Staff confirmation API，不能冒充已作實 API 測試，本 TASK 不新增該 Staff 功能。
- B–F 的實體配置檢查以 Apps Script mock inventory 內合成的 `CONFIRMED`／`CHECKED_IN` fixtures 執行，不在 Google Sheets 假造已收訂金／確認的狀態；TEST API live 驗收只建立上述十筆待確認訂單及重播／拒絕紀錄。

### 最終核對

重新讀取 `LittleLand_TEST`，逐筆對十個新 Booking ID、物種／房型／日期／數量／晚數、空 allocation、每隻 Pets、所有金額、CREATE／REJECT Logs 與 Idempotency 狀態；確認重播無重複 Booking、待確認資料不佔房。自動測試結果、任何被拒絕的請求及原因、既有 TEST row 的處理方式均需記錄。只在 `feature/test-booking-api` 提交／推送，不 merge `main`。


# Staff Web V1 — 完整可操作初版

狀態：Staff Web V1 核心實作與 TEST 驗收完成（2026-10-31；TEST deployment v8、兩個 synthetic ADMIN 帳號、111/111 automated tests、390px 八頁 smoke、paid-deposit room-conflict E2E 與 Sheets read-back 均通過）。正式驗收／任何 Production 部署仍須另行決定；八頁 smoke 是登入後導覽／render／橫向捲動檢查，不代表每項操作均已手動端到端覆核；見 §7 最終核對。

## 1. 後台定位、登入與導覽
- 建立登入式響應式網站（不是手機 App），繁體中文 zh-HK，iPhone 優先並同時適合 iPad／桌面；沿用 LittleLand 紫／粉色品牌、白色圓角卡片與清晰簡單的日常營運介面，手機主要按鈕要大而易點。
- 後台主要選單包括：概覽 Dashboard、房間月曆、預訂、🔔 待跟進、付款、客戶、基本營收、設定／登出。員工管理及排班不需做完整版本；保留以 TEST `Staff.isActive=false` 停用帳號，且停用後既有 Session 也不可再讀寫資料。
- 只保留基本 username/password Staff Login；TEST 建立兩個有效 synthetic Staff 帳號，兩者登入後一律擁有完整 ADMIN 權限。不實作 VIEWER／STAFF／ADMIN 三層角色判斷、逐操作 role gate 或操作時重新輸入密碼。密碼不可寫在前端或 GitHub；只存 PBKDF2-HMAC-SHA256 hash／salt，固定 120,000 rounds。登入後建立有期限 Session，支援過期及登出；員工停用 `isActive=false` 後，該帳號及其既有 Session 均不可再讀取資料或操作。只有有效登入 Staff 才可取得 Booking、客人、寵物、付款、房間及 Logs；未登入不可讀取任何後台資料。
- 兩個有效 Staff 帳號都可使用完整後台：查看及編輯預約、查看客人及寵物、確認資料／轉待付訂金／確認收到訂金並依最新房態分配房間、記錄尾數及現金按金、辦理入住及退房、取消預約、新增跟進紀錄，以及查看付款與基本營收。保留合法狀態／金額驗證、房態 re-check、重要操作 Logs 與必要確認；不做角色分級授權。

## 2. 共用 Booking Detail、預訂列表與 Dashboard

- Booking Detail 為所有頁面唯一的訂單詳細資料來源。Dashboard、房間月曆、預訂列表、待跟進、付款及客戶過往預訂中每張 Booking 均須一鍵進入同一張 Booking Detail，不為不同頁面建立不同版本的訂單資料。
- Dashboard 顯示今日入住、今日退房、待確認、待付訂金、已確認及待跟進數量，並顯示今日入住／退房時間表、近期預約及需要跟進的預約；每張預約均可直接進 Detail。
- 預訂列表可搜尋 Booking ID、客人姓名、電話、寵物名稱、入住日期、退房日期、房型；可按 `PENDING_CONFIRMATION` 待確認、`PENDING_DEPOSIT` 待付訂金、`CONFIRMED` 已確認、`CHECKED_IN` 已入住、`CHECKED_OUT` 已退房、`COMPLETED` 已完成、`CANCELLED` 已取消及全部篩選。點擊列進入共用 Detail。
- Detail 完整顯示：預約 ID／狀態／提交時間／入住退房日期與時段／晚數／房型／實際內部分配房號；客人姓名／電話／Email／兩位緊急聯絡人／指定獸醫或診所；每隻寵物獨立卡片中的名稱／種類／品種／年齡／性別／絕育／懷孕／最近手術／最近看獸醫／傳染病／慢性疾病／藥物／特殊照顧／杜蝨／飲食資料；主糧／餵食次數／牧草／蔬菜；基本房費／額外寵物費／週末附加費／每項額外服務／附加費合計／住宿總額／訂金／尾數／現金按金；訂金狀態金額與收款日期、尾數狀態金額、現金按金狀態／已使用金額／應退金額；最後聯絡日期、聯絡員工、備註及跟進歷史；狀態修改、付款、房間分配、入住退房、取消與員工操作 Logs。

## 3. 房間月曆、實體房及分配規則

- 建立完整月份月曆；每日顯示日期、實體房號、寵物圖示與寵物名稱、入住時間、退房時間及房態顏色；員工可見內部房號。房態顏色：灰色＝空房、橙色＝待處理／提示、綠色＝已確認／入住；顏色旁亦需有文字或圖示，不可只靠顏色表達狀態。點擊預約直接開共用 Booking Detail。
- 實體房只有 S1、S2、S3、A1、A2、A3、B1、B2、C1、F1；SS1／SSR1 是虛擬組合名稱，不是額外實體房。
- 保持既定 S 區規則：獨立套房可用 S1、S2 或 S3；豪華套房只可用 S1+S2 或 S2+S3，絕不可用 S1+S3；非常.豪華套房固定使用 S1+S2+S3。所有入住日含、退房日不含，退房日等於下一位入住日可沿用房間。

## 4. Booking 狀態、收款、入住／退房及敏感操作

- 嚴格遵循：客人提交 → `PENDING_CONFIRMATION`（不佔房）→ 員工確認資料 → `PENDING_DEPOSIT`（仍不佔房）→ 實際收訂金後由員工確認 → 最新房態仍有合法實體房才可分配房號並轉 `CONFIRMED`（開始正式佔房）。只有 `CONFIRMED` 及 `CHECKED_IN` 佔房；`PENDING_CONFIRMATION`、`PENDING_DEPOSIT`、`CANCELLED`、`CHECKED_OUT`、`COMPLETED` 不佔房；所有 pending booking 的 allocation 必須是 `[]`。同日期可以有多張待確認／待付訂金預約；提交 pending 不分配／保留房間。
- 「確認已收訂金」必須在鎖內重新讀取最新房態、尋找合法實體房組合後才執行轉換，不能信任舊查詢結果或客戶端指定房號。如果仍有房：記錄訂金、分配合法實體房、轉 `CONFIRMED`、正式佔房及寫入 Log。如果已無房：依使用者已核准的方案仍記錄已實收訂金到 `Payments`，但 Booking 維持 `PENDING_DEPOSIT`、`allocatedRoomIdsJson=[]`，顯示房態衝突並加入人工跟進；不可 CONFIRMED、不可任意分配、不可自動取消預約或忽略實際收款。
- 提供確認資料、轉待付訂金、確認已收訂金、記錄尾數、收取／使用／退款現金按金、辦理入住、退房、完成、取消預約、新增跟進及編輯允許資料等 Detail 操作。取消必須由員工明確確認及記錄原因；不自動退款。入住後不可直接退回未入住狀態。不可編輯 status、價格 snapshot、付款狀態或房間 allocation 的一般欄位；敏感修改需明確確認、鎖內 re-read、版本更新並寫 Log，不要求操作時再次輸入密碼。所有轉換依明確合法狀態、record version 及 idempotency fail-closed，不依角色分級。
- LittleLand 沒有固定訂金付款期限；不得自動倒數、逾期取消或釋放房間。任何部分寫入不確定時不可回報成功或盲目重試／覆寫，必須保留可稽核狀態並交人工核對。拒絕 Logs 不含客人／寵物個資、密碼或 Session token。

## 5. 付款、待跟進、客戶與基本營收

- 付款頁用於搜尋／管理待收訂金、待收尾數、待收現金按金、待退現金按金及今日已收款；每一項直接開共用 Booking Detail，實際付款記錄由 Detail 執行。
- 獨立 🔔 待跟進頁顯示 Booking ID、客人、電話、房型、入住日期、狀態、最後聯絡日期／員工及備註；可記錄已聯絡、新增備註、開啟 WhatsApp 及進入共用 Detail。
- 客戶頁可按姓名、電話及 Email 搜尋；顯示基本聯絡資料、過往 Booking 及過往寵物；每張歷史 Booking 均能開啟該 Booking Detail。
- 基本營收頁顯示本月已收訂金、本月已收尾數、本月住宿收入，並可按房型及寵物種類查看；不建複雜會計系統。現金備用金／按金獨立管理，不混入住宿收入或 V3.0 房費、訂金與尾數公式。

## 6. TEST-only 資料、既有商業規則與完成交付

- 只用既有 GitHub repository／`feature/test-booking-api`、現有 `LittleLand_TEST` Sheets、目前 TEST API 及合成資料。優先用目前 11 張 TEST Booking；不可使用真實客人資料，不可連接或修改 Production。若確認房態需要額外資料，只建立明確合成的 TEST 情境；既有 11 張資料預設保持不變，只有員工明確選取的 TEST booking 才可操作。
- 不修改已接受客人預約網站設計／檔案，不修改 `booking/pricing.js`、房價、入住上限、S 區組合、訂金公式、週末附加費或現金按金公式；既有 Guest API `availability`／Create Booking contract 必須維持相容。所有 Staff reads/writes 只可在 Staff 驗證成功後讀取／寫入 TEST Sheets/API。
- 完成後提供 Staff TEST Preview 網址、TEST 登入方法、已完成頁面、可用 Detail 操作、月曆、付款、Follow-up、客戶歷史、哪些資料連接 TEST Sheets/API 及哪些仍 Mock、自動測試結果、Branch、Commit SHA 及已知問題；完成初版後停止。只提交到 `hklittleland/littleland-booking-system` 的 `feature/test-booking-api`，不得推送內部 `origin`、不得 merge `develop`／`main`、不得部署 Production。

## 7. 驗證進度與剩餘驗收（2026-10-31）

- TEST Apps Script 的既有 Web App deployment 已更新至 Version 6；deployment ID／URL、execute-as owner 與 anyone-access 設定維持不變。PBKDF2 使用 120,000 rounds；Apps Script HMAC 已改為 UTF-8 password bytes 與 Byte[]/Byte[] overload。
- Staff API client 已停用 login network exception／malformed JSON response 的自動重試，避免不確定回應自動建立第二個 Session；regression tests 確認兩種失敗均只送一次，其他 idempotent mutation 仍以相同 payload 重試一次。
- 一次 synthetic TEST Admin login/logout probe 成功；之後多個 client login requests 未收到 response。最新 Google Sheets read-back 找到該 TEST Admin 共 6 筆 Sessions，均已 revoked／expired，active synthetic sessions = 0；最近 one-shot E2E 新增的 TEST row 7 已精確撤銷並讀回核對。
- 最新完整 suite：`node --test tests/apps-script/*.test.js tests/*.test.js`；結果 **109 passed / 0 failed**，包含 Noble PBKDF2 bundle、兩個帳號平面 ADMIN、停用帳號使既有 Session 失效，以及移除角色／重輸密碼 gate 的 regression tests。
- 390px Playwright mobile viewport 使用本地 mocked API；8 個導航頁（Dashboard、房間月曆、預訂、待跟進、付款、客戶、基本營收、設定／登出）均可切換並正確 render。每頁 `documentElement.scrollWidth` 及 `body.scrollWidth` 均為 390px，無 page JavaScript errors；此項測試沒有連接 TEST API 或寫入 Sheets。
- live two-hamster-box E2E 尚未通過：房態 preflight 為 available，但唯一一次執行仍在 login 回應前 `fetch failed`，之後沒有重送或建立 booking。Google Sheets read-back 仍為 Bookings 11、Pets 24、Payments 0、Logs 13、IdempotencyKeys 12。6 筆 synthetic Staff sessions 均 revoked／expired，無 active synthetic session。
- 完成 V1 前仍必須從 TEST API 做一次完整 conflict E2E，並重新讀取 Sheets：第一張確認並佔用合法實體房；第二張即使記錄已實收訂金仍須維持 `PENDING_DEPOSIT`、`allocatedRoomIdsJson=[]`、顯示房態衝突及人工 Follow-up；不得自動取消或分配房間。未完成此 live read-back 前不得標記 Staff V1 已驗收。
- 最新本地權限／KDF 修訂已實作：所有有效 Staff 登入一律回傳 `ADMIN`，角色欄不參與授權；source 中無 role tiers 或 `reauthPassword` gate。PBKDF2 改以 pinned `@noble/hashes@2.4.0` 本地 bundle 計算並固定 120,000 rounds；Node standard vectors 與 109 項 mock tests 通過。尚須同步 TEST GAS source、更新同一 TEST deployment，並以實際兩個帳號驗證 login/logout／八個頁面；不可降輪數。

### 最終驗收更新 — 2026-10-31 20:50 HKT

本段取代上方較早時點記錄的「尚待部署／conflict E2E 未通過」狀態；前述資料是 v8 部署前的歷史記錄。

- TEST Apps Script 已將同一 Web App deployment 更新至 Version 8；原 deployment ID、API URL、執行身分及 Anyone access 維持不變。日期修正只在 Staff/Google Sheets 房態邊界將 Date/ISO timestamp 正規化為香港 date-only；Guest API 仍維持嚴格 `YYYY-MM-DD` 輸入驗證。沒有連接或修改 Production。
- 兩個合成 TEST Staff 帳號均為完整 `ADMIN`。直接 API login/logout、TEST 登入後八頁讀取，以及 v8 conflict E2E 的 login/logout 成功；登入 network exception／malformed response 無自動重試。`Staff.isActive=false` 令既有 Session 在每個受保護 action 即時失效，並有 regression test。帳號密碼只存 Git 外的私密檔案。
- 390×844 live TEST mobile smoke 覆蓋 Dashboard、房間月曆、預訂、待跟進、付款、客戶、基本營收、設定／登出八頁；每頁無橫向捲動，API login/logout 成功。這是導航／render／版面 smoke，不等同每一種 Staff 寫入操作均由瀏覽器逐項手動端到端操作。
- 完整 automated suite：`node --test tests/apps-script/*.test.js tests/*.test.js` — **111 passed / 0 failed**。Apps Script `.gs` 與 Staff `.js` syntax checks 及 `git diff --check` 通過。
- v8 live TEST deposit/conflict E2E 使用兩張既有合成預約（沒有額外建單）：`TEST-LL-20261031-9CECA2C7` 與 `TEST-LL-20261031-1B66EC7B`，均為 2026-11-15 入住、2026-11-16 退房、1 隻倉鼠、HAMSTER_BOX。第一張房費 HK$65、週末附加費 HK$250、服務費 HK$80、住宿總額 HK$395、訂金 HK$32.50、尾數 HK$362.50、現金按金 HK$1,000；付款記錄 HK$32.50 後成為 `CONFIRMED` 並獲分配 `C1`。第二張房費 HK$65、週末附加費 HK$250、服務費 HK$0、住宿總額 HK$315、訂金 HK$32.50、尾數 HK$282.50、現金按金 HK$1,000；付款記錄 HK$32.50 後仍為 `PENDING_DEPOSIT`、allocation `[]`、`followUpRequired=TRUE`，API 回報 room conflict，沒有確認或分配實體房。
- 重新讀回 LittleLand_TEST Sheets 核對兩個 Payments（各 HK$32.50、PAID）、兩個 Pets（各 1 隻）、`staff.confirmDeposit` Logs、兩個 v8 deposit Idempotency key（均 `COMPLETED`，沒有重複 Booking）。重疊日期唯一有效實體佔房是第一張的 `C1`；第二張無 allocation。Staff detail、Dashboard 及 Follow-ups 三處均出現第二張房態衝突提示。Sessions 共 13 筆、有效 Session 0。
- 正式產品驗收及任何 Production 部署仍待使用者另行決定；不得 merge `develop`／`main`，本次只更新 `feature/test-booking-api`。


## Staff UX follow-up — 2026-11-01（程式實作完成，待 iPhone 人工 UX 驗收）

### Data reads and operations responsiveness
- Staff 資料讀取與操作目前體感太慢；縮短前後端等待，減少一次 API request 內重複的 Spreadsheet open／schema validation 及不必要工作表讀取。登入後的快速頁面切換可重用短暫的記憶體資料，但成功修改後必須更新資料；不得將 Staff 個資寫入 LocalStorage；confirm deposit 每次必須重新檢查最新房態，不能使用快取房態。

### Room calendar displays TEST bookings
- Staff 房間月曆目前顯示完全沒有資料／沒有更新。修正 Google Sheets `Date`／ISO timestamp 與 Staff `YYYY-MM-DD` 比較格式不一致的問題，讓 TEST Bookings 能在正確入住日顯示；退房日不計入住日期。只標示 Staff 已授權看到的 TEST 預訂；不可改變任何房間分配／入住狀態規則。

### Deposit and follow-up status colors
- 未收訂金、待跟進的狀態以清晰紅色區別；已收訂金以清晰綠色區別。已收訂金但房態衝突仍須另外顯示紅色需跟進提示；顏色只反映 API 資料，不能改變狀態或付款記錄。

### Time display
- 一般 Staff 畫面顯示時間只至小時及分鐘（`HH:mm`）；時間戳可保留日期及 `HH:mm`，但不可顯示秒數、原始 UTC 時區偏移或冗長時區內容。

### Fictional TEST display data
- 所有 LittleLand_TEST 示範聯絡人與寵物資料必須虛構；人名／寵物名使用易辨識、自然的繁體中文示範值。電話使用明確 `TEST-####`、不可撥打／不可 WhatsApp 的佔位字串；不可從外部搜尋或猜測真正人士資料。若更新既有合成資料，只可改顯示姓名、寵物名及測試聯絡欄位，不改 Booking ID、日期、數量、價格、訂金／付款、房號、booking status 或 follow-up state。

### Environment guard
- 全部改動與資料核對只限 LittleLand_TEST 及目前 Staff-only TEST preview；不接 Production、不改客人 `/booking/`、不改核心商業規則、不 merge `develop`／`main`、不推到 internal `origin`。


### Verification update — 2026-11-01 12:02 HKT

- Staff v9 的後端 request-scoped spreadsheet handle、lazy reads、HKT calendar 日期正規化、5 秒前端記憶體快取、紅／綠狀態顯示及 `HH:mm` 時間格式已完成；付款確認仍重新讀取最新房態，成功 mutation 清除快取。v8/v9 單次 API latency 對照、mobile UI 測試及限制記錄於 `docs/TEST-API-DEPLOYMENT.md`。
- Staff 編輯表單的寵物性別切換已修正：雄性隱藏／停用懷孕欄位並從 API payload 移除；雌性顯示必填選項；由雌性切回雄性會清除舊答案，再切回雌性要求重新回答。390px TEST UI regression smoke 全程未提交 edit。
- 直接讀回 LittleLand_TEST：Bookings 12、Pets 25、Payments 3、Logs 37、IdempotencyKeys 34、Sessions 42；另有 3 筆本次之前仍未撤銷且未過期的 TEST Session 保持不變，以免中斷既有使用者登入。12 張 Booking 與 25 隻 Pet 的 ID 未變；只更新虛構聯絡／顯示姓名與寵物名稱欄位，Payments 及狀態、日期、數量、金額、房間分配、跟進狀態均未改。所有聯絡電話為 `TEST-####`，Email 使用 `example.test`。
- 完整測試 command：`node --test tests/apps-script/*.test.js tests/*.test.js` — **120 passed / 0 failed**；Staff/helper JavaScript syntax、`manus-routes.json` 及 `git diff --check` 均通過。
- Dashboard、月曆、預訂、待跟進、Booking Detail、付款、客戶、營收、設定／登出已完成 390×844 mobile emulation smoke；iPhone Safari 人工 UX 驗收仍待使用者確認。因尚未完成該人工驗收，目前不 commit、不 push、不 merge；保留 `feature/test-booking-api`，最後同步只會推送至 `hklittleland/littleland-booking-system` 的同名分支。


# Staff Web V3 — Desktop、月曆、營運功能與品牌整合

狀態：使用者已於 2026-11-01 核准 V3 計畫及人工退訂金方式；實作只限 `LittleLand_TEST`。各 outcome 目前待實作；部署／Sheets 驗收後逐項更新。保留 `feature/test-booking-api`，完成 iPhone/desktop 人工 UX review 前不 push、不 merge。

## 1. Staff 桌面版整合、品牌 Logo 及短 Booking reference

- Staff Web 版面須更容易操作、資訊整合；桌面使用清晰導覽、頁面標題／搜尋／主要動作及寬版工作區，月曆等頁面善用桌面空間；手機仍以 390px iPhone Safari 為優先，觸控目標易按，不得有橫向捲動。
- 將使用者提供的 LittleLand logo 放在客人預約網站與 Staff 後台合適位置；保持圖片原貌及比例，不重繪、不改品牌色。只在客人預約頁加 logo 與 requested short reference，不重新設計已接受的預約流程。
- Booking short reference 約 8 個英數字，只作顯示及搜尋便利用途，出現在客人完成頁、Staff 預訂清單／詳情及 WhatsApp 草稿；新 reference 必須唯一。完整 `TEST-LL-YYYYMMDD-XXXXXXXX` Booking ID 保持為資料庫、API、Payments、Logs、Idempotency、關聯與 mutation 的唯一內部 key，不截短、不改寫歷史 ID；Staff 搜尋可接受 full ID 或 short reference。
- 兩個 TEST Staff 帳號登入後仍為相同完整 ADMIN 權限；不增加角色分級或逐操作密碼重驗。Staff 端敏感頁面仍需登入；Session expiry/logout、停用帳號及重要操作 Logs 繼續有效。

## 2. 房間月曆、今日提醒及桌面詳情

- 月曆星期日開始；完整顯示一個月所有日期，必要時可用第六行避免漏日。今日以明顯藍色外框／標籤顯示，提供一鍵返回今日；顯示香港當日入住提醒與退房提醒數量／清單。
- 每日格內簡單顯示使用中的實體房號、房型、動物種類圖示及寵物名；兔子用 `🐰`、天竺鼠用 `🐽`、倉鼠用 `🐹`。入住時間用綠色，退房提醒用紅色，在住狀態用綠色，待處理／follow-up 用橙色，空房用灰色；顏色亦須有可讀狀態文字。格子過多時顯示數量摘要，選日後可檢視完整清單。
- Desktop 月曆需比現有版本大並顯示更多資料。選取日期的詳情區可查看全部入住／退房／在住房客與寵物、房號／房型、時間、Booking status、當值員工及連結至共用 Booking Detail。Staff 手機版保留緊湊月曆並在選日後顯示完整活動清單，不可要求橫向捲動。
- TEST 月曆的日期按 `Asia/Hong_Kong` 正規化。入住日含、退房日不含。只有 `CONFIRMED`／`CHECKED_IN` 可顯示為實體房入住；`PENDING_CONFIRMATION`／`PENDING_DEPOSIT` 不佔房、不分配房號，只能列於待處理／衝突提醒。待付訂金及無房衝突的預約不可自動取消。
- 以目前 TEST 真實房間配置及既有房態 helper 為準；不可為符合文件清單而更名、新增或刪除實體房。Suite 的虛擬組合不可以當成獨立實體房。

## 3. 概覽 Dashboard

- 顯示今日入住及退房數量、待確認預訂數、本月營收，以及現有兩位 TEST Staff 的員工／排班入口。
- 顯示今日入住／退房時間表、待處理預約及需跟進摘要；每個 Booking 摘要可一鍵到共用 Booking Detail。所有數字與提醒從 TEST API/Sheets 現有資料取得，不以假資料冒充 live results。

## 4. 預訂搜尋、排序、七日提醒與操作

- 預訂清單可搜尋客人、電話、寵物、Booking full ID／short reference；可按最新建立、入住日期、退房日期排序。
- 顯示未來七日入住與退房清單及時間提醒；提供合法的確認資料、轉待付訂金、確認收訂金、辦理入住、延長住宿、查看詳情、生成簡訊／WhatsApp 草稿及狀態操作入口。每個狀態操作必須符合既有 transition table；不可提供任意改狀態按鈕繞過規則。
- 所有延住修改須先顯示日期、房態及費用差異，使用 canonical `booking/pricing.js`／已接受價格快照規則，不可靜默覆寫原始報價；有房態衝突時不得擴展實體房佔用。訊息只產生草稿／開啟使用者確認的通訊 App，不自動發送。

## 5. Booking Detail、編輯、附加費、退款及聯絡記錄

- 共用 Booking Detail 顯示客人所填資料、Booking status、提交時間、入住／退房日期和時間、晚數、房型／合法實體房分配、家長及兩位緊急聯絡人、獸醫資料、逐隻寵物的健康及飲食資料、費用分項、付款及現金按金紀錄、Follow-up、最近聯絡人／時間與操作 Logs。敏感資料只可由有效登入 Staff 查看。
- 寵物／聯絡資料可按 allowlist 編輯；一旦已入住、退房或完成，資料編輯鎖定。一般編輯不可改 Booking ID、原始價格 snapshot、付款狀態、allocation 或 bypass status transition。
- 附加費須逐項記錄描述、金額、原因、操作者、時間及狀態；費用更正採用反向／更正記錄，不覆寫原始價格 snapshot。訂金維持 `baseRoomFee × 50%` 的已接受規則；現金備用金／按金按 `qty × HK$1,000` 獨立於住宿收入。
- 使用者已允許「人工退訂金」：員工須自行輸入精確退款金額及原因，確認後才記錄；金額不得超出該付款類別的已實收扣除既有退款餘額。系統不自動計算建議退款額、不呼叫銀行或付款 gateway、不自動退款；實際退款只在員工確認已於系統外辦妥後寫入 `Payments`／調整紀錄及不可竄改的 `Logs`，並以 idempotency 防重。此人工例外不改客人網站原有訂金條款。
- 支援取消、延住／提早退房紀錄、費用明細、更改紀錄及 WhatsApp 短訊草稿；所有改動需顯示確認及清楚成功／失敗狀態。取消釋房只按現有業務規則，無房衝突的待訂金單不得自動取消。

## 6. Staff 顧客資料（電話唯一分類鍵）

- Staff 顧客頁只能以電話號碼搜尋。以正規化香港電話作唯一整合鍵（忽略空格／標點，支援輸入或儲存值含 `852` 前綴），同一正規化電話的所有 TEST Bookings 歸於同一顧客；姓名或 Email 不可作合併／替代 key。沒有電話的 booking 保持獨立，不推測配對。
- 顧客頁顯示該電話的所有預訂紀錄、寵物種類／數量、可用顧客資料及每筆 Booking 的詳情連結；點擊紀錄可跳至預訂列表或共用 Detail。
- 客人預約頁不按電話查詢歷史資料、不辨認登入客人、不自動預填；本階段不增加 SMS OTP、客人帳戶或 Guest-side personal-data lookup。

## 7. 營收分析

- 年度總覽提供 12 個月趨勢、全年合計，並分開顯示訂金、尾數、附加費／退款等組成；線圖須有圖例、月份及文字／表格摘要。
- 每月並列「預訂住宿金額」與「實際收款」：住宿金額依入住月份及有效 Booking 的原始住宿 snapshot／已核准調整；實際收款按 Payments 交易日期彙總實收訂金／尾數及扣除已實際記錄退款。可按房型、寵物種類分析。
- 現金備用金／按金不計住宿收入；未付款預約不可算作已收款；取消與退款須分開標示。所有圖表使用 LittleLand_TEST 實際資料，清楚標明口徑，不以 mock fixture 冒充營收。

## 8. Staff 新增預訂

- Staff 可新增測試預訂，先選寵物種類，再只列出適用房型；輸入多隻同種類寵物資料；透過 TEST availability 檢查並提示房態衝突；成功後清楚提示 booking 建立結果。
- Create Booking 必須重用 canonical Pricing Engine、寵物數量／年齡／健康驗證、現有聯絡／飲食／服務及 consent 規則，使用 idempotency key；後端重算價格，不信任前端金額。
- 新單維持 `PENDING_CONFIRMATION` 且不配置實體房。Staff 可選房間偏好但必須明示未保留；實體分配只可在員工準備確認收訂金時，於鎖內重新查驗最新房態後完成。豪華套房合法組合等既有房態規則不得改動或繞過。

進度（2026-11-01 13:52 HKT）：Staff 新預約前端已接入共用表單 helper、canonical Pricing Engine 及登入保護的 `staff.availability`；房態、費用摘要、健康覆核提示、倉鼠專屬欄位及提交 pending disabled 已完成 mock 驗證。`npm test` 172/172 通過；390×844 Chromium viewport 無橫向捲動。尚未呼叫真實 TEST Create Booking 或寫入 Sheets；iPhone 人工 UX 驗收及實際 TEST mutation smoke tests 仍待完成，未 commit／push／merge。

## 9. Staff 排班與 TEST-only 結構更新

- 排班日曆可為現有兩位 active TEST Staff 安排每日當值、記錄休息日；休息日不可同時排班；可建立、記錄及追蹤調班；顯示每位員工每月當值日數及完整月曆檢視。
- 排班變更需鎖定並記錄操作者、原排班／新排班、時間及原因；只可排 active Staff，不新增角色分級或第三名帳號。未安排日明確顯示「未排班」。
- 如需新資料表，只在 `LittleLand_TEST` 以向後相容、可重複執行且不清除既有資料的 initializer 新增 `StaffSchedules` 與 `BookingAdjustments`；需要新增 Payments refund 欄位時採 additive migration。先驗證 spreadsheet 名稱／ID allowlist；不可讀寫 Production。

## 10. 共通商業規則、技術與交付邊界

- 保留目前有效流程 `PENDING_CONFIRMATION → PENDING_DEPOSIT → CONFIRMED → CHECKED_IN → CHECKED_OUT → COMPLETED`。只有 `CONFIRMED`／`CHECKED_IN` 佔房；pending、cancelled、checked out、completed 不佔房。確認訂金／分房前必須在 lock 內重新讀最新房態；無房時保留已實收付款紀錄（如適用）、維持待付訂金／無 allocation 並提示跟進，不可自動取消或把收款視為訂房成功。
- 使用已接受的 `booking/pricing.js`，不改房價、晚數、週末費、額外寵物費、服務費、訂金、尾數及現金按金規則。顯示時間為香港 `HH:mm`；所有 mutation 有 request/idempotency 保護，成功後清除記憶體快取，付款確認不可讀 stale cache。
- 只連接現有 TEST API 和 `LittleLand_TEST`。使用全數虛構資料；不讀取或修改 Production、不傳送真正預約／付款、不新增支付 gateway、不寄送真實 WhatsApp/SMS、不 merge `develop`／`main`。
- 完成後提供 Staff/booking Preview 供桌面與 iPhone Safari 實測；人工 UX acceptance 前不 push，之後只同步到 `hklittleland/littleland-booking-system` 的 `feature/test-booking-api`，不推內部 `origin` 或 main。


## 11. WhatsApp 草稿模板（沿用 V3 文案，依正式房態規則修正承諾）

- 僅產生使用者可檢查的草稿／開啟 WhatsApp；不自動送出、不建立付款 gateway。訊息須使用實際 booking 欄位、8 字元 short reference、🐰／🐽／🐹及 `HH:mm`，不得顯示其他客人資料或虛構付款成功。
- 「確認資料／訂金安排」草稿須包含寵物名、房型、晚數、入住／退房日期及時段、預留 15–30 分鐘辦理手續、健康檢查及同意條款、入住時繳清尾數及附加費、每隻 HK$1,000 現金備用金／按金，以及可選手動 `{付款連結}` placeholder；明確說明收到訂金後仍須重新確認房態，只有成功分配合法房間並轉 `CONFIRMED` 才正式保留，不可說「付款後即保留」。
- 「入住前提醒」草稿保留 V3 內容：距離入住 2 日、入住日期及時間、預留 15–30 分鐘、每隻 HK$1,000 現金、LittleLand 地址「觀塘｜成業街19-21號成業工業大廈13樓16室」、準備清晰正面相、入住前提供滴蝨證明／醫療紀錄、保留 2–3 日糞便、可攜帶熟悉用品。
- 「訂金已收確認」只有在 TEST API 回傳 `CONFIRMED` 並有合法實體房分配時才可使用「房間已為您保留」。若已收款但房態衝突，必須改用「已收到訂金、房間仍待員工確認，我們會盡快聯絡」草稿，不能誤導客人。
- 「取消確認」須列出取消結果；退款只有在員工已實際完成且系統人工退款紀錄已確認時才寫「已退款」，否則只可寫「已取消，退款將按條款及員工覆核處理」。
- 「提早退房確認」列出原退房日、新退房日及員工已人工確認的實際退款金額；不得自動計算或宣稱已付款。


## 12. Booking Detail 部分退款、附加費及費用更改（使用者 2026-11-01 新增）

- Booking Detail 提供可見的人工部分退款表單；員工選擇一筆已實收住宿付款、輸入精確退款金額及原因、清楚確認已在系統外實際完成退款後才記錄。退款不得超過所選付款的實收額扣除已記錄退款；每次都寫入 `Payments`／`BookingAdjustments`／`Logs`，使用 idempotency。系統不可自動決定退款額、呼叫銀行或支付 gateway；現金按金沿用獨立流程。
- 已取消預約如仍有可退款的已實收住宿款，仍可按上述人工確認流程記錄部分退款；取消狀態下不開放新增費用或入住寵物更改，且退款不可重算／重開已取消 Booking 的尾數。
- 員工可在 Booking Detail 隨時增加或減少附加費項目及自訂金額，不限於未付款狀態或入住後操作；每項必須保存描述、正負金額、原因、員工、時間及關聯。減少／移除已記錄費用時以新負數更正紀錄處理，不刪除或覆寫舊付款／附加費紀錄。
- 附加費可逐隻寵物計算。員工可選取一隻或多隻入住寵物、輸入服務描述及每隻金額；每隻收費須能在明細獨立辨認。不得把服務費誤加到全部寵物或現金按金。
- **收訂金前更改：**若尚無已實收訂金 `Payments` 紀錄，寵物數量或費用調整後，重新計算 canonical 房費、額外寵物費、週末費、服務／人工附加費合計、住宿總額、應收訂金及尾數；訂金必須仍為 `baseRoomFee × 50%`，現金按金仍為入住數量 × HK$1,000 且不計入住宿總額。
- **收訂金後更改：**一旦已有已實收訂金，保留原已收訂金金額，不因新增／減少寵物或費用變動而重算或自動退回訂金；按最新總額及已收付款淨額重新計算尾數。若已收總款高於新總額，明確顯示多收／待人工退款金額，不自動退款或改寫原付款。
- 現金備用金／按金維持獨立現金紀錄，預計金額為目前入住寵物數量 × HK$1,000；寵物數量變更不把現金按金加入房費、訂金、尾數或住宿營收。已收現金按金不可因更改數量而自動退款。

## 13. 預約寵物數量增減（全流程）

- 員工可在 booking 非取消狀態下增加或減少入住寵物數量，從 PENDING_CONFIRMATION 到 COMPLETED 均可執行；新增寵物必須填妥現有規格要求的完整寵物及健康資料。
- 所有入住寵物仍須屬同一物種；新增／移除後數量至少一隻，並符合該物種及房型已接受入住上限。超限時整筆變更失敗且不得部分寫入。
- 移除寵物採軟刪除／歸檔並保留原資料及操作 Logs；`Bookings.quantity` 反映目前實際入住寵物數量。寵物新增／移除、數量與最新收費必須在同一鎖定、版本檢查及冪等 mutation 內一致更新。
- 若 Booking 已正式分配並佔用房間，新增寵物前須重新確認該房型、該合法實體房間仍符合新數量及容量；不符合時整筆變更拒絕，不能更改既有 allocation、轉用非法房間組合或繞過 `S1+S3` 禁止規則。PENDING 狀態不可因此分配房間。

## 14. 2026 年度及月份營收瀏覽

- 營收頁預設顯示 2026 年完整年度 12 個月總覽、年度住宿預訂金額及年度實際收款；全年每月均可被選取以瀏覽該月總覽。
- 年／月明細分開顯示住宿預訂金額（按入住月份）、實際收款（按付款日期、扣除已記錄退款）、已收訂金、已收尾數、附加費、退款及住宿晚數；現金按金不可列作住宿收入或實收住宿款。
- 保留圖表圖例與可讀文字／表格摘要；月份切換後必須載入並展示所選月份，不得繼續顯示預設月份。頁面數字只來自 TEST API/TEST 資料，不以 mock 數字冒充真實營收。

**V3.1 安全界線：**以上只開發 LittleLand_TEST 的程式與 mock 測試；不寫入 Google Sheets、不實際退款、不部署 Apps Script、不接 Production、不 merge develop/main。Schema 若需更新，採已知欄位的 additive migration，先保留全部現有 TEST rows；真正執行 migration／部署須另行確認。


## 15. Booking Detail 更改記錄顯示 Staff 姓名（使用者 2026-11-01 新增）

- Booking Detail 的操作 Logs 及 follow-up 歷史必須清楚顯示是哪一位 Staff 執行，不可只顯示時間、操作及摘要。
- 每筆新的員工操作 Log 保存 `actorStaffId` 及操作當下的 `actorStaffNameSnapshot`；舊 Log 如沒有姓名快照，讀取時以 `actorStaffId` 對照 Staff 名冊顯示姓名；無法對照時至少顯示 Staff ID。
- 加入姓名快照的 TEST schema 變更只可 additive migration，保留既有 Logs 列，不存密碼、Session token 或其他登入憑證；只開發及 mock 測試，不執行 Sheets migration。


**V3.1 進度（2026-11-01 14:47 HKT）：**退款／費用更改／寵物數量更新、操作者姓名快照、2026 全年/月度營收 UI 與 TEST initializer additive migration 已有程式碼和 mock regression 覆蓋；`npm test` 為 188 PASS / 0 FAIL。尚未寫入 LittleLand_TEST Sheets、執行資料 migration、部署 GAS、做真實退款、commit/push/merge；Staff iPhone 人工 UX 驗收仍待進行。


**測試數量更正（2026-11-01 14:57 HKT）：**追加 append-only reversal 與取消預約退款 regression 後，最新完整 `npm test` 為 **190 PASS / 0 FAIL**；此數字取代上方較早的 188 PASS 記錄。


## 16. 新預約飲食品牌選項
- 選擇寵物種類後，主糧下拉即時顯示該物種的品牌，不可一直只有「請選擇」：兔子為 Oxbow 成兔糧、Momi T（成兔）、Momi A（幼兔）、自行攜帶；天竺鼠為 Oxbow 天竺鼠糧、Momi 天竺鼠糧、自行攜帶；倉鼠為 BUNNY 倉鼠糧、自行攜帶。
- 兔子及天竺鼠牧草下拉顯示 Joy & Fibre 1st cut、Momi 1st cut、Chewbo 1st cut、自行攜帶；倉鼠不顯示牧草。更換物種時重繪選項並清除舊物種不適用的主糧／牧草／餵食值。

## 17. Booking Detail WhatsApp 訊息按鈕
- Booking Detail 依 booking status 顯示「預約資料已收到／待確認」、「訂金安排／訂金提醒」、「預約已確認」、「入住前提醒」等適用草稿按鈕；沿用 TODO V3 指定模板和真實訂單欄位，不自行承諾尚未確認的房間已保留。
- 草稿使用 booking short reference、寵物種類圖示／寵物名、房型、入住／退房日期與時間及相關應收金額；不得帶出其他客人資料、虛構付款成功或不必要健康資料。
- 操作只預覽／複製訊息或開啟預填 WhatsApp 草稿；員工仍須在 WhatsApp 手動按送出。`TEST-####` 佔位電話不得開啟 WhatsApp。正式自動發送不在本次範圍，須另接官方 WhatsApp Business API 並另行核准。

## 18. 排班月曆簡化與一次保存
- 排班頁以月曆格呈現月份每一天，格內直接提供一個下拉選單：「未安排」或 2–3 位有效排班名冊員工其中之一，選單及月曆顯示設定頁所設員工名稱；不再要求逐日進入編輯表單，不顯示複雜班次交換表單。
- 整月只有一個「儲存本月排班」按鈕；單次登入保護 API mutation 提交整個月份的每日選擇。整個 payload 先驗證日期皆屬選定月份、每日期唯一、所選員工仍有效及 idempotency，驗證失敗不得開始寫入。選中的員工該日為 WORK，其餘有效排班員工為 REST；「未安排」表示當日所有有效排班員工均為 REST。
- 批次更新只改所選月份 `StaffSchedules`，不得刪除其他月份資料；保留本月／下月導覽、今日標示、當值統計及逐操作 Staff Logs（含登入操作員姓名）。
- 點選每日員工下拉選單只更新目前月的草稿，不得觸發月份導航；月曆必須停留在同一年／月。月份導航按鈕需使用獨立識別，不能與表單上的 `data-schedule-month` 欄位共用 selector。保存時送出的 year/month 必須是目前顯示月份；保存成功後仍停留本月，API 失敗則保留所有下拉選擇供重試。

## 19. 排班員工名稱設定（TEST）
- Settings 頁提供 2–3 個排班員工名稱欄位；最少 2 個必填、第三位可留空。依使用者指定，第三位預填名稱為「Yip」，可更改或留空；員工名稱只用作排班下拉／月曆顯示，不建立登入帳號、不修改 Staff 登入資料或權限。
- 排班名冊保存於新的 `ScheduleEmployees` 工作表，欄位包含穩定排班員工 ID、顯示名稱、啟用狀態、排序及建立／更新操作者與時間。既有 `StaffSchedules` 以穩定員工 ID 關聯；變更名稱不得清除既有排班或其他月份資料。
- 儲存名冊必須經登入保護的 TEST API、驗證至少兩名且最多三名非空不重複姓名、使用 idempotency，並寫入含登入操作員姓名的 `Logs`。既有兩個 TEST ADMIN 登入帳號、密碼及 Session 不得更改。
- `ScheduleEmployees` 只以可重複、非破壞性的方式加入 `LittleLand_TEST` schema；不得讀寫 Production，不得建立第三個登入帳號。

## 20. WhatsApp 原文模板核對
- 以下五款為唯一客人 WhatsApp 模板；文字、標點、emoji、Markdown 符號與換行逐字保留，只代入 `{...}` 變數。系統只預覽／複製／開啟草稿，員工須手動傳送，不自動傳送。
- #1「確認付款訊息」：員工核對資料後、訂金未收的 `PENDING_DEPOSIT` 可用；訂金已收或存在房態衝突不可用。#2「入住前提醒」：已付訂金、成功分配房間的 `CONFIRMED`，入住前剛好 2 日可用（正文固定「仲有2日」）。#3「訂金已收確認」：`CONFIRMED`、已收訂金及已分配實體房間才可用。#4「取消確認」：`CANCELLED` 才可用，正文不可表示退款已完成。#5「提早退房確認」：只在記錄了實際提早退房日期後可用；退款金額僅用原因明確為提早退房的已記錄退款，否則留待員工在草稿輸入，不自行推算。
- Booking Detail 永遠顯示五款模板卡；不適用卡片保留並說明原因、停用操作。必要變數（付款連結、退款金額等）未填完不可複製／開啟；有效電話仍可複製草稿，但無效電話不可開 WhatsApp。所有五個卡片需逐字回歸測試。
- TODO 內的 code block 為避免 Git 尾端空白檢查而省略行尾空格；程式及逐字測試保留使用者貼出的原字元：#1 第一行末尾 1 個空格、兩行日期末尾各 2 個空格；#2 `入住時間:{入住時間}` 末尾 1 個空格。這些空格並非額外改寫。
- #1 原文：
```text
感謝您的預訂 ~
👩🏻‍💻已確定資料如下:
🐰{寵物名}🛏️ {房型}(共{晚數}晚)
入住日期 *{入住日期}*  `_Check-In時間 🕰️{入住時間}_`
退房日期 *{退房日期}*  `_Check-Out時間 🕰️{退房時間}_`
> 請按時出席，並預留約15-30分鐘時間辦理相關手續。

🛋️入住流程🌟
▶️我們將為小動物進行簡單身體檢查，確保身體狀況適合寄養。如有異常情況。本公司擁有絕對酌情權，決定接受或拒絕任何動物入住。
▶️家長需簽署【入住須知及寄養條款】及填寫【健康申報表】。
▶️入住時需 *繳清房費尾數* 及 *所有額外收費*。
▶️⭕ *提交 _現金HK$1,000_ 作備用金/按金*⭕

❤️ *入住前準備* 🧡
1️⃣請提供小動物清晰正面相，以作房卡之用。
2️⃣請於入住前提供滴蝨証明，如相片(需顯示滴蝨日期)、醫療記錄等。
3️⃣請保留小動物2-3天的💩💩，於入住時提供職員參考以辨健康狀況。
-------------------------------------------------------------------------------------------------------------🖊️
📋現附上【入住須知及寄養條款】以供參考 。
💳 _*請透過此連結繳付50%住宿費訂金，作保留房間之用。*_
{付款連結}
請完成付款後於網站/WHATSAPP回傳付款憑證，Thanks ~
```
- #2 原文：
```text
🏡入住提示    | {寵物圖示}{寵物名}📆  仲有2日就要入住酒店拉~🥰
日期:{入住日期}
入住時間:{入住時間}
***預留 _15-30分鐘_ 時間辦理入住手續及帶備按金 💵1000現金(*每位小動物)_***
🐾地址:觀塘｜成業街19-21號成業工業大廈13樓16室

💡小提示
1.可帶同小動物平日使用的小毛巾/屋仔，增加安全感💕
2. 請保留小動物2-3天的💩💩
---------------------------------------------------------------------------------------------------
*請於今日/明天提供滴蝨証明，如相片(需顯示滴蝨日期)、醫療記錄等。*
*＊如將自行準備用品，請再告知物品內容（如水樽、廁所等）**
```
- #3 原文：`✅ 訂金已收到，謝謝！\n房間已為您保留。\n入住日期：{入住日期}\n如有任何問題，歡迎聯絡我們～`
- #4 原文：`已為您取消預訂。\n如已支付訂金，將按條款處理退款。\n如有疑問，歡迎聯絡我們～`
- #5 原文：`已為您安排提早退房。\n原退房日期：{原退房日期}\n新退房日期：{新退房日期}\n退款金額：HK${退款金額}\n如有疑問，歡迎聯絡我們～`

## 21. Booking Detail 客人資料核對／收費列印（TEST）
- Booking Detail 增加「列印／另存 PDF」操作，從目前已載入的單一預約資料建立客人可核對的列印頁；不呼叫額外客人查詢、不包含其他訂單或 Staff 帳密。桌面列印可輸出 PDF，iPhone Safari 可用列印分享流程另存 PDF；列印按鈕只開列印介面，不代表付款、入住或房間已確認。
- 顯示八字短 Booking Reference、客人姓名／電話／Email／兩位緊急聯絡人、入住／退房日期時間、房型、每隻現存寵物的名稱／種類／品種／年齡／性別，以及飲食、健康申報、用藥／特別照顧；不得顯示完整內部 Booking ID、實體房號、其他客人資料或內部健康覆核碼。
- 收費明細必須按目前訂單 snapshot 逐項列出房費、額外寵物費、週末費、逐項額外服務、人工附加費／減項與合計、目前住宿總額、訂金及已收狀態、尾數及狀態、現金備用金／按金及實收／使用／應退摘要；現金按金不得加進住宿總額。零金額附加費及合計不顯示。梳毛／餵藥等逐寵物服務需逐行列出毛孩名稱和金額；沒有寵物關聯的逐寵物服務標示「毛孩未指定」。Staff 調整表可單獨選擇一隻或多隻寵物；不同毛孩需收不同金額時須逐隻分開記錄。顯示TEST資料，不杜撰或重算已保存金額。
- 合併列印版附上使用者提供的《入住須知及寄養條款.pdf》原頁，逐頁原樣附入；不得改寫條款。原《藥物(1次2次)(1).pdf》只作欄位與可愛風格參考，不直接附入舊表；以同一柔和可愛風格重新設計藥物及日常照顧表，按預約自動帶入家長／緊急聯絡資料、寵物資料、飲食、健康／藥物指示與實際住宿日期，提供每日勾選欄；倉鼠長擺糧，不出現餵食次數或假期提醒。原始 PDF 檔案不改動。列印版只供 TEST 驗收。
- 原稿條款與目前已接受政策有差異：原稿天竺鼠最低 2 個月、倉鼠 1 個月、術後 1 週限制、入住／退房時間範圍；目前系統為天竺鼠 3 個月、倉鼠 2 個月、術後 30 日及不同時段。正式對客人使用前須由使用者確認是否修訂原稿；本輪不得擅自改動法律文字或任何核心預約規則。

## 22. 每隻寵物資料卡的附加費入口
- 每隻現存寵物資料卡中，必須有清楚、可見的「為此毛孩新增／減少附加費」入口。表單自動綁定該寵物 ID，新增或減少只套用到該隻，不需要在訂單共用表單尋找寵物勾選入口。
- 支援項目、加收／減少、金額及原因；常用預設：單次梳毛 HK$70；每日梳毛 HK$50 × 晚數；每日餵藥 1 次 HK$80 × 晚數；每日餵藥 2 次 HK$150 × 晚數。金額可修改或選自訂項目。同房不同寵物如需不同服務／金額，必須各自在其資料卡分開記錄；梳毛／餵藥不得預設套用到所有寵物。
- 每隻資料卡顯示該寵物的調整紀錄及操作員；保留 append-only financial reversal、登入保護、version/idempotency 及 Staff Logs。全預約通用費用的共用表單仍可保留，但需清楚標示適用範圍。


**V3.1 Round 2 TEST 驗收（2026-11-01 18:12 HKT）：**最新完整 `npm test` 為 **215 PASS / 0 FAIL**；前端/GAS JavaScript parse、`git diff --check` 均通過。`ScheduleEmployees` 以 add-only initializer 建立於 LittleLand_TEST；Settings 支援 2–3 個排班名稱，第三位預設 Yip，獨立於登入權限。既有 TEST Web App 已更新為 V11，部署清單顯示 V11、V10 已封存；同一 `/exec` URL 的未寫入 availability GET 為 HTTP 200 且回報可預訂。Staff Preview HTTP 200。官方 branch `feature/test-booking-api` 的 commit `3123db681bc69ee8ce2fa404389c67639b0fa0f3` 已推送；未 merge main。Production 未連接，沒有新增預約／付款資料。


**最終測試更正（2026-11-01 16:14 HKT）：**新增整月排班 API regression 後，完整 `npm test` 為 **200 PASS / 0 FAIL**；此結果取代先前 190 PASS 的中間數字。


**V3.1.3 Per-pet fees + WhatsApp（2026-11-01 18:41 HKT）：**每隻毛孩卡片有明確的專屬費用表單，會帶單一 Pet ID；通用費用表保留為進階／批次用途。五款 WhatsApp 模板卡固定完整顯示並按狀態／資料停用或啟用；原文逐字測試、付款連結與早退退款缺值、電話無效及狀態不符測試均通過。定向測試 16/16、完整 `npm test` 220/220；`node --check` 與 `git diff --check` 通過。Staff Preview 的 `/staff/`、`app.js`、fee module、WhatsApp module 及 route manifest 全部 HTTP 200；未發送 WhatsApp、未新增 TEST 預約／付款、未改 Apps Script／Sheets、未連 Production。本輪 official feature branch push 待執行。


**V3.1.3 Official sync（2026-11-01 18:43 HKT）：**上一則 18:41 記錄為推送前狀態，現已完成同步：`bb384b1dedc59c10152237d1c926b23a538e7eda` 已推送至 `hklittleland/littleland-booking-system` 的 `feature/test-booking-api`。沒有推送 Manus 內部 `origin`，沒有 merge `main`，沒有連 Production。


**排班月曆跳月修復（2026-11-01 19:04 HKT）：**根因為月份導航曾選取所有 `[data-schedule-month]`，因此月曆表單內部點擊也觸發跳月；現改為專用 `button[data-schedule-month-nav]`。Focused schedule tests 12/12、完整 `npm test` 222/222；`node --check` 和 `git diff --check` 通過。Staff Preview `/staff/`、`staff/app.js`、`staff/schedule-view.js`、`manus-routes.json` 均 HTTP 200。只改前端／測試／文件；不改 Apps Script 或 Sheets，不寫入任何排班，不接 Production。官方 feature branch 同步待執行。
