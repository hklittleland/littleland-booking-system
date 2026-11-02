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
- 房態只將 `CONFIRMED`、`CHECKED_IN` 視為佔房；`PENDING_CONFIRMATION`、`PENDING_DEPOSIT`、`CANCELLED`、`CHECKED_OUT`、`COMPLETED` 不佔房。`PENDING_DEPOSIT` 不設期限、不倒數、不自動取消或釋放；撞期只由房態回覆不可用，員工跟進留待後台功能處理。
- 日期區間使用入住日含、退房日不含；與既有訂單重疊 iff `newCheckout > existingCheckin && newCheckin < existingCheckout`。同日退房／下一位入住不視為重疊。日期格式／日期順序無效時回應 V3.0 穩定錯誤碼，不讓前端把錯誤當可用。
- 實體房唯一為 S1、S2、S3、A1、A2、A3、B1、B2、C1、F1；不得將 `SS1`／`SSR1` 當額外實體房或存進實際分配欄。分配順序：獨立套房 S1→S2→S3；豪華套房 SS1 僅 S1+S2→S2+S3（禁止 S1+S3）；非常.豪華套房 SSR1 固定 S1+S2+S3；豪華房 A1→A2→A3；標準房 B1→B2；整理箱 C1；自備籠 F1。已佔用的實體 ID 會同時阻止任何重疊的虛擬組合。無房時客人端只收到 `available=false`；Create Booking 不分配物理房，allocation 僅在未來受控的 `CONFIRMED` transition 內部使用。佔房 Booking 缺少／含未知／虛擬房 ID 的 allocation 時 fail-closed，回傳 V3.0 房間完整性錯誤，不猜測或釋放房間。
- `apps-script/IdempotencyService.gs`：提供以穩定呼叫端 `idempotencyKey`、操作名稱、canonical payload hash 及 callback 執行的 helper。使用 `LockService.getScriptLock()` 防止同一 Script 的併發重複執行；取得 lock 後重新查 key，以涵蓋 lock 前的競態。完全相同 key／operation／payload 若已完成，回放已保存 response snapshot 且 callback 不再執行；相同 key 搭配不同 operation 或 payload 回 `DUPLICATE_REQUEST`，不可建立第二結果；仍是 `PROCESSING` 的 key 不重新執行 callback，採 fail-closed／retryable duplicate 回應，交由後續人工 reconciliation，不自動清除。Lock 逾時使用既有 `LOCK_TIMEOUT` 並標記可重試。
- `IdempotencyKeys.state` 在 V3.0 未指定狀態詞彙，建議只作技術狀態使用：`PROCESSING`、`COMPLETED`、`FAILED`，不可混作 `bookingStatus`。明確失敗須保存精簡、可重播的結果；不保存原始 payload／不必要個人資料，只保存既有 `payloadHash` 及精簡 `responseSnapshotJson`。V3.0 未定義 key 保留期限，故不設定 TTL、不自動刪除／重設 key。Create Booking 在同一 lock 範圍依序重新驗證、重算價格、讀取最新房態、建立 ID 並保存 `PENDING_CONFIRMATION`（空 allocation）、寫 Logs，再完成 Idempotency 記錄；未來 `PENDING_DEPOSIT → CONFIRMED` transition 須在 lock 內重查房態並配置實體房，本階段不建立 Staff API。
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

- Create Booking 順序遵守 `Validate → Check Idempotency Key → Acquire Script Lock → Backend Price Recalculation → Read Latest Inventory → Check Current Availability → Create Booking ID → Save PENDING_CONFIRMATION with allocatedRoomIdsJson=[] → Log → Clear Cache → Release Lock`。使用 `LockService.getScriptLock()`；lock 取得後必須再查一次 Idempotency key。正式提交不信任任何 Cache；本實作不設 availability cache，因此寫入後清 cache 為 no-op。任何必要步驟失敗都不能回報成功。員工在日後確認已收訂金、準備轉 `CONFIRMED` 時，須另在鎖內重查最新房態並於同一更新中分配房間／改狀態；本階段不建 staff transition。
- 日期必須是有效 `YYYY-MM-DD`；入住不可早於香港當日，退房必須晚於入住；計晚數按本地日曆、入住日含退房日不含；前台時段為 14:30–15:30、15:30–16:30、16:30–17:00；提早入住及 17:00 後延遲退房均按 Pricing Engine 一次 HK$200 服務處理。
- 後端重用已驗收房價、物種房型上限及服務費公式，並鏡像測試確保 GAS `PricingEngine.gs` 與 `booking/pricing.js` 輸出一致。訂金 `baseRoomFee * 0.5`，不可按住宿總額計；`cashDeposit = quantity * 1000`，不納入估算住宿總額／訂金／尾數。週末費只按入住日星期五／六／日且一晚收 HK$250。保存 `roomPrice`、`priceVersion`、`policyVersion`、`roomRuleVersion` 及所有價格 snapshot；建議 `priceVersion` 用已驗收 TASK-002 commit SHA，另外兩個 version 標為 `V3.0`。
- 後端寵物規則以最新已接受的前台修訂為準：兔子最低 3 個月、天竺鼠最低 3 個月、倉鼠最低 2 個月；最近手術為 30 日；而不是較舊 V3.0 文字中的 1／1／7 天值。寵物數須為整數、至少 1 並符合 `pricing.js` 物種／房型上限，寵物資料列數須與數量一致。必填項及年齡月數轉換沿用前台；兔／天竺鼠按前台顯示絕育／懷孕／杜蝨欄，倉鼠不要求或保存懷孕、絕育、杜蝨及餵食次數／假期提醒。懷孕中（非倉鼠）及最近 30 日手術回 V3.0 對應錯誤，不建立預約；健康看獸醫／傳染病／慢性病／服藥等「是」須有詳情，並以 `Pets.healthReviewStatus=HEALTH_REVIEW_REQUIRED` 標記。
- 聯絡必填家長姓名、香港 8 位電話、Email 及兩位緊急聯絡人；指定獸醫／診所選填。六項 consent 必須全數 `true`，同意時間由伺服器記錄。飲食欄位按物種／已接受前台選項驗證；倉鼠不帶餵食頻率／假期提醒。梳毛與餵藥選項轉成官方 service IDs；每日餵藥 1 次與 2 次互斥。
- 房態佔用只計 `CONFIRMED`、`CHECKED_IN`；`PENDING_CONFIRMATION`、`PENDING_DEPOSIT`、`CANCELLED`、`CHECKED_OUT`、`COMPLETED` 不佔房。`PENDING_DEPOSIT` 沒有付款期限、不倒數、不自動取消／釋放。日期重疊 iff `newCheckout > existingCheckin && newCheckin < existingCheckout`。實體房只有 S1/S2/S3、A1/A2/A3、B1/B2、C1、F1；SS1 只能 S1+S2→S2+S3，禁止 S1+S3；SSR1 固定 S1+S2+S3；其他房型依 V3.0 順序。分配及儲存只用底層實體 ID，任何未知／虛擬分配均回 `ROOM_INVALID_ALLOCATION` 並 fail-closed；無可用房只回客人 `available=false`，不洩露房號、Booking ID、其他客人、hold 或原因；API／Sheet 錯誤不能顯示可預訂。
- 新建 Booking 採 `PENDING_CONFIRMATION`，無實體分配，保存 `allocatedRoomIdsJson=[]`；因此同日期／房型可有多張待確認申請。每筆 Booking ID 用 `TEST-LL-<香港日期>-<UUID 短碼>`，絕不以 Sheet row number 為 ID。寫入一筆 `Bookings`、每隻一筆 `Pets`、一筆不含不必要 PII 的 `CREATE_BOOKING` `Logs` 及一筆 `IdempotencyKeys`；在已取得 Idempotency claim 後、任何 Booking／Pet 寫入前發生拒絕時，寫一筆精簡 `REJECT_BOOKING` Log（僅錯誤碼與 request ID，不存表單或個資）；相同失敗 key 重播不得重複寫 Log。不建立 `Payments` 列，初始 `depositStatus=UNPAID`、`balanceStatus=UNPAID`、`cashDepositStatus=NOT_COLLECTED`。Booking 保存六項 consent、後端價格 snapshot、空 allocation JSON 與 health-review 標記。
- `IdempotencyKeys` 使用 `PROCESSING`、`COMPLETED`、`FAILED` 作技術狀態（不是 Booking Status），不設 TTL／不自動刪除。相同 key、operation、payload hash 的已完成請求回放保存的精簡 response snapshot，絕不再次新增 Booking／Pets／Logs／房間分配；相同 key 但 payload 不同回 `DUPLICATE_REQUEST`；lock 超時回 `LOCK_TIMEOUT`。response snapshot 不存原始 request 或不必要個人資料。Sheets 多分頁寫入不是資料庫交易：若寫入中途失敗，須保留 `PROCESSING`／穩定 Booking ID、回錯誤不報成功，重送不得再造第二份；不自動清除或猜測修復，交由人工 reconciliation。
- 成功回應只顯示 `Booking ID`、`PENDING_CONFIRMATION` 申請狀態與計價摘要，不稱房間正式確認、不返回實體房 ID。失敗回應使用 V3.0 `{success:false, code, message, requestId, timestamp, retryable}`；前端應按 code 判斷。使用 V3.0 已定義錯誤碼，含 `VALIDATION_FAILED`、`DATE_INVALID_FORMAT`、`DATE_CHECKIN_IN_PAST`、`DATE_CHECKOUT_NOT_AFTER_CHECKIN`、寵物錯誤、房間錯誤、`PRICE_CLIENT_MISMATCH`、`PRICE_CALCULATION_FAILED`、`PRICE_VERSION_EXPIRED`、`PRICE_DUPLICATE_SERVICE`、`DUPLICATE_REQUEST`、`LOCK_TIMEOUT`、`SHEET_READ_FAILED`、`SHEET_WRITE_FAILED`、`QUOTA_EXCEEDED`、`EXECUTION_TIMEOUT`、`SYSTEM_UNAVAILABLE`、`INTERNAL_ERROR`；任何 API 失敗均不得回成功。

## 已確認的規格解讀

使用者已確認：最近看獸醫、傳染病、慢性病、服藥等需人工覆核狀況，只要詳情齊全即可提交；建立 `PENDING_CONFIRMATION` 並把相應 Pets 標為 `HEALTH_REVIEW_REQUIRED`，不代表批准入住，也不回 `PET_HEALTH_REVIEW_REQUIRED` 拒絕。只有 `CONFIRMED`、`CHECKED_IN` 佔房；`PENDING_CONFIRMATION`、`PENDING_DEPOSIT` 都不佔房，且均不分配實體房。員工收訂金並準備確認前須鎖內重查房態。

## 使用者已核准的外部界線

原始 TASK-005／006／007 僅授權交付 repository source 與 mock tests；使用者其後另行明確授權建立／部署 TEST Web App、接線前台及將合成 TEST Booking 寫入 `LittleLand_TEST`，故可按該新授權進行本 TEST 壓力驗收。所有資料只限 TEST；不得使用 Production、不得開始 Staff Dashboard／confirmation API、不得 merge `main`。



> 範圍補充：後端資料／商業規則驗證是 Create Booking API 必需功能，屬本部分；不代表重啟 TASK-003 Frontend Validation。本部分不改客人前台、不做 Staff Authentication／Dashboard、付款 API／支付服務、TASK-008 前台接線或 Production。


## TEST Apps Script 專案綁定檢查點（2026-10-30）

使用者後續明確授權建立 TEST Apps Script 專案及設定 target。已在登入的 LittleLand Google 帳戶中建立綁定至唯一 `LittleLand_TEST` 試算表的 Apps Script 專案，將 `LITTLELAND_TEST_SPREADSHEET_ID` 設為已核實的 TEST spreadsheet ID，並重新載入設定頁確認保存值仍存在。Spreadsheet ID 不寫入 repository。這是後續整合前的設定準備，不改變 TASK-005／006／007 只交付 code + mock tests 的範圍；尚未上傳 LittleLand 程式碼、執行 initializer／API、寫入任何 Sheets row、建立 Web App deployment 或產生 API URL。任何程式碼上傳、實表測試與部署均留待後續使用者明確指示。


# TASK-008 — Guest Booking ↔ TEST API Integration

## 目標與範圍

只把已接受的 `booking/` 前台接至已部署的 Apps Script TEST API。不可重新設計或改動既有視覺；保留目前流程、計價摘要及手機版樣式，僅在原有房態徽章、表單錯誤提示及完成頁位置呈現真實 API 狀態。只用目前部署文件記錄的公開 TEST endpoint 和 `LittleLand_TEST`；不呼叫 Production、不建立 Staff Dashboard、不合併 `main`。

## 實作決定

- 新增 `booking/api-client.js` 作為瀏覽器／Node 可共用的無相依 API adapter；固定呼叫部署紀錄內的 TEST URL，不接受使用者輸入 Spreadsheet ID。Availability 使用 `GET ?action=availability&checkin&checkout&species&roomTypeId&quantity`，只讀 envelope 的 `success/code/data.available`，並以 `available` 布林值映射為「可預訂／不可預訂／查詢中／暫時無法確認」，不在 UI 暴露房間 ID、客人或內部原因。日期或寵物種類／房型改動會使舊房態失效；進入房型步驟時依有效日期及所選物種查詢該物種可選房型。
- Create Booking POST 傳 `{idempotencyKey, form, terms, clientQuote}`。使用 `text/plain;charset=utf-8` 傳 JSON，避免跨來源 JSON preflight；以伺服器回覆為準。Quote 必須帶 TASK-002 SHA `6f002fd9ea921c313ecf90502091f1de051f332c` 及引擎的完整費用欄位。防重 key 僅留在記憶體，同一份 payload 重試重用 key，資料變更則更新 key。只有 `success:true`、`code:"OK"`、符合有效格式的真實 TEST Booking ID、`bookingStatus:"PENDING_CONFIRMATION"` 及伺服器費用摘要都驗證成功後，才清除草稿及顯示「已收到您的預約申請」；完成頁使用真實 ID、房型、日期、寵物和伺服器回傳住宿總額／訂金／尾數／現金按金。
- 提交期間停用提交按鈕。若回 `ROOM_NO_LONGER_AVAILABLE`，不得顯示成功；返回房型步驟，顯示通用房態，並以新 query token 重新查詢所選物種的可選房型。其他 API／網路錯誤、無效 JSON/envelope、缺失或無效 Booking ID 均保留表單資料／草稿及重試能力，不生成假 Booking ID、不清除草稿。
- 實測 Sheets-backed Create Booking 可能超過原 25 秒 timeout；adapter 設為 60 秒等待上限。任何 timeout 後仍以同一 payload fingerprint 重用同一 idempotency key，避免盲目建立重複申請；較長等待期間提交按鈕保持停用。
- 在 `tests/booking-api-client.test.js` 使用 Node 內建測試和 fake `fetch` 檢查 query／POST schema／simple content type、V3.0 envelope、有效 Booking ID 檢核、網路失敗及安全錯誤碼。最後以合成 TEST 客資料經預覽前台→已部署 TEST API→`LittleLand_TEST` 完成一張預約，回查 Booking／Pets／Logs／IdempotencyKeys 寫入及 ID；錯誤流程以不寫入資料的 fake/network/無效請求測試。

## 專案結構與版本控制

- `booking/api-client.js`：純 JavaScript TEST API adapter 與 response validation；不存放 secrets。
- `booking/booking.js`：沿用現有流程及 UI，接上房態查詢、async submit、重試狀態及真實完成摘要。
- `booking/index.html`：僅按 script 順序載入 adapter；不改版面／文案結構。
- `tests/booking-api-client.test.js`：API adapter mock fetch 測試。
- `manus-routes.json`：宣告靜態網站唯一路由 `/booking/`。
- `TODO.md`、`docs/TEST-API-DEPLOYMENT.md`：記錄驗收狀態及已部署 TEST URL／安全界線，不保存 Spreadsheet ID。

此次對公開的 TEST endpoint 送出 1 張純合成預約資料是使用者明確要求的驗收範圍；不輸入真實客人資料。所有測試寫入僅限 allow-listed `LittleLand_TEST`。完成後提交及推送至 `hklittleland/littleland-booking-system` 的 `feature/test-booking-api`；不得推送 `main`、不得 merge。


## 2026-10-31 房態業務規則更正（優先於本文較早版本）

只有 `CONFIRMED`、`CHECKED_IN` 佔房；`PENDING_CONFIRMATION`、`PENDING_DEPOSIT`、`CANCELLED`、`CHECKED_OUT`、`COMPLETED` 都不佔房。Create Booking 產生 `PENDING_CONFIRMATION` 時不分配、不保留實體房，`allocatedRoomIdsJson=[]`；同日期同房型可以有多張待確認申請。

員工確認已收訂金並準備轉成 `CONFIRMED` 時，必須在同一鎖範圍讀取最新房態、檢查半開入住區間、選取合法實體房並一併更新狀態及 allocation；只有此步成功後才正式佔房。較早的 TASK-005／007 草稿若表示 `PENDING_DEPOSIT` 佔房或 Create Booking 進行實體房分配，均由本更正取代。本階段不實作 Staff Dashboard／確認 API，因此不能聲稱已對 live confirmation race 作 E2E 驗收。

房態測試須區分「Create Booking 的待確認申請」和「確認時的實體 allocation」：A 的重疊待確認申請可並存但皆無 allocation；B–F 以測試用 `CONFIRMED`／`CHECKED_IN` inventory fixtures 驗證組合及半開日期；G 以同 key 回放驗證不重複建立；H 在現有 Create Booking endpoint 上可驗證平行提交皆維持待確認且無 allocation，只有未來 `PENDING_DEPOSIT → CONFIRMED` transaction 才能驗證單一勝出。


# LittleLand Staff Web V1 — 完整實作提案（待使用者核准）

## 目標、範圍及現況

本提案對應使用者 2026-10-31 附件的完整 Staff Web V1；一次交付可在手機及電腦預覽、登入後操作的後台初版，不拆成多個使用者 TASK。這是 TASK-009 後新授權的範圍，只取代歷史紀錄中「暫停 Staff Dashboard」的狀態，不回溯改寫 TASK-009 結果。保持 `/booking/`、已接受 `booking/pricing.js`、客人 API 行為與既有 V3.0 商業規則不變；只使用 `LittleLand_TEST`、TEST API 及合成資料，不讀寫 Production，不 Merge `main`。

已核實的起點：WebDev project `littleland` 目前 `server:false`、`database:false`、Preview port 3000；不需要為本方案啟用 Managed Server／Database。TEST Sheets 的 `Staff` 與 `Sessions` 目前均只有表頭、0 筆記錄；現有 TEST API 只有客人 Availability `GET` 與 guest Create Booking `POST`，尚無 Staff login 或管理 endpoints。`Bookings` 有 11 筆 TEST 記錄；現有資料先只供後台讀取，不在初始化或登入時修改。

## 建議架構與安全界線

- `/staff/` 作為獨立、mobile-first vanilla JavaScript SPA；客人 `/booking/` 所有檔案和 UI 不改。使用目前已配置的 Cloud Preview 3000，不 publish，不啟用 WebDev Server 或 Managed Database；新增簡單本機靜態開發服務（僅供 Preview）。所有瀏覽器 URL 使用相對路徑；`manus-routes.json` 同時保留 `/booking/` 並加入 `/staff/`。
- 延用現有 GAS `LittleLand_TEST Booking API` 作唯一資料服務，新增 `StaffAuth.gs`、`StaffOperations.gs` 及 API dispatcher；既有 guest action 維持原 contract。GAS 每次 read/write 先驗證 active Staff Session，再讀取敏感 Booking、Pets、Payments、Rooms、Logs；仍強制 `LITTLELAND_TEST_SPREADSHEET_ID` allow-list、試算表名稱精確為 `LittleLand_TEST` 及八表 schema。公開部署仍需支援既有客人 API，但未登入的 Staff request 不得回傳後台資料或執行操作。
- Authentication 按既有 `Staff(username,passwordHash,passwordSalt)`、`Sessions(tokenHash,expiresAt,revokedAt,...)` schema 實作 TEST-only username/password。密碼使用個人隨機 salt 及 PBKDF2-HMAC-SHA256、固定 120,000 rounds；以 pinned `@noble/hashes@2.4.0` 與 `esbuild-wasm@0.28.2` 本地 bundle 於 Apps Script V8 計算，避免每輪跨呼叫 GAS `Utilities` service；bundle 不依賴 runtime CDN/network，並以 Node `crypto.pbkdf2Sync` standard vector 核對一致性。只儲存 hash/salt，絕不保存明文、寫入 client code、URL 或 Logs。成功登入以加密安全隨機 opaque token 建立 Session；只存 token hash，8 小時到期，登出即 revoke；每個受保護 action 只檢查有效 Session、expiry、revocation 及 Staff `isActive`，不做角色分級或逐操作權限檢查。未登入、無效或過期 Session 均 fail-closed。
- Apps Script `ContentService` 不能可靠設定 `HttpOnly` cookie，因此 Staff API 僅用 `POST text/plain;charset=utf-8` 傳 JSON，token 放 request body、不放 query；瀏覽器只將暫存 token 放 `sessionStorage`，不放 `localStorage`。這是 TEST Preview 方案，不代表可用於正式客人資料／Production；任何未來 Production 使用前須改用伺服器端 HttpOnly session/proxy 或另行核准的 OAuth 架構。前端不載入未必要的第三方 JS、所有資料以安全文字節點呈現、不用不可信值作 HTML，避免 token XSS 外洩。
- TEST V1 僅建立兩個有效合成 Staff 帳號。兩人登入後一律具有完整 ADMIN 功能；不實作 `VIEWER`／`STAFF`／`ADMIN` 三層角色判斷、每操作角色檢查或重新輸入密碼。既有 `role`/`roleSnapshot` 欄位為 sheet 相容欄位，兩個 TEST 帳號均寫 `ADMIN`；程式不依該值授權。V1 不做員工 CRUD、排班或薪酬。
- 為兩個 TEST 帳號各產生獨立高熵密碼、salt 及 PBKDF2 hash，只將 hash/salt 寫入 `LittleLand_TEST.Staff`，不進 Git；完成時透過 repo 外權限受限的私有檔案提供兩組登入資料。兩位 Staff 均可查看／編輯預約、查看客人及寵物、轉待付訂金、確認訂金並按最新房態分房、記錄尾數及現金按金、入住／退房、取消、跟進，以及查看付款和基本營收。原有 11 筆 Booking 初始不因建立帳號而修改；E2E 僅使用合成 TEST 情境。

## 頁面、共同 Booking Detail 及資料顯示

- 建立 Dashboard、房間月曆、預訂、🔔 待跟進、付款、客戶、基本營收、設定／登出八個入口。全部頁面和客戶歷史都使用同一 Booking 資料模型與同一 Booking Detail 畫面／route，不複製多個 Detail 版本。
- Dashboard 顯示今日入住、今日退房、待確認、待付訂金、已確認及待跟進數字，今日時間表、近期預約及需跟進清單；所有 Booking 卡片一鍵進入共同 Detail。
- 預訂列表可搜尋 Booking ID、客人姓名／電話、寵物名稱、入住／退房日、房型及 Booking Status；可切換全部、待確認、待付訂金、已確認、已入住、已退房、已完成、已取消。狀態及房型文字須可讀，不只靠顏色。
- Booking Detail 顯示 Booking ID／狀態／提交時間／日期時間／晚數／房型／實體房分配；家長聯絡、兩位緊急聯絡人、獸醫；逐隻 Pets 的名稱／物種／品種／年齡／性別／絕育／懷孕／最近手術與就醫／傳染病／慢性疾病／藥物／特殊照顧／杜蝨及飲食；既有六種 V3.0 費用分解；付款狀態、訂金／尾數／現金按金、已用及應退；最後聯絡日期／員工、跟進備註及歷史；狀態、付款、房間、入住／退房、取消與員工操作 Logs。只對已登入 TEST Staff 顯示 PII 及健康資料。
- 房間月曆覆蓋實體房 S1/S2/S3、A1/A2/A3、B1/B2、C1、F1。桌面採整月房間矩陣；iPhone 用月份格＋選日後的房間／活動清單，避免整頁橫向捲動。每天顯示房號、毛孩圖示／名稱、入住／退房時間和狀態。空房灰、待處理橙、已確認／入住綠並同時顯示文字。只有分配過實體 ID 的 CONFIRMED／CHECKED_IN 放在實體房 lane；pending booking 不分配、不佔房，另於每日「待處理」區顯示，絕不視覺上假裝佔用。
- 客戶頁依姓名／電話／Email 搜尋，顯示聯絡方式、歷史 Booking、歷史寵物；每張歷史單連到共同 Detail。
- 付款頁集中顯示待收訂金、待收尾數、待收現金按金、待退現金按金、今日已收款；每項連到共同 Detail，不接支付 gateway。可人工記錄訂金／尾數／現金按金收取、按金使用及退款；記錄金額、日期、方法（選填）及 reference（選填），由 TEST API 驗證餘額並新增 Payments／Logs。訂金遵循 `baseRoomFee*0.5`，現金按金按 `quantity*HK$1,000`，不得改價／重算既有 snapshot，現金按金不計住宿收入。未定義的付款服務、付款期限、自动取消或自动退款均不自行建立。
- 基本營收依 TEST `Payments` 實際收款與退款的 `paidAt`／`refundedAt` 匯總本月訂金、尾數、住宿收款及房型／物種；不把可退現金按金算入住宿收入，並清楚標為 V1 營運摘要，不取代會計帳。
- 待跟進頁顯示 Booking ID、客人／電話／房型／入住日／狀態、最後聯絡時間／員工／備註；可新增 follow-up、標記已聯絡、以 `wa.me` 開啟 WhatsApp、跳 Detail。歷史使用 Logs；不自動倒數、不因待付訂金逾期取消或釋放房間。
- 設定頁顯示 TEST 環境標示、目前員工與「完整 ADMIN 權限」、Session 到期資訊及登出；不做角色切換、排班或完整員工 CRUD。保留簡單停用方式：在 TEST `Staff` 表將該帳號 `isActive=false`；每個受保護 action 都會重查此欄位，停用後既有 Session 即不可再讀寫。

## 既定 Booking 工作流及操作保護

- `PENDING_CONFIRMATION` → 員工確認資料 → `PENDING_DEPOSIT`；兩種 pending 狀態始終 `allocatedRoomIdsJson=[]` 且不佔房。同日期同房型允許多張 pending。沒有固定訂金期限，不自動倒數、取消或釋放。
- 「確認已收訂金」必須在 Script Lock 內重新讀取該 Booking、最新 `Bookings`／`Rooms` 房態，再找合法實體配置；僅在配置成功後，於受保護操作中記錄實收訂金、合法實體房 ID、`CONFIRMED`、`depositStatus=PAID`、版本更新及 Log。每一個 transition 都驗證目前狀態、`recordVersion` 及重播 key；不接受客戶端指定房號／狀態／金額。操作授權只依有效登入 Session 與 active Staff，不依角色分類。
- 佔房只限 `CONFIRMED`／`CHECKED_IN`；採入住日含、退房日不含。獨立套房用 S1／S2／S3；豪華套房只能 S1+S2 或 S2+S3，禁止 S1+S3；非常.豪華套房固定 S1+S2+S3；虛擬 SS1／SSR1 不作額外實體房。其他房依既有 RoomAvailability helper。不得修改既有房型、上限、價格或計價公式。
- 無房衝突時絕不可 `CONFIRMED`、不可分配房、不可自動取消其他 booking；保持 `PENDING_DEPOSIT`、allocation `[]`，設待跟進並顯示衝突讓員工聯絡。使用者於 2026-10-31 批准：若員工已實際收款但檢房衝突，仍記錄已收訂金 Payment，維持 `depositStatus=PAID`、Booking `PENDING_DEPOSIT` 且 allocation `[]`；不可把付款等同於房間確認，也不得自動取消。
- 其他 Detail 操作：確認資料、確認收款、記錄尾數、收／用／退現金按金、入住、退房、完成、取消、新增跟進及編輯允許的聯絡／寵物欄位。一般編輯不可改 status、價格 snapshot、付款狀態、分配欄位；所有更新仍須提示確認（若適用）、鎖內 re-read、更新 `recordVersion` 及寫 Logs，但不要求操作時再次輸入密碼、不做 role gate。取消採員工明確確認並記原因，不自動退款；`CHECKED_IN` 不允許直接退回未入住狀態。每個狀態轉換按明確 transition table fail-closed。
- Google Sheets 多表更新不是真正 ACID transaction：在做任何 payment+booking+room 分配組合寫入前，先在 mock harness 測試所有失敗階段與補償策略；任何部分寫入不確定時不回成功、不盲目重試／覆寫，保留可稽核的 request/idempotency 狀態並交員工 reconciliation。拒絕 Logs 僅寫錯誤碼／request ID，不寫客人、寵物、密碼或 token 個資。

## 視覺與互動設計

- 延用 guest `/booking/` 品牌色與字體：LittleLand 紫至粉品牌漸層（現有主紫 `#8c65d9`、深紫 `#7650c8`、粉紅 `#ee8fbd`）、白色大圓角卡片、柔和陰影，`Nunito + Noto Sans TC`；不修改客人網站任何檔案。
- Design Movement：溫柔精品寄養服務的「清楚營運台」；設計原則為資料優先、色彩輔助而非唯一訊息、手機單手可操作、敏感操作有明確確認。桌面用側欄＋內容區；手機用精簡頂欄與固定底部主導航／操作列。頁面底色白暖、品牌紫粉只用於導覽與焦點，狀態色沿用灰／橙／綠且伴隨文字／圖示；健康與付款卡片分組，不以花巧裝飾搶走資料層級。
- Signature elements：Booking 卡左側細品牌色條；「毛孩小圖示＋Booking ID」摘要標籤；需跟進的鈴鐺狀態。點任何預約卡均到同一 Detail；狀態或付款提交前顯示確認摘要；成功後顯示明確更新／Log，失敗保留表單，不製造成功畫面。尊重 `prefers-reduced-motion`，只用短淡入／狀態轉場，不做大型 Confetti 或自動播放。
- Brand Essence：LittleLand 團隊每天使用的柔和、可靠、清晰的小寵物營運工作台；個性：細心、平靜、可信。Brand Voice：簡短、直白、尊重員工與家長，例如「這張申請仍未佔用房間。」、「房態已更新，請確認收款及下一步。」Wordmark 使用品牌現有 LL／爪印語彙，不新增外部圖像或仿製標誌。

## 建議實作檔案結構與交付

- `staff/index.html`、`staff/styles.css`：登入頁、導航 shell、共用 Booking Detail 容器、響應式八區頁面。
- `staff/app.js`、`staff/router.js`、`staff/api-client.js`、`staff/store.js`：hash-based app navigation、所有頁面共用一份 booking record、TEST API 呼叫、token/session state、錯誤與 loading 狀態；API URL 僅指向現有 TEST deployment，不接受使用者傳入 URL／Spreadsheet ID。
- `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`：pin `pnpm@11.25.0`、`@noble/hashes@2.4.0` 及 `esbuild-wasm@0.28.2`；依賴不需要 lifecycle scripts。`scripts/staff-crypto-entry.mjs` 與 `scripts/build-staff-crypto.mjs` 產生可直接載入的本地 Apps Script bundle。
- `apps-script/StaffAuth.gs`、`apps-script/StaffCrypto.gs`：TEST basic login、固定 120,000-round PBKDF2 hash 驗證、Session create/validate/revoke、既有 login 限速及兩位帳號同一完整 ADMIN access；PBKDF2 bundle 不於執行時下載程式碼。
- `apps-script/StaffOperations.gs`：唯一 Staff reads/writes、dashboard/list/detail/calendar/payments/follow-up/customer/revenue 聚合、明確 Booking transition、房態 lock／allocation、audit logs、request idempotency。
- `apps-script/BookingApi.gs`：以明確 action dispatch 擴展 API，但不改 guest `availability`／Create Booking contract；認證 Staff action 必須在讀取任何敏感資料前過驗證。
- `manus-routes.json`：保留 `/booking/` 並加入 `/staff/`；不列 API 或靜態檔。
- `tests/apps-script/`：兩個有效帳號均回傳完整 ADMIN、任意 legacy `role` 不限制操作、PBKDF2 120k 跨 Node/GAS vector、login/session expiry/revocation/disabled account/unauth access，狀態 transition 與並行最後房間，Payments、follow-up、Logs、部分寫入 fail-closed；`tests/staff/`：頁面 adapter／router 及 API retry/error tests。只用 mock；不要把任何 mock credentials 寫入 production source。
- 使用者要求更新後，將 `TODO.md` Staff V1 outcome 改為兩個 synthetic TEST 帳號、完整 ADMIN 且無 role tiers/re-auth；再依序實作、執行完整 mock tests、在 TEST Sheet seed 第二個帳號、完成 live login/logout、8 頁驗證及 two-hamster conflict E2E、讀回 TEST Sheets、更新既有 TEST deployment（不新增 Production deployment）、啟動 Cloud Preview、確認 route manifest 與 mobile／desktop layout，最後只提交到 `hklittleland/littleland-booking-system` 的 `feature/test-booking-api`。不 push internal `origin`、不 merge `develop`／`main`、不 publish Production。

## 初始方案待確認事項（已由下方 user approval records 決定，保留作歷史紀錄）

1. Staff Login 建議按現有 schema 使用 TEST username/password + hashed bearer Session（Session token 暫存在 sessionStorage）；如希望改用 Manus OAuth／HttpOnly session，需另選該架構，並會涉及不可逆的 WebDev `server:true` enablement 和員工 Manus account allow-list。
2. 「員工已實收訂金但最新房態已無房」時，建議保留真實收款紀錄（新增 Payments／depositStatus=PAID），但 Booking 保持 `PENDING_DEPOSIT`、無 allocation、設 follow-up／衝突；另一選項是先不新增 Payment row，待人工處理後再入帳。必須由使用者選擇，不能由實作自行決定。
3. 初始方案曾提議建立一名合成 `TEST` Admin 帳號；後續使用者已明確修訂為建立兩名，見下方最新授權記錄。


## User approval record — Staff Web V1 (2026-10-31)

The user approved the recommended Option 1: use a TEST-only username/password account and hashed bearer session; when staff has actually received a deposit but the fresh room check finds no legal room, persist the received payment in `Payments`, keep the booking at `PENDING_DEPOSIT` with `allocatedRoomIdsJson=[]`, show an explicit room-conflict/follow-up warning, and do not auto-cancel or falsely confirm it. This approval resolves open questions 1 and 2 above.

The original approval specified one synthetic TEST Admin account; that count is superseded by the user's later explicit amendment below. The TEST-only environment, hashed credentials, approved paid-deposit conflict behavior, no-Production, no-merge, and no-internal-origin restrictions remain in force.

## User amendment — flat Staff access model (2026-10-31)

The user explicitly requested two active TEST Staff accounts. Both have the same complete ADMIN access after basic username/password login; there are no VIEWER/STAFF/ADMIN tiers, role-based action gates, or per-operation password re-authentication. Preserve unauthenticated data denial, 120,000-round password hashing, expiring/revocable sessions, account deactivation, audit Logs, and strict TEST/Production separation. Deliver both TEST credentials privately outside GitHub; do not merge `main`.


## Staff UX follow-up — performance, calendar, status and time (2026-11-01)

This is an incremental correction to the already accepted Staff Web V1; it does not redesign the guest booking website or change booking, pricing, payment, room allocation, authentication, or role rules.

- **Data performance:** Reduce redundant Apps Script spreadsheet opens/schema validations within one API request using a request-scoped Spreadsheet handle that is reset at each `doPost`; load only the tables required by each read action and lazy-load inventory conflict data only when needed. If a short client navigation cache is retained, it must be in-memory only, limited to a few seconds, cleared after successful mutations/logout, and must never be used by deposit confirmation or room allocation. The server must keep the existing lock, fresh room-state recheck, TEST spreadsheet allow-list, authentication, and fail-closed behavior.
- **Calendar dates:** At the Staff read boundary, normalize Google Sheets `Date` values and ISO timestamps to Hong Kong `YYYY-MM-DD` using the existing date helper before filtering or returning records. Calendar must render the saved TEST bookings, including their check-in day, while checkout date remains excluded from overnight occupancy. Do not loosen Guest API input validation.
- **Payment/follow-up colors:** Render unpaid `PENDING_DEPOSIT` as a red “待收訂金／需跟進” state; show a green “已收訂金” badge only when a valid paid-deposit status is present. Show room-conflict/follow-up as a separate red state even when payment is green; never infer or alter a business status from color.
- **Time display:** Present clock times as `HH:mm`; present timestamp fields as local Hong Kong date plus `HH:mm` where the date is relevant. Do not show seconds, raw UTC offsets, or long timezone diagnostics in normal Staff views.
- **TEST fixture display data:** Use only wholly fictional people/pet names and conspicuously non-callable `TEST-####` contact placeholders. Never search for, invent, or write a real person's contact information. If enriching current `LittleLand_TEST` rows, change only synthetic display/contact/pet-name fields through Staff operations; preserve Booking IDs, dates, quantities, pricing, payment amounts/statuses, room allocation and follow-up/business states. No booking rows need to be created solely to mask a calendar bug.
- **Serving boundary:** Keep the current staff-only external TEST preview and existing TEST Apps Script Web App. If a backend fix is required, update only the existing TEST deployment; do not publish Production, touch `/booking/`, merge `develop`/`main`, or push the internal Manus `origin`.


# LittleLand Staff V3 — Desktop, Calendar, Operations and Brand Extension

**Status: User-approved on 2026-11-01; implementation may proceed in TEST only.** This plan extends the accepted Staff Web V1 and its TEST v9 fixes. It does not replace accepted pricing, room-allocation, authentication or TEST-only boundaries except for the explicitly approved manual-refund capability.

## Goal and scope

Implement the full new-function scope in `LittleLand_後台指令_V3.md`, plus the user-confirmed usability requests: a more integrated desktop layout; a larger room calendar with a clear “今日” reminder; each day’s arrivals, departures and in-house animals summarized by physical room, species icon and pet name; richer selected-day details on desktop; and the supplied LittleLand logo in suitable positions on both `/booking/` and `/staff/`. Keep the existing mobile-first behavior and avoid horizontal scrolling at 390px.

The V3 modules are: overview/dashboard; room calendar; searchable/sortable bookings and next-seven-day arrivals/departures; shared Booking Detail with approved actions and history; customer search/history; annual and monthly revenue analysis; staff-created bookings; and staff schedules including rest days, monthly duty counts, swaps and a calendar view. Existing TEST credentials remain two flat ADMIN accounts. No Production connection, no `main` merge, no SMS/payment gateway, and no new third-party frontend framework.

## Preserved rules and safe interpretations

- The latest accepted booking lifecycle takes precedence over the older V3 state diagram: `PENDING_CONFIRMATION → PENDING_DEPOSIT → CONFIRMED → CHECKED_IN → CHECKED_OUT → COMPLETED`, with cancellation handled only through the existing allowed transition. `PENDING_CONFIRMATION` and `PENDING_DEPOSIT` do not occupy or allocate a physical room. Only `CONFIRMED` and `CHECKED_IN` occupy. When confirming a paid deposit, the TEST API must lock, reread current inventory, validate a legal physical room, and only then atomically attempt the status/allocation change; a conflict remains visible for staff follow-up and never auto-cancels another booking.
- Reuse `booking/pricing.js` unchanged as the canonical price engine. Preserve base-room fee, extra-pet fee, weekend fee, service fees, 50%-of-base-room-fee deposit, remaining-balance and separate `qty × HK$1,000` cash deposit rules. Cash deposit is not accommodation income. No new automatic refund or silent repricing is introduced.
- Preserve the actual TEST room inventory and existing room-allocation algorithm as the operational source of truth. The existing configuration uses physical `S1–S3`, `A1–A3`, `B1–B2`, `C1`, `F1` (10 rooms); the V3 text instead names `F1–F2` and omits `C1`. This plan does not rename, add or delete physical rooms. The UI will show real configured IDs only; suites remain virtual combinations and never appear as separate physical rooms.
- Short Booking reference is display-only: derive an approximately 8-character reference from the UUID suffix and ensure new suffixes are unique against existing bookings. Show it in guest completion, staff lists/details and WhatsApp drafts where helpful. Keep the complete `TEST-LL-YYYYMMDD-XXXXXXXX` Booking ID as the API/database key; do not migrate, truncate or replace existing IDs.
- Current guest booking does not identify a returning customer or prefill a form. Staff customer records must be grouped only by a normalized Hong Kong phone number (ignore formatting and an optional `852` prefix); do not merge customers by name or Email. Staff customer search is by phone number and returns all bookings with that same normalized phone; if a booking has no phone, keep it separate rather than guessing a match. There is no standalone `Customers` sheet or guest account. The user explicitly does not want guest auto-fill; phone-only lookup is never exposed on the public booking page.
- The user explicitly approved manual deposit refunds. A Staff ADMIN may enter an exact refund amount and reason; require confirmation, verify the amount does not exceed the actual paid-but-not-yet-refunded amount for the selected payment category, append the refund transaction/adjustment and audit Log, and use idempotency protection. No refund amount is auto-calculated and no bank/payment gateway is called. This is a manual staff decision and does not change the guest-facing non-refundable-deposit terms by default; no accepted quote or Pricing Engine formula is silently recalculated.
- For revenue charts, distinguish “預訂住宿金額” (current approved accommodation quote, grouped by check-in month and shown separately from collected cash) from “實際收款” (paid DEPOSIT/BALANCE transactions by paid date, net of explicitly recorded refunds). Exclude cash deposits from accommodation revenue and label both bases clearly. Do not represent projected bookings as cash revenue. Use TEST sheet data only.
- Calendar starts Sunday, highlights the Hong Kong “今日” date, includes all dates in a month (use a sixth row when required rather than hide dates), and has a one-tap Today control. Each desktop cell shows compact room/species/pet-name event chips, green check-in time, red checkout reminder and orange non-occupying follow-up/pending summary. A selected-day detail panel shows every item, pet/species, configured room or virtual suite label, time, booking status, staff on duty and a link to the shared detail page. On iPhone, retain a compact month grid and show the full selected-day list below/in a sheet. Species symbols follow the user's preference: `🐰` rabbit, `🐽` guinea pig and `🐹` hamster. Unallocated pending bookings are not drawn as occupying a room.

## Implementation approach and integration

1. Refine the shared responsive Staff shell for desktop operations: persistent desktop navigation, clear page title/search/actions, content width suited to desktop, while keeping the 390px mobile navigation and touch targets. Add the provided logo without redrawing it; preserve aspect ratio and use appropriately sized responsive variants in the guest booking header, Staff login and Staff navigation.
2. Build the calendar as a reusable renderer fed by the existing TEST calendar API plus an authenticated schedule endpoint. Perform date normalization and all grouping in Hong Kong local dates. Render arrivals, departures, confirmed in-house pets, pending/conflict reminders and daily staff schedule as separate categories; expose complete details on selecting a date.
3. Expand booking search/sort and next-seven-day lists; add shared Detail links and only the valid state-transition actions. Add supported WhatsApp templates as drafts/links only; never send a message automatically. The short reference is for display, while every API mutation continues to use the full Booking ID and idempotency key.
4. Add staff-created booking UI and an authenticated TEST API action using the existing canonical pricing/validation logic. Creation remains `PENDING_CONFIRMATION` with no allocation. Room choice can be reviewed as a preference; actual physical allocation is accepted only by the existing locked confirmation transaction after a fresh availability check. Multi-pet data, pet limits, health-review flag and consent/price snapshots continue to use existing validation.
5. Complete customer search/history from existing bookings using normalized Hong Kong phone as the sole grouping key; search by phone only, and return every booking with the same normalized phone. Do not merge solely by name or Email, and do not create a guest account or expose returned-customer information on the public booking page. Show species, pet count and links to historical bookings.
6. Add year/month revenue views using real `Payments` and Booking snapshots. Separate accommodation quote amounts, deposits, balances, approved refunds and cash deposits. Show room-type/species breakdowns and trend lines with labels and accessible tabular summaries; do not use generated or fake operational data.
7. Add staff schedule management for the two active TEST admins. Use a TEST-only `StaffSchedules` table with one date/staff entry per day, `WORK`/`REST`, optional shift times, swap source/target, note, actor and timestamps. Validate that a rest-day entry cannot also be scheduled for work, that only active TEST staff can be assigned, and that swaps are auditable and serialized with a lock. Monthly duty counts are derived from saved schedule entries; an unassigned day is explicitly labelled “未排班”.
8. Implement fee/refund actions as separately auditable TEST `BookingAdjustments` entries without overwriting original pricing snapshots. The user approved manual refunds, including deposits: require a staff-entered amount and reason, display a clear confirmation, prevent refunds above actual collected minus already returned in the selected payment category, record actor/time and a unique idempotency key, and append a matching `Payments` refund transaction only when staff confirms the refund was actually made outside the system. Do not auto-calculate refund values, call any gateway, silently reprice, or change the public non-refundable-deposit terms. Manual surcharges require a description and amount, remain separate from the original price snapshot, and must be accounted for in the remaining amount due.
9. Extend the Apps Script TEST schema initializer/migration additively for any approved new schedule/adjustment sheet. It must be idempotent, preserve every existing TEST row, and fail closed if spreadsheet name/ID is not the allow-listed `LittleLand_TEST`. No Production sheet or deployment is inspected or changed.
10. Add modular frontend helpers for calendar grouping, short-reference formatting, revenue display and schedules; keep Apps Script endpoints in the current authenticated Staff API dispatcher. Continue using the existing lazy-read/request-scoped spreadsheet-handle optimization and invalidate in-memory page caches after successful mutation; deposit confirmation always bypasses stale cache.

## Project structure

- `assets/brand/littleland-logo.png`: versioned, unaltered user-supplied logo asset for GitHub/source portability.
- `booking/index.html`, `booking/styles.css`, `booking/booking.js`: existing guest booking site; only add the logo and display-only short Booking reference on the existing success page. No UI redesign or booking flow changes beyond those requested.
- `staff/index.html`, `staff/app.js`, `staff/styles.css`, `staff/router.js`, `staff/store.js`, `staff/api-client.js`: responsive shell, routes, pages, shared detail and TEST API actions.
- `staff/calendar-view.js`, `staff/booking-reference.js`, `staff/revenue-view.js`, `staff/schedule-view.js`: focused presentation/formatting modules where this reduces the existing app's coupling.
- `apps-script/StaffOperations.gs`: authenticated booking/customer/calendar/revenue/list/detail operations and permitted transitions.
- `apps-script/StaffScheduleApi.gs`: schedule read/write validation, rest-day conflicts, swaps and audit logging.
- `apps-script/BookingAdjustments.gs`: only if the refund decision is approved; append-only manual adjustments and reconciliation.
- `apps-script/TestSpreadsheetAccess.gs`: additive TEST-only sheet definitions/handles; no Production fallback.
- `tests/apps-script/`, `tests/staff/`: deterministic mock/regression coverage for API rules, schedule/rest/swap conflicts, uniqueness/display IDs, calendar date grouping, revenue basis and UI form serialization. TEST live checks must use synthetic data and verify final Sheets read-back.
- `TODO.md` and `docs/TEST-API-DEPLOYMENT.md`: full acceptance clauses, TEST deployment/version and implementation status; never include spreadsheet IDs, passwords or session tokens.

## Design system

- **Design Movement:** calm boutique-hospitality operations desk, based on the existing LittleLand guest-site identity.
- **Core Principles:** find the next action quickly; show room occupancy truthfully; keep red/green states explicit in text as well as color; keep common desktop work dense but mobile touch controls comfortable.
- **Color Philosophy:** retain the soft lavender-to-pink brand gradient and white rounded surfaces; use green for confirmed/paid/in-house, red for overdue/unpaid/check-out reminder, orange for pending/follow-up, gray for vacant, and a distinct blue outline for today. Colors always pair with a text label/icon; never imply a transition by color alone.
- **Layout Paradigm:** desktop left navigation with a wide workspace and large month calendar; selected date opens a side detail panel. Mobile remains a narrow single-column calendar with selected-day event list and no horizontal scroll.
- **Signature Elements:** supplied LittleLand animal logo; room chip paired with pet species icon/name; blue “今日” outline and compact check-in/check-out ribbons.
- **Interaction Philosophy:** one click from any booking summary to the same detail; one click from today to today's events; ask for explicit confirmation before consequential state/payment/room changes; preserve entered fields after errors.
- **Animation:** short 120–180ms surface/state transitions only; honor `prefers-reduced-motion`; no decorative animation on the administrative dashboard.
- **Typography System:** retain Nunito for Latin/numerals with Noto Sans TC for Traditional Chinese; prioritize readable time/room labels at desktop and 390px.
- **Brand Essence:** a careful, calm and trustworthy daily workspace for the LittleLand small-pet hotel team.
- **Brand Voice:** concise Cantonese Traditional Chinese labels; examples: “今日入住 2 隻・退房 1 隻” and “此預約未佔用房間，請於確認訂金時重新檢查房態。”
- **Wordmark & Logo:** use the exact user-supplied “Little Land” illustrated logo; do not redraw, recolor or invent a replacement mark.
- **Signature Brand Color:** existing LittleLand purple `#8c65d9`, balanced with the supplied warm taupe artwork.

## Approval gate and delivery boundary

The user approved the V3 implementation scope; the amendments below record the subsequent refund, pet-count, revenue and audit-attribution decisions. This code/mock pass changes no live TEST booking/payment data, Google Sheet structure or deployment. Any live TEST schema migration, API deployment, or real TEST write requires separate confirmation. Keep the current `feature/test-booking-api` branch and official repository `hklittleland/littleland-booking-system`; no push/merge to `develop` or `main`, and no Production connection. Final push to the approved feature branch follows user UX acceptance.


## Approval update — 2026-11-01

The user initially approved manual deposit refunds; the V3.1 request extends the inline manual refund form to a selected actually-paid accommodation payment (deposit or balance), including a cancelled booking with an eligible payment. Staff must enter the exact amount/reason and confirm the refund already occurred outside the system; enforce the unrefunded amount and log it. Never choose or execute a payment automatically. Cash-deposit refunds remain a separate flow. This does not change guest-facing non-refundable-deposit terms. The user further specified phone number as the sole Staff customer grouping/search key and explicitly declined guest-side form prefill. These decisions supersede the earlier draft wording above. The implementation is authorized only for `LittleLand_TEST`; no Production data or deployment is in scope.


# V3.1 Amendment — Booking Fees, Pet Count and 2026 Revenue (2026-11-01)

This amendment is based on the user's latest explicit requests and supersedes only the earlier V3 clauses that would prevent authorized booking-fee and pet-count edits. Keep the existing LittleLand TEST API, `LittleLand_TEST`, staff authentication, pricing catalogue, payment separation, and all Production/main-branch restrictions unchanged. Use the existing LittleLand V3 visual system; do not redesign the guest booking flow.

## Behaviour decisions

- **Manual partial refunds:** In Booking Detail, let staff choose an actually-paid accommodation payment, enter an exact partial refund amount and reason, review a confirmation, and confirm that the refund was completed outside the app before recording it. Enforce the unrefunded amount for the selected payment, append a `Payments` refund plus adjustment and audit Log, and use an idempotency key. Do not initiate a bank transfer or payment gateway call. Cash-deposit use/refund remains a separate ledger flow.
- **Booking adjustments:** Allow signed, reasoned additional-fee entries and reductions at any non-cancelled booking lifecycle stage, including after deposit, balance payment, check-in, checkout and completion. Support booking-level entries and per-pet entries, so staff can select exactly which pet(s) receive a service and enter a custom amount per selected pet. Preserve prior entries; a reduction/removal is a new linked negative adjustment, never a destructive delete. Recalculate the live amount due and show any overpayment/credit separately; never trigger an automatic refund.
- **Pet count:** Allow staff to add or remove same-species pets throughout a non-cancelled booking's lifecycle. Added pets require the existing full pet/health profile. Removed pets are soft-archived so their records remain auditable; `Bookings.quantity` represents active/staying pets. Enforce the accepted species/room limit and canonical validation. If the booking already occupies a physical room, adding pets must be checked against the current legal allocation/capacity under the server lock; if it cannot remain valid, reject the complete change without changing the booking or allocation. Never allocate a room to pending bookings through this path.
- **Pricing settlement:** Before a paid `DEPOSIT` payment exists, a quantity/fee change recalculates the canonical quote, all fee totals, required deposit (`baseRoomFee × 50%`), remaining balance and expected cash deposit. Once any deposit has actually been received, keep the collected deposit amount unchanged; recompute the remaining balance against the revised quote and all net accommodation receipts. If receipts exceed the revised total, show a credit/refund-due amount for staff review; never change the deposit or refund automatically. Cash deposit remains separate from accommodation totals; expected cash deposit follows active pet count × HK$1,000, and a collected cash amount is not silently returned.
- **Revenue:** Show a 2026 annual overview with all 12 months, annual totals and a selectable month detail. Booked accommodation is grouped by check-in month; collected money is grouped by payment date and shown net of recorded refunds, with deposits, balances, adjustments and refunds separated. Exclude cash deposits. Keep the existing TEST API as the data source; do not display mock values as operational revenue.

## Implementation and data-safety approach

- Extend authenticated `staff.edit`/a narrowly scoped booking-revision mutation in `apps-script/StaffOperations.gs` with current `recordVersion`, script-lock, idempotency, latest room validation, amount recalculation and Logs. Extend the refund mutation to the selected eligible paid accommodation payment while keeping exact amount/reason and explicit external-refund confirmation requirements.
- Use append-only `BookingAdjustments` entries with source/group and optional `petId`/pet-name snapshot fields. Extend `Pets` additively with active/removed state and removal audit fields. Update the TEST initializer using a non-destructive, recognized old-header-to-new-header migration that only appends known columns; preserve every existing row. Do not execute the initializer or change Google Sheets during code-only implementation.
- Update the Booking Detail UI to replace prompt-only flows with inline, touch-friendly amount/reason/pet selectors and clear confirmation/error states. Update `staff/revenue-chart.js` and the revenue route so annual 2026 totals are visible and a selected month shows its own summary and breakdown. Keep keyboard accessibility, existing responsive styles and no horizontal overflow at 390px.
- Add deterministic Node mock tests for pre-/post-deposit repricing, partial refunds and cumulative refund limits, signed/per-pet fee entries, pet soft-removal/addition and capacity checks, idempotency/version conflicts, and annual/monthly revenue rendering. Live API deployment, Sheets migration/data writes, actual refunds, or Production operations are not part of this implementation pass.


## Audit attribution addendum — Staff identity in change history

Booking Detail's change Logs and follow-up history must visibly identify the responsible Staff member, not only timestamp/action. New staff-generated Logs will retain `actorStaffId` and an immutable `actorStaffNameSnapshot` captured at operation time; Staff API reads will resolve legacy rows with blank snapshot from the Staff directory by ID and fall back to the ID if no match exists. Render the resolved name in both the operation log and follow-up history. Add the snapshot field through a recognized additive TEST schema migration; preserve existing Logs rows and never store credentials or session tokens.


## V3.1 TEST 增補：排班名冊與列印核對單

- 排班採用 Staff login 之外的獨立 `ScheduleEmployees` 名冊；Settings 設定 2–3 個顯示名稱，第三欄預填「Yip」、可更改或留空。每日月曆仍只指派一位當值者，整月批次儲存及既有日期/員工驗證保持不變。名冊寫入必須登入、記錄 actor、idempotency，且 schema migration 僅新增 TEST tab，不碰 Production 或 Staff 密碼/Session。
- Booking Detail 的列印/PDF 預覽只取當前已載入的單筆 TEST booking。列印頁顯示八字短編號、客人/緊急聯絡、入住資料、每隻寵物、健康/飲食、收費和付款狀態；禁止顯示完整內部 ID、內部分配房號、其他訂單或 Staff 憑證。保留瀏覽器列印/另存 PDF，不建立付款動作。
- 費用列有正數才顯示；列出房費、有效附加費、額外服務與人工更正，梳毛/餵藥按 `petId`/snapshot 對應寵物，找不到連結即標示未指定。現金備用金/按金獨立呈現、不計入住宿總額。Staff 手動費用更改可按每隻寵物選取；每隻金額不同時逐隻保存。
- 照顧／用藥表使用原表淡彩可愛視覺作參考，逐寵物與每 10 個住宿日分頁，自動帶入家長、電話、兩位緊急聯絡人、寵物/健康/飲食/用藥及實際住宿日期。倉鼠顯示長擺糧，不顯示餵食次數/假期提醒。保留用戶原始來源檔案不修改；只將《入住須知及寄養條款.pdf》原頁逐頁原樣附入，藥物表不再把舊空白原頁當輸出。
- 本輪限於 LittleLand_TEST 程式與虛構 mock 測試，不連 Production；未做實際 TEST Sheet/API 寫入或 Web App 新版部署。


## V3.1 TEST 實際執行記錄（2026-11-01 18:12 HKT）
使用者後續明確選擇繼續 TEST-only，並要求原始入住條款頁維持原樣。依此授權，LittleLand_TEST 以 add-only 方式新增 `ScheduleEmployees` tab，沒有清除或改寫既有預約資料；既有 TEST Apps Script Web App 更新至 V11，deployment ID／`/exec` URL 和權限保持不變。V11 只做一筆無客人資料的 availability GET smoke test（HTTP 200、available），沒有建立預約或付款。Production 未連接或修改。程式碼與文件留在 `feature/test-booking-api`，沒有合併 main。


## V3.1.1 增補：每隻寵物費用入口與五款 WhatsApp 草稿
- Booking Detail 的每隻有效寵物卡內加入專屬 fee form，自動以該寵物 ID 呼叫既有 `staff.surchargeAdd`（`petIds:[id]`）；常用項目按已確認單價與入住晚數預填，員工可更改金額、加減方向及原因；通用費用表單降級為進階共用／批次用途。既有 API append-only、idempotency、recordVersion、Logs 不變。
- 以使用者最新逐字提供的五款 WhatsApp 草稿取代舊版自創訊息。五張卡固定呈現，只有狀態/訂金/房態/日期條件符合才啟用；不符合時顯示原因。只取代 `{...}` 欄位，不自動傳送，不引入未提供的第六款訊息。未知付款連結或早退退款額保持可編輯欄位；未填完整不可複製／開啟。
- `staff/whatsapp-messages.js` 負責模板正文、條件與草稿按鈕，`booking-changes-view.js` 負責 per-pet controls，`app.js` 組合 TEST booking payload 和 mutation，`styles.css` 提供 mobile-first 狀態色；Node automated tests 對五款完整正文逐字比對，並覆蓋 eligibility matrix 和單隻 pet IDs。
- 本輪維持既有 LittleLand_TEST V11；新增內容全為 Staff 前端/renderer/tests，不寫 Production、客人資料、付款或實際 WhatsApp，不部署 Google Apps Script、不 merge main。


## 排班月曆自動跳月修正（TEST-only）
- 根因是 `app.js` 以 `[data-schedule-month]` 綁定導航 click handler；月曆保存表單也有 `data-schedule-month="11"`。點擊表單內日期下拉時，click 冒泡至 form，月份號碼被當作導航位移，因此跳月且令當前編輯月份錯位。
- 將月份導航改為獨立 `button[data-schedule-month-nav]`，並明確 `type="button"`；保存表單繼續使用 `data-schedule-month` 表示所選月份。日期下拉只改該月份 draft，不觸發導航；同月批次保存成功留在原月，失敗保留 draft。
- 僅改 Staff 前端和 regression test，不改 Apps Script/API、Google Sheets 或任何現存排班資料；TEST-only，不連 Production、不 merge main。


# TASK-EXTENSION-01 — Staff 延長住宿 + 預訂清單分頁（TEST only）

狀態：使用者已明確授權 EXT 正式規格；正在實作及 TEST 驗收。停止新增測試訂單，先完成 Staff 延期功能，再處理預訂清單分頁。

## 範圍與既有界線

- 延長住宿是修改既有 Booking 的退房日期，不建立新預約。停止後續客人網站建單；不刪除已建立的虛構 TEST booking。全程只接現有 Apps Script TEST API 和 `LittleLand_TEST`，不連 Production、不合併 `main`，不建立第二個 source-of-truth repository。
- 官方程式碼仍是 `hklittleland/littleland-booking-system` 的 `feature/test-booking-api`；本地 HEAD 與該 GitHub branch 目前一致，實作只回推同一 repository/branch。若更新公開 Staff TEST UI，只更新既有 Pages TEST branch `feature/booking-ui`，保留 Staff Login 及 TEST API endpoint。
- 保留現有 LittleLand Staff 視覺、路由、Staff session、付款帳本、Room Calendar 和已確認業務規則；不重新設計後台、不改房價或房態 status 規則。

## 實作方式與重要規則

### A. 延長住宿日期

- 新增受 Staff session 保護的 Apps Script action（建議 `staff.extendStay`），並在現有 `LockService.getScriptLock()` mutation lock 範圍內處理，以避免並行更改。請求須帶 `bookingId`、`expectedRecordVersion`、`expectedStatus`、`idempotencyKey` 及新的 `checkoutDate`；重送同一 key/內容只回放已完成結果，不重複改帳。
- 只可把退房日延後：新日期必須是有效 ISO 日期並嚴格晚於現有退房日；不可縮短住宿、改入住日或改原退房時間。只允許 `CONFIRMED`、`CHECKED_IN`；`PENDING_CONFIRMATION`、`PENDING_DEPOSIT`、`CANCELLED`、`CHECKED_OUT`、`COMPLETED` 不可延長。
- 延長時於同一 Script Lock 重新讀取 TEST inventory，驗證原 `allocatedRoomIdsJson` 是有效、合法的實體房組合。若員工選擇保留原房，排除本 Booking 後重新檢查更新後的全段日期；如原房衝突，拒絕此安排、不改 Booking／Payments，並讓員工改選 EXT。若選 EXT，只核對原實體房至首次延期邊界，延期區間不佔任何實體房；退房日仍是排他日期。
- EXT 不會把待確認申請變成已確認或保房；其範圍只包含已確認／入住中的延期 Booking，待付訂金與待確認流程維持原狀、不受本延期功能修改。
- 以現有 `LittleLandPricing.calculatePricing()` 重算整段住宿的 `nights`、基本房費、額外寵物費、週末費、現有每晚服務費、附加費總額、總額、訂金及尾數；不可複製或改寫 Pricing Engine。週末規則保持原訂規則。現金備用金／按金維持 `qty × HK$1,000`，獨立於住宿總額。
- 未有已實收訂金時，更新預計訂金為新基本房費 50%，並重算尾數。已有有效 `DEPOSIT` 實收紀錄時，保留既有 `depositAmount` 與全部 Payments ledger，不自動收款／退款；只以調整後總額、既有付款/退款及人工附加費共用結算 helper 更新未收尾數與付款狀態。若 depositStatus 與 Payments 不一致，fail closed 並要求人工核對。
- 成功後更新 `updatedAt`／`recordVersion`、清除房態快取，寫入含 Staff 姓名 snapshot 的 Logs，記錄原/新退房日、晚數及金額欄位，不記錄多餘個人資料。回應提供最新 Booking detail。

### B. Staff Booking Detail 操作

- 在 Booking Detail 增加「延長住宿」卡片，只對已確認／入住中的 Booking 顯示。員工輸入新退房日，選擇保留原房或轉入 EXT；先用相同 Pricing Engine 顯示新晚數、基本房費、附加費、住宿總額、訂金、尾數及現金按金。保留原房時後端鎖內重查完整住宿區間房態，若衝突，拒絕保留原房並讓員工選 EXT；轉入 EXT 則釋出首次原退房日之後的實體庫存。
- 提交前顯示新舊日期與主要金額差異供員工確認；提交中停用按鈕，採現有 `expectedRecordVersion`、idempotency 和錯誤呈現模式；成功後強制重新載入 detail。不要建立 Payments 付款列或執行真正收款/退款。

### C. 完成延住功能後再加預訂清單分頁

- 保留現有 Booking 搜尋、狀態、房型、入住日和退房日篩選。先篩選再排序與 server-side 分頁；預設每頁 20 張，顯示結果總數及上一頁/下一頁，篩選條件改動後回到第 1 頁，避免空白頁與重複 card handler。
- 預設不按最新建立時間排序；採入住日期升序，同日按建立時間由舊至新，再以 Booking ID 穩定排序。保留現有搜尋及篩選，server-side 分頁每頁 20 筆；條件改動回第 1 頁，卡片仍可打開完整 Booking Detail。只擴充 Staff API 的讀取參數，不改 Google Sheets schema。

## 專案結構與相依

- `apps-script/StaffOperations.gs`：登入後 mutation dispatch、鎖定、版本/idempotency、防衝突、重算、Logs。
- `apps-script/RoomAvailability.gs`、`PricingEngine.gs`、`BookingValidation.gs`：只重用既有房態、Pricing Engine 與表單價格 mapping；不建立第二套規則。
- `staff/api-client.js`、`staff/app.js`、`staff/booking-changes-view.js`、`staff/styles.css`：TEST action、detail 延住 UI 及其 mobile layout；預訂清單分頁與日期排序在同一 Staff 清單 view。
- `tests/apps-script/staff-api.test.js` 及對應 Staff UI tests：以現有 mock runtime 驗證延住成功、非法日期/狀態、房間衝突原子拒絕、版本/idempotency、付款前後重算，及分頁／排序/篩選互動；不在自動測試中寫真實 Sheets。
- `TODO.md`：方案批准後才新增這個 task 的完整接受條件及進度。

## TEST 驗證與交付路徑

目前本地基線為 `pnpm test`：244 pass / 0 fail。無需再建 booking；全棧測試只更新既有虛構 TEST booking `TEST-LL-20261031-C9F6561F`：目前為 `CONFIRMED`、兔子豪華房、入住 `2026-11-03`、退房 `2026-11-05`、1 隻、實體配置 A1；已有 HK$178 訂金 Payment、兩晚每日梳毛、單次梳毛、提早入住及有效人工減項 HK$70。將退房延長至 `2026-11-07` 並轉 EXT；預期基本房費 HK$712、服務費 HK$470、計價總額 HK$1,182、扣除既有人工減項後住宿總額 HK$1,112、已收款維持 HK$178、待收尾數 HK$934、現金按金 HK$1,000。不得新增 booking/payment 或覆寫既有資料；執行前重新唯讀核對，如候選記錄與上述基準不符即停止 live mutation。

先完成新增自動測試，再確認 Apps Script 現有 TEST Web App 可由已授權方式安全更新；只發布新 TEST API 版本及既有 Staff TEST Pages branch，絕不更新 Production。最後執行完整 `pnpm test`，確認 TEST 預約回讀、操作 Logs/Staff 姓名、延住後金額、無錯誤房間分配及分頁排序，再只推送既有 GitHub Source of Truth branch／TEST Pages branch；不 Merge `develop` 或 `main`。

## 設計／品牌

沿用現有 LittleLand Staff 介面，不另起視覺系統。設計方向是溫和而高辨識度的營運儀表板：白色圓角卡片承載表單；紫色按鈕表示可執行操作；紅色表示房間衝突/需跟進；綠色表示已付款/成功；淡黃提示用於日期與付款規則。延住日期與即時費用預覽置於 Booking Detail 明確卡片，手機單欄、觸控目標足夠大，確認/錯誤訊息保留在同一操作上下文；提交時只做輕量 loading，不造成頁面跳動。維持現有 Nunito／Noto Sans TC、LittleLand 標誌與品牌色，不改客人預約 UI。品牌定位：為 LittleLand 兩位員工清楚而安心管理每一張小動物入住預約；個性清晰、可靠、溫柔。


## 延長住宿設計修訂 — EXT 延期虛擬房（本節優先，取代此前相衝突的延住房態描述）

### 架構與資料邊界

本功能只修改 TEST Staff 後台、TEST Apps Script API 及 `LittleLand_TEST`；不改客人預約 UI、Production、Production Sheets 或正式部署。收費房型 `roomTypeId` 永遠代表客人購買的房型，決定定價、收費及營收分類；內部安排另存，兩者不可互相覆寫。採用 Bookings 的內部欄位 `internalAssignment`、`extensionStartDate`、`internalAssignmentNote`，並以 `lastExtensionFromDate`、`lastExtensionAddedNights`、`lastExtensionAddedBaseRoomFee` 顯示最近一次延期增量；費用帳本 `BookingAdjustments` 只在需要記錄自訂按晚服務時追加 `billingBasis`、`unitRate`、`nightsCharged`。以既有 TEST initializer 的已知欄位追加遷移方式加入新欄位；不刪表、不重排/覆寫既有資料。EXT 不建立 Rooms row、不新增客人房型、不加容量、不回傳到客人 Availability 或客人 API。

`internalAssignment` 的 `EXT` 表示延期部分不分配任何實體房；`ORIGINAL_ROOM` 表示延期仍使用 `allocatedRoomIdsJson` 中原本實體房。原始 Booking 保持單一記錄及原 `roomTypeId`，`extensionStartDate` 記錄首次延期前原退房日，日期區間入住日含、退房日不含。當安排為 EXT，實體房態只將原房計至 `extensionStartDate`，EXT 區間為 `[extensionStartDate, checkoutDate)`，不佔 A1–A3、S1–S3 等任何實體房，不影響其他客人的 Availability。保留原房時，後端在整個新住宿區間內用鎖定/最新 TEST 房態重新驗證；遇衝突拒絕該方式並讓員工改選 EXT。移出 EXT 回到原房前也必須重新驗證；衝突時維持 EXT。免費升級等臨場實際房間可寫入員工內部備註，例如「因原房型滿房，部分延期日免費升級 S1」；不建立逐日搬房/住宿分段、不更改原收費房型、不因此提高價格。

### 後端操作、費用及付款

Booking Detail 的「延長住宿」操作收新退房日、安排選擇（保留原房或轉入 EXT）、原因/內部備註；服務端驗證有效 ISO 日期、晚數增加、可延長狀態、recordVersion、員工 session、idempotency，並在 ScriptLock 下用最新資料重新檢查房態、重算與落盤。延住、EXT 進入、EXT 移出均寫 Logs，需包含 Staff 身分與時間、前後退房日、前後安排、變更原因/內部備註；員工可單獨修改內部備註並寫 Log。Booking Detail 顯示原訂房型、收費房型、目前安排（EXT 時顯示「EXT 延期客／實際房間由員工安排」）、首次延期前退房日、最近一次延期前退房日、本次新退房日、本次新增晚數及基本房費、累計延期晚數及延期基本房費、最新住宿總額、已實收款項、待收尾數、現金按金與可編輯內部備註。

延長日期後以原 `roomTypeId`／原每晚房價呼叫正式 `PricingEngine` 重算整張住宿；`estimatedTotal`、各項附加費與住宿基本房費均不得按 EXT 收費。所有會隨晚數增加的標準服務（額外寵物費、每日梳毛、每日餵藥及每日其他週期服務）按新晚數計算；一次性服務只收一次，不因延住複收。新的自訂按晚服務必須儲存 `billingBasis=PER_NIGHT` 與單價，延住時以不可覆寫帳本的沖回舊行＋追加新額度方式更新；有明確 `ONCE`/無舊版計費基準的既有人工項目視為一次性並保持原額。個別毛孩服務仍逐隻記錄。延長後若仍未實收訂金，按新基本房費重算訂金（只取新基本房費 50%）、總額及尾數；如已有任何已收款，原 Payment 記錄與已收訂金金額不變，尾數為新住宿總額加有效人工調整減去所有實際淨收住宿款，退款仍由既有 Payment/REFUND 帳本計算，絕不新增/覆寫付款。延期不改現金按金，維持 HK$1,000 × 寵物數量。原房型 ID 不變，營收仍歸原房型，絕不產生 EXT 房型營收。

### Staff 月曆與後續預訂列表

房間月曆保留全部十個實體房的矩陣；EXT 延期區是獨立內部區域，每日可以顯示不限數量的多張延期 Booking，沒有 Full/容量狀態。每張顯示寵物名稱、原/收費房型及延期至日期。EXT 日期不得被實體房矩陣當作原房佔用。Booking 的普通入住/退房提醒仍按實際完整入住區間顯示；客人前端、營收及房型選擇不得見到 EXT。

在 EXT 完成後再處理已授權的預訂列表分頁：用 server-side 分頁以避免一次載入全部 Booking，預設每頁 20 筆；依入住日期由近至遠（`checkinDate` 升序）排序，同日按 `createdAt` 舊至新，再以 `bookingId` 穩定排序，絕不以最新建立/輸入訂單置頂；翻頁需保留現有搜尋及篩選。

### TEST 驗收資料選擇

只用 LittleLand_TEST 中已存在的一張已確認兔子「豪華房」Booking；不新增訂單、不建立付款、不改任何既有付款紀錄。預期測試將原退房日期延長兩晚並轉入 EXT：維持原 `roomTypeId=DELUXE_ROOM` 及 `allocatedRoomIdsJson`；新增兩晚基本房費 HK$356；每日梳毛從兩晚費用 HK$100 重算至四晚 HK$200；既有單次梳毛 HK$70 和提早入住 HK$200 不複收；基本房費由 HK$356 至 HK$712，標準服務費 HK$370 至 HK$470，`estimatedTotal` HK$1,182。既有人工一次性減項 HK$70 保持有效，調整後住宿總額 HK$1,112；保留已收訂金及原 Payment HK$178，不增造付款，更新待收尾數為 HK$934；現金按金保持 HK$1,000。`extensionStartDate` 等於延期前退房日，EXT 日期不佔實體房；Staff 月曆以多筆同日 fixtures 證明可並列顯示，營收仍屬豪華房。實際候選若唯讀回讀發現與上述基準不同，先按 Sheet 實際資料重新計算並驗證，不強行覆寫預期或改用其他訂單；若遇資料不一致即停止該 TEST mutation。


# TASK-ROOM-LOCK-01 — Staff 實體房鎖定（TEST-only）

## 已核准的業務行為

- Staff 可為單一實體房建立指定日期區間的鎖房，區間使用入住日含、退房日不含；須選擇有效實體房、有效日期及填寫原因。虛擬組合 SS1／SSR1 和 EXT 不可鎖定。
- 只有有效的 ACTIVE 鎖房阻止該實體房在區間內被客人房態查詢、員工可用性查詢、建單檢查或確認訂金時的實體房分配。客人端只收到安全的可訂／不可訂結果，不回傳鎖房 ID、原因或 Staff 資料。
- 建立鎖房時如與同一實體房的 CONFIRMED／CHECKED_IN 實際佔房區間重疊，整筆建立拒絕且不改 Booking 或付款；如與另一 ACTIVE 鎖房重疊，亦拒絕。EXT Booking 只在其首次延期邊界前佔實體房，鎖房衝突按此物理佔用區間計算。
- PENDING_CONFIRMATION／PENDING_DEPOSIT 不佔房；鎖房不刪除、不取消、不改寫這些 Booking。若鎖房導致該待處理 Booking 所屬房型在其日期內沒有可用實體配置，後台以房態衝突提示員工跟進；付款確認仍須重新檢查最新庫存。
- Staff 可解除 ACTIVE 鎖房；以 RELEASED 軟狀態保存歷史，不刪除資料。建立及解除都需有效 Staff Session、Script Lock、idempotency、防版本衝突和 Staff／時間／操作內容 Logs；完成操作後刷新房態快取。

## 實作方式與專案結構

- 在 `apps-script/InitializeTestSheets.gs` 以 add-only 方式新增 `StaffRoomLocks` 工作表定義，不變更既有 Bookings／Payments／Logs 列；資料欄包括 `roomLockId`、`roomId`、`startDate`、`endDate`、`reason`、`status`、建立及解除時間、操作者 ID／姓名 snapshot、`releaseReason`、`recordVersion`、`idempotencyKey`。
- `apps-script/RoomAvailability.gs` 將有效鎖房納入唯一 inventory／availability allocator，校驗房間必須為 Rooms 主檔中的 PHYSICAL、日期有效且半開區間一致；所有客人與 Staff 房態及 `confirmDeposit`／延住原房檢查重用此資料源，不建立第二套房態邏輯。
- `apps-script/StaffRoomLocks.gs` 提供受登入保護的 Staff 建立／解除 API，在 Dispatcher 已有 Script Lock 內做衝突預檢、idempotency claim、軟解除與 actor-attributed Logs。`staff.calendar` 僅向 Staff 回傳所選月份內的有效鎖房；待處理 Booking 仍保持原狀並按實際剩餘配置計算衝突提示。
- `staff/api-client.js` 登記兩個 TEST-only action；`staff/calendar-view.js` 在十間實體房月曆格以獨立鎖定色／文字呈現 `[startDate,endDate)`，並顯示有效鎖房與解除操作；`staff/app.js` 在既有日曆加入手機友善的房間／日期／原因表單及解除確認，使用現有 `submitApi`、防重複及刷新模式；樣式延用 LittleLand Staff 現有卡片、按鈕、顏色、字體與手機版布局。
- 更新 `docs/SHEETS-SCHEMA.md`、initializer mock tests、RoomAvailability／Staff API／calendar view／app UI 測試。只可用本地 mock 與 LittleLand_TEST 驗證；不得建新 Booking／Payment，不觸及 Production，不 Merge `develop`／`main`。程式只推送至 `hklittleland/littleland-booking-system` 已指定的 `feature/test-booking-api`；若需讓既有 Staff TEST Pages 預覽包含 UI，再只同步 Staff 前端至 `feature/booking-ui`，保留登入及 TEST API endpoint。
