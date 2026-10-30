# TASK-002 — Pricing Engine

## 目標與範圍

在 `feature/pricing-engine` 實作一個純 JavaScript、無副作用的 LittleLand Pricing Engine，依 LittleLand V3.0 已確認規則，把住宿日期、物種／房型、數量及所選服務轉成完整費用分解。模組可在瀏覽器和 Node.js 使用，供後續 TASK-003／TASK-008 接用；本次不將它接入 Booking UI，不呼叫 API、不建立 Apps Script/Sheets、不實作前端驗證、付款、房態或後台，不部署、不合併。

## 實作決定

- 新增 `booking/pricing.js`，以 UMD/全域命名空間方式同時支援瀏覽器與 CommonJS；不引入依賴。匯出唯讀房型目錄、`calculatePricing(input)` 及明確的 `PricingError`。
- 輸入使用 ISO `YYYY-MM-DD` 日期、`species`、`roomId`、`quantity` 及服務選項；計價模組自行根據可信的內建房型目錄決定單價及上限，不接受呼叫方傳入價格。
- 日期使用 UTC 日界線計算晚數和星期幾，避免時區/DST 導致跨日誤差。拒絕不存在的日期、退房不晚於入住、未知物種/房型、非正整數數量、超過該物種房型上限及無效/重複服務選項，並回傳可機器判斷的錯誤碼；本模組不判斷日期是否早於今日（屬日期/預約驗證，不是計價公式）。
- 回傳包含房型/數量/晚數、基本房費、額外寵物費、週末短住費、逐項服務費、附加費總額、住宿總額、基本房費 50% 訂金、入住當日尾數及不計入住宿價款的現金按金。
- 使用 Node.js 內建 `node:test`／`assert` 建立無第三方依賴測試。保留 TASK-001 的 UI 原狀；此 task 只新增獨立引擎、測試及專案任務紀錄。

## 專案結構

- `booking/pricing.js`：房型與上限目錄、輸入驗證、純計價函式及可辨識錯誤。
- `tests/pricing.test.js`：定價矩陣、指定公式樣本、週末邊界、服務、按金隔離及無效輸入回歸測試。
- `TODO.md`：保留已完成 TASK-001，新增本 TASK 的完整接受條件及進度。

## 設計／品牌

本任務不改變視覺介面，保持現有 LittleLand 品牌設計不變；計價引擎與 UI 解耦，避免核心計價邏輯綁定於 hosting 或前端顯示文案。


# TASK-004 — Google Sheets TEST Schema + Initialization（已核准・已完成）

## 範圍與安全界線

本次只規劃及交付 V3.0 所指定的 TEST Google Spreadsheet 資料結構、schema 文件、可重複且非破壞式的初始化腳本，以及一份新的 `LittleLand_TEST` 試算表。沿用原始規格的八個工作表名稱：`Bookings`、`Pets`、`Payments`、`Rooms`、`Logs`、`IdempotencyKeys`、`Staff`、`Sessions`。不得讀取、匯入、連接、複製或修改任何正式 LittleLand 客人資料或正式試算表；不得建立真實預約、付款、員工帳號或登入 Session。

不執行 TASK-003 Frontend Validation（使用者已明確跳過）；不實作 TASK-005 Inventory Engine、TASK-006 Availability API、TASK-007 Create Booking API、Staff Login/Auth API、付款系統、部署或 Production。前台及 `booking/pricing.js` 維持原狀。

## 資料模型

每張表第一列為固定 camelCase 欄名；每一筆記錄一列，以獨立業務 ID 為主鍵，不以 Google Sheet row number 當 ID。`Bookings` 保存一張訂單一列及日期／時段、物種／Room Type ID／數量、聯絡欄位、目前前台的訂單層飲食選項、服務選項、六項同意、房費和各費用 snapshot、價格／政策／房規版本、預約狀態、付款狀態、現金按金紀錄及員工 follow-up 欄位。保留 V3.0 的訂單狀態、三種付款狀態、費用公式、訂金僅按基本房費 50% 計算、現金按金 `qty * 1000` 且不併入住宿金額等既定規則。

`Pets` 每隻毛孩一列，以 `petId` 關聯 `bookingId`，保存已接受前台欄位：名稱、品種、年齡數值／月或歲／換算月齡、性別、絕育、懷孕、最近 30 日手術、獸醫／傳染病／慢性病／服藥詳情、特殊照顧、杜蝨及 `healthReviewStatus`；需要人工覆核時存入既定值 `HEALTH_REVIEW_REQUIRED`。倉鼠不適用欄位留空；不把需人工覆核轉成自動批准入住。

`Payments` 作付款／退款紀錄明細並關聯 `bookingId`，保留付款種類、金額、狀態、方法、交易參考、付款／退款時間及員工記錄者；不連支付服務也不預填付款資料。`Rooms` 保存 V3.0 實體房及虛擬組合主檔：10 個實體房（S1–S3、A1–A3、B1–B2、C1、F1）及虛擬房 SS1／SSR1，明確以 `roomKind` 區分 PHYSICAL/VIRTUAL，使用組合選項記錄 SS1 僅可 S1+S2 或 S2+S3、SSR1 固定 S1+S2+S3；SS1/SSR1 不可計作額外實體房。房價及物種別入住上限仍以已驗收的 `pricing.js`／V3.0 規則為準，不在 Rooms 內建立衝突的容量或價格來源。

`Logs` 保存事件時間、操作者類型／員工 ID、操作、對象、request ID 及精簡變更摘要；不記錄密碼、原始 Session token 或不必要的完整個人資料。`IdempotencyKeys` 保存唯一 key、操作範圍、payload hash、處理狀態、結果 Booking ID 及可重用回應資料；規格未訂保留期限，本次不設定自動 TTL。`Staff` 只建立欄位，不初始化任何員工；保存 username、角色、active 狀態及密碼 hash／salt 欄位，絕不存明文密碼。`Sessions` 只建立欄位，不產生 Session；只保存 token hash，不保存原始 token。密碼 hash 算法、Session 期限、資料保留期及付款方法政策未由規格定義，本次不自行決定或啟用。

## 初始化方式與實際交付

建立 `docs/SHEETS-SCHEMA.md`，逐表列出欄名、資料用途、主鍵／關聯、允許的既定狀態值、敏感資料注意事項及 TEST 初始化範圍。建立 `apps-script/InitializeTestSheets.gs`，提供手動 `initializeLittleLandTestSheets()`：Apps Script Script Property `LITTLELAND_TEST_SPREADSHEET_ID` 必須已設定，且與傳入／目標 spreadsheet ID 完全相同；試算表名稱必須精確為 `LittleLand_TEST`。只建立缺少的工作表／空白表頭；若有額外分頁、表頭不符、未知／重複房間 ID 或已存在房間資料與 seed 不符則停止並保留原資料，不清空、不覆寫、不刪除；以 `roomId` 冪等補入固定的 10 個實體房及 2 個虛擬房主檔；不建立任何客人、寵物、付款、員工、Session 或 idempotency 測試記錄。腳本只作初始化，不是可部署 API。

已透過 Google Workspace Sheets 工具先搜尋同名 TEST 檔，確認不存在後，在預設 My Drive 建立一份新的 `LittleLand_TEST`，設定 timezone 為 `Asia/Hong_Kong`，未設定共享；回讀確認名稱、正好八個分頁、八張表頭及 12 筆 Rooms seed。`Staff`、`Sessions` 及其他含個人資料的表保持只有表頭，沒有測試客資。Apps Script initializer 為 source-only，尚未部署或執行；未連接正式試算表，未讀取或修改正式資料。

## 專案結構、依賴與版本控制

- `docs/SHEETS-SCHEMA.md`：八表資料字典與 TEST 安全界線。
- `apps-script/InitializeTestSheets.gs`：有名稱與既有表頭保護的手動 TEST 初始化器；不部署、不提供 API。
- `booking/pricing.js`：現有價格目錄的唯讀參照；不複製為第二個權威價格來源。
- `TODO.md`：計畫獲核准後才更新 TASK-004 的完整驗收條件及狀態；保留 TASK-001、TASK-002 已完成紀錄。
- 外部 Google Sheets：新建且僅限 TEST 的 `LittleLand_TEST`，八個工作表。

以新 feature branch `feature/test-sheets-schema` 開發，只同步到正式 GitHub repository `hklittleland/littleland-booking-system`；不合併 `develop` 或 `main`，不部署網站。完成文件／初始化器及 TEST spreadsheet 後執行可用的檢查、讀回八表與表頭、比對 Rooms seed，再停止回報，等待使用者驗收後才進行下一個 Task。

## 視覺／品牌

本 Task 不改前台介面；既有 LittleLand 柔和風格維持不變。Google Sheets 使用清晰可讀的純資料表結構，不增加與資料操作無關的裝飾或客戶端功能。


### TEST 初始化器安全加固

在 Apps Script Script Properties 設定 `LITTLELAND_TEST_SPREADSHEET_ID` 作為唯一允許的 TEST spreadsheet ID；`initializeLittleLandTestSheets(spreadsheetId)` 須同時驗證傳入／設定 ID 相同且名稱精確為 `LittleLand_TEST`。未設定、ID 不一致或名稱不符一律停止；不得提供預設 Production ID 或自動尋找正式試算表。


# 第二部分 — 房態系統與防重複提交（舊稿，已由下方修訂版取代）

> 以下第一版草稿只涵蓋服務 helper，未納入使用者其後要求的完整 TEST Create Booking API；不得依此舊稿實作。

## 範圍與安全界線

依使用者本次指示，提議實作 Apps Script 房間庫存／可用性服務，以及可供後續建單呼叫的 Idempotency helper。只讀取 allow-list 指向的 `LittleLand_TEST`；不讀取或寫入任何正式試算表，不用真實客人資料，不在實際 Google Sheet 建立測試 Booking／Idempotency row，不部署 Apps Script Web App，也不連接客人前台。測試只用 Node.js mock Sheet／LockService。

為維持 V3.0 開發順序及避免未授權擴大，本部分不實作 `Create Booking API`／`doPost`、不實際寫入 Booking／Pets／Logs、也不做前台接線或 Production。房態會提供 Apps Script 內部查詢服務（不是可直接呼叫的 HTTP API）；Idempotency 會提供鎖定與回放 helper，供之後的建單 API 使用。若使用者希望本部分同時包含可部署的 Availability API 或完整 TEST 建單 API，須先調整本計畫並另行核准。

## 實作方式與 V3.0 約束

- `apps-script/RoomAvailability.gs`：讀取 `Rooms` 及 `Bookings` 最新資料，使用與 TASK-004 相同的 `LITTLELAND_TEST_SPREADSHEET_ID` allow-list，並再次核對 spreadsheet 名稱精確為 `LittleLand_TEST` 及必要表頭。每次查詢直接讀取最新資料，不用 Cache；房態查詢只回傳安全的 `available` 布林值／V3.0 API envelope，不回傳實體房 ID、Virtual Room ID、Booking ID、其他客人、待付訂金狀態、員工 follow-up 或不可預訂原因；任何讀取／資料完整性錯誤不得回報「可預訂」。
- 房態只將 `PENDING_DEPOSIT`、`CONFIRMED`、`CHECKED_IN` 視為佔房；`PENDING_CONFIRMATION`、`CANCELLED`、`CHECKED_OUT`、`COMPLETED` 不佔房。`PENDING_DEPOSIT` 持續佔房，不設期限、不倒數、不自動取消或釋放；撞期只由房態回覆不可用，員工跟進留待後台功能處理。
- 日期區間使用入住日含、退房日不含；與既有訂單重疊 iff `newCheckout > existingCheckin && newCheckin < existingCheckout`。同日退房／下一位入住不視為重疊。日期格式／日期順序無效時回應 V3.0 穩定錯誤碼，不讓前端把錯誤當可用。
- 實體房唯一為 S1、S2、S3、A1、A2、A3、B1、B2、C1、F1；不得將 `SS1`／`SSR1` 當額外實體房或存進實際分配欄。分配順序：獨立套房 S1→S2→S3；豪華套房 SS1 僅 S1+S2→S2+S3（禁止 S1+S3）；非常.豪華套房 SSR1 固定 S1+S2+S3；豪華房 A1→A2→A3；標準房 B1→B2；整理箱 C1；自備籠 F1。已佔用的實體 ID 會同時阻止任何重疊的虛擬組合。無房時客人端只收到 `available=false`；完整 allocation 僅供未來受控建單服務內部使用。佔房 Booking 缺少／含未知／虛擬房 ID 的 allocation 時 fail-closed，回傳 V3.0 房間完整性錯誤，不猜測或釋放房間。
- `apps-script/IdempotencyService.gs`：提供以穩定呼叫端 `idempotencyKey`、操作名稱、canonical payload hash 及 callback 執行的 helper。使用 `LockService.getScriptLock()` 防止同一 Script 的併發重複執行；取得 lock 後重新查 key，以涵蓋 lock 前的競態。完全相同 key／operation／payload 若已完成，回放已保存 response snapshot 且 callback 不再執行；相同 key 搭配不同 operation 或 payload 回 `DUPLICATE_REQUEST`，不可建立第二結果；仍是 `PROCESSING` 的 key 不重新執行 callback，採 fail-closed／retryable duplicate 回應，交由後續人工 reconciliation，不自動清除。Lock 逾時使用既有 `LOCK_TIMEOUT` 並標記可重試。
- `IdempotencyKeys.state` 在 V3.0 未指定狀態詞彙，建議只作技術狀態使用：`PROCESSING`、`COMPLETED`、`FAILED`，不可混作 `bookingStatus`。明確失敗須保存精簡、可重播的結果；不保存原始 payload／不必要個人資料，只保存既有 `payloadHash` 及精簡 `responseSnapshotJson`。V3.0 未定義 key 保留期限，故不設定 TTL、不自動刪除／重設 key。正式建單仍須在同一 lock 範圍依序完成重新驗證、重新計價、讀取最新房態、重新分配實體房、建立 TEST Booking ID、保存、寫 Logs，之後才完成 Idempotency 記錄；該建單流程本身留待後續 TASK-007。
- 回應遵循 V3.0 `{success, code, message, requestId, timestamp, data}`／失敗 `retryable` envelope，前端只依 code 判斷。房態中的無房是 `success:true`、`data.available:false`，不可洩露 `ROOM_TYPE_FULL` 等內部原因；資料讀取或系統錯誤必須回失敗，不能假裝 available。沿用 V3.0 error code（如 `ROOM_NO_LONGER_AVAILABLE`、`ROOM_INVALID_ALLOCATION`、`ROOM_OVERLAP_DETECTED`、`ROOM_ALLOCATION_FAILED`、`DUPLICATE_REQUEST`、`LOCK_TIMEOUT`、`SHEET_READ_FAILED`），不另造取代 V3.0 的業務規則。

## 專案結構及依賴

- `apps-script/RoomAvailability.gs`：TEST Sheet 驗證、日期重疊、佔房判定、候選實體房／虛擬組合映射及安全查詢結果；不提供 `doGet`／部署入口，不寫入資料。
- `apps-script/IdempotencyService.gs`：LockService 序列化、key/payload hash 比對、結果回放及 fail-closed 狀態轉換；只由後續建單服務呼叫，本部分不建立 Booking。
- `tests/apps-script/room-availability.test.js`、`tests/apps-script/idempotency.test.js`：使用 Node 內建 `node:test`／mock Apps Script globals，無新增第三方套件，不連真實 Spreadsheet。
- 現有 `docs/SHEETS-SCHEMA.md`、TASK-004 initializer 與 `booking/pricing.js` 為唯讀依賴；除非實作證明 schema 欄位不足，否則不改已驗收欄位／價規。若需改 schema，先停止並提出差異，不在初始化器中破壞性修改。

完成並通過實作檢查後，只提交到 `hklittleland/littleland-booking-system` 的新 feature branch，不推送內部 `origin`，不合併 `develop`／`main`，不部署、不動任何真實或 TEST 預約資料；完成後停止並回報，等待使用者驗收。


# 第二部分 — 修訂版 v2：TEST 房態與完整建單 API（已核准；程式碼＋mock tests）

本修訂版取代上方已標明作廢的第一版草稿。使用者已核准納入完整 TEST Create Booking API，選擇只開發程式碼及模擬測試；不寫入任何試算表列、不建立 Apps Script 專案、不部署。

## 範圍及程式結構

本部分合併 V3.0 roadmap 的 Inventory Engine、Availability API、Create Booking API 及建單所需 Idempotency 核心；完整後端驗證及重算只實作於 Apps Script，不做 TASK-008 前台接線。計畫新增 `apps-script/TestSpreadsheetAccess.gs`（唯一 TEST allow-list 存取）、`apps-script/PricingEngine.gs`（由已驗收 `booking/pricing.js` 產生／鏡像的 GAS V8 模組）、`apps-script/BookingValidation.gs`、`apps-script/RoomAvailability.gs`、`apps-script/IdempotencyService.gs`、`apps-script/BookingApi.gs`，以及 `tests/apps-script/` 下的 Node `node:test` mock tests。除文件所述 mirror parity 外，不改已驗收前台或 canonical Pricing Engine；不新增第三方套件。

`doGet?action=availability` 提供只回傳 `available` 布林值的房態查詢；`doPost` 接受 Create Booking JSON，並回傳 V3.0 API envelope。請求含穩定 `idempotencyKey`、現有前台欄位（日期／時段、物種／房型／數量、pets 陣列、聯絡、飲食、服務、六項 consent）及含 `priceVersion` 的 client quote snapshot。client 版本過期回 `PRICE_VERSION_EXPIRED`；同版本但金額不符回 `PRICE_CLIENT_MISMATCH`。API 不接受或信任呼叫端傳入的 Spreadsheet ID、Booking ID、房間分配、Booking／付款狀態或金額；永遠只保存後端重算金額。未來 `booking.js` 接線仍屬 TASK-008。

所有讀寫只可使用 Apps Script Script Property `LITTLELAND_TEST_SPREADSHEET_ID` 指定的 spreadsheet，並再次驗證名稱精確為 `LittleLand_TEST`；缺少或不符即 fail-closed，不提供 Production fallback，不允許 API request 指定其他 Spreadsheet。使用者已核准本次只交付 Apps Script source 與 mock tests；不寫入任何 Google Sheet row、不建立 Apps Script 專案或 Web App、不部署、不提供 API URL。任何未來實表測試或部署都須另行明確授權。

## V3.0 執行規則

- 建單順序遵守 `Validate → Check Idempotency Key → Acquire Script Lock → Backend Price Recalculation → Read Latest Inventory → Check Availability Again → Allocate Physical Rooms → Create Booking ID → Save → Log → Clear Cache → Release Lock`。使用 `LockService.getScriptLock()`；lock 取得後必須再查一次 Idempotency key。正式提交不信任任何 Cache；本實作不設 availability cache，因此寫入後清 cache 為 no-op。任何必要步驟失敗都不能回報成功。
- 日期必須是有效 `YYYY-MM-DD`；入住不可早於香港當日，退房必須晚於入住；計晚數按本地日曆、入住日含退房日不含；前台時段為 14:30–15:30、15:30–16:30、16:30–17:00；提早入住及 17:00 後延遲退房均按 Pricing Engine 一次 HK$200 服務處理。
- 後端重用已驗收房價、物種房型上限及服務費公式，並鏡像測試確保 GAS `PricingEngine.gs` 與 `booking/pricing.js` 輸出一致。訂金 `baseRoomFee * 0.5`，不可按住宿總額計；`cashDeposit = quantity * 1000`，不納入估算住宿總額／訂金／尾數。週末費只按入住日星期五／六／日且一晚收 HK$250。保存 `roomPrice`、`priceVersion`、`policyVersion`、`roomRuleVersion` 及所有價格 snapshot；建議 `priceVersion` 用已驗收 TASK-002 commit SHA，另外兩個 version 標為 `V3.0`。
- 後端寵物規則以最新已接受的前台修訂為準：兔子最低 3 個月、天竺鼠最低 3 個月、倉鼠最低 2 個月；最近手術為 30 日；而不是較舊 V3.0 文字中的 1／1／7 天值。寵物數須為整數、至少 1 並符合 `pricing.js` 物種／房型上限，寵物資料列數須與數量一致。必填項及年齡月數轉換沿用前台；兔／天竺鼠按前台顯示絕育／懷孕／杜蝨欄，倉鼠不要求或保存懷孕、絕育、杜蝨及餵食次數／假期提醒。懷孕中（非倉鼠）及最近 30 日手術回 V3.0 對應錯誤，不建立預約；健康看獸醫／傳染病／慢性病／服藥等「是」須有詳情，並以 `Pets.healthReviewStatus=HEALTH_REVIEW_REQUIRED` 標記。
- 聯絡必填家長姓名、香港 8 位電話、Email 及兩位緊急聯絡人；指定獸醫／診所選填。六項 consent 必須全數 `true`，同意時間由伺服器記錄。飲食欄位按物種／已接受前台選項驗證；倉鼠不帶餵食頻率／假期提醒。梳毛與餵藥選項轉成官方 service IDs；每日餵藥 1 次與 2 次互斥。
- 房態佔用只計 `PENDING_DEPOSIT`、`CONFIRMED`、`CHECKED_IN`；`PENDING_CONFIRMATION`、`CANCELLED`、`CHECKED_OUT`、`COMPLETED` 不佔房。`PENDING_DEPOSIT` 沒有付款期限、不倒數、不自動取消／釋放。日期重疊 iff `newCheckout > existingCheckin && newCheckin < existingCheckout`。實體房只有 S1/S2/S3、A1/A2/A3、B1/B2、C1、F1；SS1 只能 S1+S2→S2+S3，禁止 S1+S3；SSR1 固定 S1+S2+S3；其他房型依 V3.0 順序。分配及儲存只用底層實體 ID，任何未知／虛擬分配均回 `ROOM_INVALID_ALLOCATION` 並 fail-closed；無可用房只回客人 `available=false`，不洩露房號、Booking ID、其他客人、hold 或原因；API／Sheet 錯誤不能顯示可預訂。
- 新建 Booking 採 `PENDING_CONFIRMATION`；依 V3.0 此狀態不佔房，分配僅為該申請的暫定配置，不代表保留。此後員工移至 `PENDING_DEPOSIT`／`CONFIRMED` 前仍須由後續員工流程重新驗證及分配；本部分不建立員工後台。每筆 Booking ID 用 `TEST-LL-<香港日期>-<UUID 短碼>`，絕不以 Sheet row number 為 ID。寫入一筆 `Bookings`、每隻一筆 `Pets`、一筆不含不必要 PII 的 `Logs` 及一筆 `IdempotencyKeys`；不建立 `Payments` 列，初始 `depositStatus=UNPAID`、`balanceStatus=UNPAID`、`cashDepositStatus=NOT_COLLECTED`。Booking 保存六項 consent、後端價格 snapshot、實體房 allocation JSON 與 health-review 標記。
- `IdempotencyKeys` 使用 `PROCESSING`、`COMPLETED`、`FAILED` 作技術狀態（不是 Booking Status），不設 TTL／不自動刪除。相同 key、operation、payload hash 的已完成請求回放保存的精簡 response snapshot，絕不再次新增 Booking／Pets／Logs／房間分配；相同 key 但 payload 不同回 `DUPLICATE_REQUEST`；lock 超時回 `LOCK_TIMEOUT`。response snapshot 不存原始 request 或不必要個人資料。Sheets 多分頁寫入不是資料庫交易：若寫入中途失敗，須保留 `PROCESSING`／穩定 Booking ID、回錯誤不報成功，重送不得再造第二份；不自動清除或猜測修復，交由人工 reconciliation。
- 成功回應只顯示 `Booking ID`、`PENDING_CONFIRMATION` 申請狀態與計價摘要，不稱房間正式確認、不返回實體房 ID。失敗回應使用 V3.0 `{success:false, code, message, requestId, timestamp, retryable}`；前端應按 code 判斷。使用 V3.0 已定義錯誤碼，含 `VALIDATION_FAILED`、`DATE_INVALID_FORMAT`、`DATE_CHECKIN_IN_PAST`、`DATE_CHECKOUT_NOT_AFTER_CHECKIN`、寵物錯誤、房間錯誤、`PRICE_CLIENT_MISMATCH`、`PRICE_CALCULATION_FAILED`、`PRICE_VERSION_EXPIRED`、`PRICE_DUPLICATE_SERVICE`、`DUPLICATE_REQUEST`、`LOCK_TIMEOUT`、`SHEET_READ_FAILED`、`SHEET_WRITE_FAILED`、`QUOTA_EXCEEDED`、`EXECUTION_TIMEOUT`、`SYSTEM_UNAVAILABLE`、`INTERNAL_ERROR`；任何 API 失敗均不得回成功。

## 已確認的規格解讀

使用者已確認：最近看獸醫、傳染病、慢性病、服藥等需人工覆核狀況，只要詳情齊全即可提交；建立 `PENDING_CONFIRMATION` 並把相應 Pets 標為 `HEALTH_REVIEW_REQUIRED`，不代表批准入住，也不回 `PET_HEALTH_REVIEW_REQUIRED` 拒絕。V3.0 的 `PENDING_CONFIRMATION` 不佔房；暫定 allocation 不構成保留，後續員工確認前須重新檢查房態。

## 使用者已核准的外部界線

只交付 repository 中的 Apps Script source 與 mock tests；不寫入 `LittleLand_TEST`、不建立任何 TEST 預約資料、不建立或部署 Apps Script Web App、沒有 API URL。任何未來實表測試或部署都需要新的明確確認；不得以本次授權為依據執行。



> 範圍補充：後端資料／商業規則驗證是 Create Booking API 必需功能，屬本部分；不代表重啟 TASK-003 Frontend Validation。本部分不改客人前台、不做 Staff Authentication／Dashboard、付款 API／支付服務、TASK-008 前台接線或 Production。


## TEST Apps Script 專案綁定檢查點（2026-10-30）

使用者後續明確授權建立 TEST Apps Script 專案及設定 target。已在登入的 LittleLand Google 帳戶中建立綁定至唯一 `LittleLand_TEST` 試算表的 Apps Script 專案，將 `LITTLELAND_TEST_SPREADSHEET_ID` 設為已核實的 TEST spreadsheet ID，並重新載入設定頁確認保存值仍存在。Spreadsheet ID 不寫入 repository。這是後續整合前的設定準備，不改變 TASK-005／006／007 只交付 code + mock tests 的範圍；尚未上傳 LittleLand 程式碼、執行 initializer／API、寫入任何 Sheets row、建立 Web App deployment 或產生 API URL。任何程式碼上傳、實表測試與部署均留待後續使用者明確指示。
