# LittleLand TEST Apps Script Web App Deployment

**Environment:** TEST only
**Apps Script project:** `LittleLand TEST Booking API`
**Deployment:** Version 8 (updated 2026-10-31; existing TEST Web App deployment, same URL)
**Deployment ID:** `AKfycby6ecJFVBzQHAwGXS9VZlMLOQ3q3DbZh12Ssjg5nxUBGn1S61Sq_MGzZpmIgNm5EQ_i`

## API URL

[LittleLand TEST Apps Script API](https://script.google.com/macros/s/AKfycby6ecJFVBzQHAwGXS9VZlMLOQ3q3DbZh12Ssjg5nxUBGn1S61Sq_MGzZpmIgNm5EQ_i/exec)

## Deployment and data boundary

- Deployment type: Web App.
- Execute as: project owner (`hklittleland@gmail.com`).
- Access: Anyone; anonymous callers can reach the endpoint for the guest booking UI.
- Script Property `LITTLELAND_TEST_SPREADSHEET_ID` is bound to `LittleLand_TEST`; the spreadsheet ID is intentionally not copied into this repository. Read-only verification confirmed the property target's title and all eight expected tabs.
- The Apps Script authorization uses Google Sheets scope `https://www.googleapis.com/auth/spreadsheets`. Application code uses a TEST allow-list and exact `LittleLand_TEST` title checks; it rejects caller-supplied spreadsheet IDs. Never point the property at Production.
- This URL is publicly callable. `POST` creates TEST booking records. Use synthetic TEST data only; do not submit real customer data or use this endpoint for Production.

## Corrected room-status rule

Only `CONFIRMED` and `CHECKED_IN` bookings occupy physical rooms. `PENDING_CONFIRMATION` and `PENDING_DEPOSIT` do not occupy rooms and must have `allocatedRoomIdsJson=[]`. New guest applications check current availability but do not reserve or receive physical room IDs. The deposit-confirmation transition locks and rechecks current inventory, allocates a legal physical room, and changes to `CONFIRMED` only if the room remains available. If no room remains, it retains the pending booking for staff follow-up; it does not auto-cancel it. This transaction and the Staff-side Sheets date normalization fix are deployed in TEST Version 8; the earlier v7 blocker and resolved final run are detailed below.

### Live E2E progress — 2026-10-31 20:32 HKT

The live TEST flow reused `TEST-LL-20261031-9CECA2C7` and created the second synthetic booking `TEST-LL-20261031-1B66EC7B`. Both are one-hamster `HAMSTER_BOX` applications for 2026-11-15 → 2026-11-16. `staff.confirmData` moved both to `PENDING_DEPOSIT` (`recordVersion=2`), with `allocatedRoomIdsJson=[]`. The first `staff.confirmDeposit` call returned `DATE_CHECKOUT_NOT_AFTER_CHECKIN` before a Payment or room allocation was written. TEST Sheets read-back showed no Payment rows, no confirmed allocation, and only the expected create/confirm-data logs; the API runner logged out.

The detail API round-trips a Google Sheets date as an ISO UTC timestamp (`2026-11-14T16:00:00.000Z` for the 2026-11-15 Hong Kong check-in, and `2026-11-15T16:00:00.000Z` for checkout). Staff confirmation passed that raw timestamp to `littlelandAvailability_`, whose contract accepts date-only `YYYY-MM-DD`, causing the error. This is a Staff/sheet-boundary normalization bug; the Guest API's strict date-only input contract must remain unchanged.

## TEST Sheets snapshot before Staff conflict E2E — 2026-10-31

The earlier TEST-only stress run created ten synthetic guest applications using API Version 2. The Sheets API was used to read the final records back; at that snapshot the non-empty counts were:

- `Bookings`: 11 (one pre-existing synthetic TEST booking plus 10 new stress bookings).
- `Pets`: 24 (one pre-existing synthetic TEST pet plus 23 pets across the new bookings).
- `Payments`: 0; no payment record or payment service was used in that stress run.
- `Logs`: 13 (two pre-existing records, 10 new `CREATE_BOOKING` logs, one sanitized quote-rejection log).
- `IdempotencyKeys`: 12 (one pre-existing record, 10 completed new booking keys, one failed quote-mismatch key).
- All 11 pending bookings had `allocatedRoomIdsJson=[]`; none occupied rooms. There were zero active physical allocations and zero overlapping active allocations in that snapshot.
- The earlier provisional `A1` allocation on the pre-existing pending TEST booking was cleared under the corrected rule; the change is recorded by `TEST_RULE_MIGRATION` in `Logs`.
- No Production data was read or changed. Logs were scanned for the synthetic contact and pet fields used in the run; no PII matches were found.

Detailed booking IDs, dates, prices, overlap and idempotency findings are in [the TASK-009 TEST stress report](TEST-BOOKING-STRESS-20261031.md).

## Earlier API and pricing verification

- Before the stress-run writes, read-only Availability preflight checked all ten proposed test date/species/room combinations; all returned `available=true`.
- Ten live API `POST`s completed successfully as `PENDING_CONFIRMATION`. A same-key duplicate replay returned the original Booking ID without duplicate rows. A deliberate HK$1 client-quote mismatch returned `PRICE_CLIENT_MISMATCH`, wrote no booking or pet, and produced one sanitized `REJECT_BOOKING` log; replaying that failed key did not create a second log.
- During the earlier parallel two-request create test, the competing request initially returned retryable `LOCK_TIMEOUT` before claiming its idempotency key; it produced no Sheets side effect. Retrying the exact same payload/key succeeded; both overlapping pending applications exist with empty allocations. This is not an occupancy conflict.
- Full guest/API test suite at the stress-run snapshot:

  ```sh
  node --test tests/apps-script/*.test.js tests/pricing.test.js tests/booking-api-client.test.js
  ```

  Result: **72 passed, 0 failed**. B–F physical-room composition and half-open interval cases used mocked `CONFIRMED` fixtures; no fake confirmed bookings were written to Google Sheets.

## Version 6 login issue history

The initial Staff login implementation used a GAS HMAC overload with mismatched value/key types. The code was corrected to UTF-8 password bytes and the documented `Byte[]`/`Byte[]` overload, retaining 120,000 PBKDF2 rounds. Version 7 subsequently replaced per-round GAS `Utilities` HMAC calls with the bundled `@noble/hashes` PBKDF2 implementation while retaining 120,000 rounds. See the [Google Apps Script Utilities reference](https://developers.google.com/apps-script/reference/utilities/utilities).

Earlier temporary one-shot login helpers returned `fetch failed`, and six prior synthetic sessions were found revoked/expired. The temporary `/tmp/run_littleland_staff_e2e.js` file was not present after resuming this task, so its exact failure line could not be inspected; no single historical transport cause is claimed.

## Version 7 Staff verification — 2026-10-31

- The existing TEST deployment was updated to Version 7, retaining the original deployment ID and URL, execute-as owner and anyone-access settings. Production was not accessed.
- Staff access is flat: two active synthetic TEST accounts (`test_admin` and `test_admin_2`) both have complete ADMIN access; role tiers and per-operation password re-authentication are removed. `isActive=false` invalidates that Staff account's sessions. The password hash uses PBKDF2-HMAC-SHA256 with 120,000 rounds and the locally bundled Noble implementation. Plaintext passwords are kept outside the repository and are not in the frontend or GitHub.
- Direct Node `fetch` login/logout succeeded for `test_admin`; direct login, protected `staff.settings` (ADMIN response), and logout succeeded for `test_admin_2`. Responses followed the normal `script.google.com` → `script.googleusercontent.com` redirect and ended with HTTP 200 JSON. No automatic login retry was used.
- Live Playwright check from `/staff/` at **390×844** used the real TEST API and passed all eight sections: Dashboard, room calendar, bookings, follow-ups, payments, customers, basic revenue, and settings/logout. Each section had `scrollWidth=390` and `clientWidth=390`; API actions were login, dashboard, calendar, bookings, followups, payments, customers, revenue, settings, logout. No failed TEST API requests or page errors were observed.
- The first browser smoke harness waited for the local login screen but closed before the asynchronous logout request had finished. A TEST Sheets read-back found that one exact smoke-test session was still active. Only that TEST row's `revokedAt` cell was then updated, and the following metadata read-back verified **9 Session rows, 0 active sessions**. A later direct `test_admin_2` logout also returned success; active sessions were checked again before starting the room-conflict E2E.
- The equivalent Node and browser API calls no longer reproduce the old `fetch failed`; the normal redirect chain succeeds. The precise cause of the earlier missing temporary helper's failure remains unproven.
- Latest local mock suite before the live room-conflict E2E: `node --test tests/apps-script/*.test.js tests/*.test.js` — **109 passed, 0 failed**. This includes PBKDF2 vectors, flat ADMIN access, disabled-account session rejection and no login auto-retry regressions.

## Earlier paid-deposit room-conflict E2E status — before v8; resolved below

**Pending at this checkpoint; do not treat Staff V1 as accepted yet.** The live E2E will use only synthetic TEST bookings and must be verified by re-reading `LittleLand_TEST` Sheets. Expected outcome: two same-date `HAMSTER_BOX` applications may both remain pending; after the first deposit confirmation, exactly `C1` is allocated to the first booking and it becomes `CONFIRMED`; the second payment is still recorded, but the second booking remains `PENDING_DEPOSIT`, keeps `allocatedRoomIdsJson=[]`, is not auto-cancelled and is flagged for staff follow-up. TEST Sheet counts and row details will be updated here after the E2E completes.


## Final TEST v8 deposit-conflict E2E — PASS — 2026-10-31 20:47 HKT

This final result supersedes the earlier “pending” checkpoint above. It used only two existing synthetic LittleLand_TEST bookings; the final runner created no additional booking. No Production spreadsheet or API was accessed.

- Both bookings were one hamster in `HAMSTER_BOX`, check-in 2026-11-15 and check-out 2026-11-16. Before the deposit test, both were `PENDING_DEPOSIT`, `recordVersion=2`, unpaid and unallocated. `C1` was active, and the TEST sheet contained no confirmed/check-in allocation overlapping those dates.
- `TEST-LL-20261031-9CECA2C7`: base room fee HK$65, extra-pet fee HK$0, Sunday one-night weekend fee HK$250, service fees HK$80, total surcharges HK$330, estimated total HK$395, deposit HK$32.50, remaining balance HK$362.50, cash deposit HK$1,000. The recorded HK$32.50 deposit changed it to `CONFIRMED` and allocated exactly `C1`.
- `TEST-LL-20261031-1B66EC7B`: base room fee HK$65, extra-pet fee HK$0, Sunday one-night weekend fee HK$250, service fees HK$0, total surcharges HK$250, estimated total HK$315, deposit HK$32.50, remaining balance HK$282.50, cash deposit HK$1,000. The recorded HK$32.50 deposit did **not** confirm or allocate a room: it remained `PENDING_DEPOSIT`, `allocatedRoomIdsJson=[]`, `depositStatus=PAID`, and `followUpRequired=TRUE`.
- The second booking's conflict was returned by the API and surfaced through Staff booking detail, Dashboard `roomConflicts`, and Follow-ups. The operation was not retried with a different payload. Both unique v8 deposit idempotency keys are `COMPLETED`, each points to its matching Booking ID, and no duplicate Booking was created.
- Google Sheets read-back verified both `Payments` rows (`DEPOSIT`, HK$32.50, `PAID`), one `Pets` row per booking, both `staff.confirmDeposit` Logs, the two completed Idempotency rows, and current room allocations. For the overlapping interval, the only active booking is the first booking using `C1`; the pending conflict booking has no allocation. The TEST `Sessions` sheet contained 13 rows and 0 active sessions after logout.
- The earlier `fetch failed` symptom was not reproduced: the v8 login followed the usual Apps Script redirect and returned HTTP 200; logout also returned HTTP 200. Its historical root cause remains unproven. The prior v7 date blocker was `DATE_CHECKOUT_NOT_AFTER_CHECKIN` when a Sheet timestamp was passed to a strict date-only room validator. Version 8 normalizes Sheet Date/ISO values at the Staff inventory boundary while leaving Guest API date validation strict.
- Latest full local automated suite: `node --test tests/apps-script/*.test.js tests/*.test.js` — **111 passed, 0 failed**. The existing live 390×844 Playwright smoke covered all eight Staff navigation sections and no horizontal overflow; Version 8 changes only backend date normalization, not the Staff UI.
