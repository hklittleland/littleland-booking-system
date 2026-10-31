# LittleLand TEST Apps Script Web App Deployment

**Environment:** TEST only
**Apps Script project:** `LittleLand TEST Booking API`
**Deployment:** Version 6 (updated 2026-10-31; existing TEST Web App deployment, same URL)
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

Only `CONFIRMED` and `CHECKED_IN` bookings occupy physical rooms. `PENDING_CONFIRMATION` and `PENDING_DEPOSIT` do not occupy rooms and must have `allocatedRoomIdsJson=[]`. New guest applications check current availability but do not reserve or receive physical room IDs. The deposit-confirmation transition locks and rechecks current inventory, allocates a legal physical room, and changes to `CONFIRMED` only if the room remains available. If no room remains, it retains the pending booking for staff follow-up; it does not auto-cancel it. The Staff confirmation transaction is implemented in TEST v6, but its live conflict E2E remains unverified; see the status below.

## TEST Sheets snapshot — 2026-10-31

The TEST-only stress run created ten synthetic guest applications using API Version 2. The Sheets API was used to read the final records back; the following counts are non-empty records:

- `Bookings`: 11 (one pre-existing synthetic TEST booking plus 10 new stress bookings).
- `Pets`: 24 (one pre-existing synthetic TEST pet plus 23 pets across the new bookings).
- `Payments`: 0; no payment record or payment service was used.
- `Logs`: 13 (two pre-existing records, 10 new `CREATE_BOOKING` logs, one sanitized quote-rejection log).
- `IdempotencyKeys`: 12 (one pre-existing record, 10 completed new booking keys, one failed quote-mismatch key).
- All 11 pending bookings have `allocatedRoomIdsJson=[]`; none occupies rooms. There are zero active physical allocations and zero overlapping active allocations in the final TEST data.
- The earlier provisional `A1` allocation on the pre-existing pending TEST booking was cleared under the corrected rule; the change is recorded by `TEST_RULE_MIGRATION` in `Logs`.
- No Production data was read or changed. Logs were scanned for the synthetic contact and pet fields used in the run; no PII matches were found.

Detailed booking IDs, dates, prices, overlap and idempotency findings are in [the TASK-009 TEST stress report](TEST-BOOKING-STRESS-20261031.md).

## Verification

- Before the writes, read-only Availability preflight checked all ten proposed test date/species/room combinations; all returned `available=true`.
- Ten live API `POST`s completed successfully as `PENDING_CONFIRMATION`. A same-key duplicate replay returned the original Booking ID without duplicate rows. A deliberate HK$1 client-quote mismatch returned `PRICE_CLIENT_MISMATCH`, wrote no booking or pet, and produced one sanitized `REJECT_BOOKING` log; replaying that failed key did not create a second log.
- During a parallel two-request test, the competing request initially returned retryable `LOCK_TIMEOUT` before claiming its idempotency key; it produced no Sheets side effect. Retrying the exact same payload/key succeeded; both overlapping pending applications exist with empty allocations. This is not an occupancy conflict. Staff confirmation API is now deployed in TEST v6, but the new last-room paid-deposit conflict flow has not passed live E2E because the synthetic login response resets at the client transport.
- Full automated suite command:

  ```sh
  node --test tests/apps-script/*.test.js tests/pricing.test.js tests/booking-api-client.test.js
  ```

  Result: **72 passed, 0 failed**. B–F physical-room composition and half-open interval cases use mocked `CONFIRMED` fixtures; no fake confirmed bookings were written to Google Sheets.

## Public endpoint warning

Anonymous callers can reach this endpoint and its `POST` action can write synthetic TEST records. Keep the TEST-only Script Property binding and never use the endpoint with real guest details or Production data.

## Staff Auth and TEST E2E status — 2026-10-31

- The existing TEST Web App deployment was updated to Version 6; deployment ID/URL, execute-as owner, and anyone-access settings remain unchanged.
- Root cause was the GAS HMAC overload: the previous implementation mixed a `Byte[]` value with a `String` key/charset. The source now UTF-8 encodes the password and uses the documented `Byte[]`/`Byte[]` overload while retaining 120,000 PBKDF2 rounds. [Google Apps Script Utilities reference](https://developers.google.com/apps-script/reference/utilities/utilities)
- One synthetic TEST Admin login/logout probe succeeded on v6. Later Node `fetch`, `curl`, and manual-redirect login probes failed at the client transport. A final Sheets read-back found six Session rows for the synthetic Admin account; all six are revoked or expired, with zero active sessions. The latest one-shot E2E attempt added one late Session row after `fetch failed`; only that exact TEST row was revoked and read back.
- The live two-hamster-box conflict E2E is **not passed**. No new Booking, Payment, or Idempotency row was created by these Staff attempts. Latest TEST read-back remains 11 Bookings, 24 Pets, 0 Payments, 13 Logs, and 12 IdempotencyKeys; the Booking rows predate the Staff E2E.
- The Staff API client now does not automatically retry `staff.login` after a fetch exception or malformed JSON response, preventing an uncertain login request from automatically creating a second Session; regression tests cover both cases. Other idempotent staff mutations retain a same-payload retry.
- Local verification: `node --test tests/apps-script/*.test.js tests/*.test.js` — **108 passed, 0 failed**. A 390px Playwright UI check used a local mocked API, verified all eight navigation pages and no horizontal overflow, and did not write TEST Sheets.
- Do not treat Staff V1 as accepted until a reliable live TEST login/response path completes the two-hamster flow and Google Sheets read-back confirms both the allocated room and the paid-but-unconfirmed conflict handling.
