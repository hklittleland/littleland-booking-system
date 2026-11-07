/** TEST-only staff authentication. Sessions persist token hashes only. */
var LITTLELAND_STAFF_SESSION_HOURS = 8;
var LITTLELAND_STAFF_PBKDF2_ROUNDS = 120000;
function littlelandStaffHash_(value) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8,
  )
    .map(function (b) {
      return ("0" + ((b + 256) % 256).toString(16)).slice(-2);
    })
    .join("");
}
function littlelandStaffPasswordHash_(password, saltB64, hashState) {
  if (hashState) hashState.phase = "SALT_DECODE";
  var salt = Utilities.base64Decode(String(saltB64));
  if (hashState) hashState.phase = "PBKDF2";
  var result = LittleLandStaffCrypto.staffPasswordHash(String(password), salt);
  if (hashState) hashState.phase = "HASH_FORMAT";
  return result;
}
function littlelandStaffConstantTimeEqual_(a, b) {
  a = String(a || "");
  b = String(b || "");
  var diff = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i += 1)
    diff |=
      (a.charCodeAt(i % (a.length || 1)) || 0) ^
      (b.charCodeAt(i % (b.length || 1)) || 0);
  return diff === 0;
}
function littlelandStaffRate_(username, failed) {
  var cache = CacheService.getScriptCache(),
    key =
      "staff-login:" +
      littlelandStaffHash_(String(username || "").toLowerCase());
  var n = Number(cache.get(key) || 0);
  if (!failed && n >= 5)
    throw littlelandApiError_(
      "STAFF_LOGIN_RATE_LIMIT",
      "登入嘗試過多，請稍後再試。",
      true,
    );
  if (failed) cache.put(key, String(n + 1), 900);
}
function littlelandStaffResetRate_(username) {
  CacheService.getScriptCache().remove(
    "staff-login:" + littlelandStaffHash_(String(username || "").toLowerCase()),
  );
}
function littlelandStaffLogin_(body, requestId) {
  var stage = "RATE_LIMIT",
    hashState = {};
  try {
    var username = String(body.username || "")
      .trim()
      .toLowerCase();
    littlelandStaffRate_(username, false);
    stage = "STAFF_READ";
    var rows = littlelandReadTable_("Staff").rows;
    var found = rows.filter(function (r) {
      return String(r.record.username || "").toLowerCase() === username;
    });
    var record = found.length === 1 ? found[0].record : null;
    var dummySalt = "aW52YWxpZC1hY2NvdW50LXNhbHQ=";
    stage = "PASSWORD_HASH";
    var candidate = record
      ? littlelandStaffPasswordHash_(
          String(body.password || ""),
          record.passwordSalt,
          hashState,
        )
      : littlelandStaffPasswordHash_(String(body.password || ""), dummySalt, hashState);
    if (
      !record ||
      !littlelandStaffIsActive_(record.isActive) ||
      !littlelandStaffConstantTimeEqual_(candidate, record.passwordHash)
    ) {
      stage = "RATE_LIMIT_FAILURE";
      littlelandStaffRate_(username, true);
      throw littlelandApiError_(
        "STAFF_AUTH_INVALID",
        "登入資料不正確或帳戶未啟用。",
        false,
      );
    }
    var token = Utilities.getUuid() + Utilities.getUuid(),
      now = new Date(),
      expires = new Date(
        now.getTime() + LITTLELAND_STAFF_SESSION_HOURS * 3600000,
      );
    var sessionId = Utilities.getUuid();
    stage = "SESSION_APPEND";
    littlelandAppendRecord_("Sessions", {
      sessionId: sessionId,
      staffId: record.staffId,
      tokenHash: littlelandStaffHash_(token),
      roleSnapshot: "ADMIN",
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      revokedAt: "",
      lastSeenAt: now.toISOString(),
    });
    stage = "STAFF_UPDATE";
    littlelandUpdateRecordByKey_("Staff", "staffId", record.staffId, {
      lastLoginAt: now.toISOString(),
    });
    stage = "RATE_LIMIT_RESET";
    littlelandStaffResetRate_(username);
    return {
      token: token,
      staff: {
        staffId: record.staffId,
        displayName: record.displayName,
        role: "ADMIN",
      },
      expiresAt: expires.toISOString(),
    };
  } catch (error) {
    if (error && error.name === "LittleLandApiError") throw error;
    var stageCodes = {
      RATE_LIMIT: "STAFF_LOGIN_RATE_LIMITER_FAILED",
      STAFF_READ: "STAFF_LOGIN_DATA_READ_FAILED",
      PASSWORD_HASH: "STAFF_LOGIN_PASSWORD_HASH_FAILED",
      RATE_LIMIT_FAILURE: "STAFF_LOGIN_RATE_LIMITER_FAILED",
      SESSION_APPEND: "STAFF_LOGIN_SESSION_WRITE_FAILED",
      STAFF_UPDATE: "STAFF_LOGIN_ACCOUNT_UPDATE_FAILED",
      RATE_LIMIT_RESET: "STAFF_LOGIN_RATE_LIMITER_FAILED",
    };
    var code = stageCodes[stage] || "STAFF_LOGIN_INTERNAL_FAILED";
    if (stage === "PASSWORD_HASH" && hashState.phase) {
      var hashPhaseCodes = {
        SALT_DECODE: "STAFF_LOGIN_SALT_DECODE_FAILED",
        PBKDF2: "STAFF_LOGIN_PASSWORD_KDF_FAILED",
        HASH_FORMAT: "STAFF_LOGIN_PASSWORD_HASH_FORMAT_FAILED",
      };
      code = hashPhaseCodes[hashState.phase] || code;
    }
    throw littlelandApiError_(
      code,
      "員工登入暫時無法完成，請稍後再試。",
      true,
    );
  }
}
function littlelandStaffIsActive_(value) {
  return value === true || String(value).toLowerCase() === "true";
}
function littlelandStaffAuthenticate_(token) {
  if (!token)
    throw littlelandApiError_(
      "STAFF_AUTH_REQUIRED",
      "請先登入員工後台。",
      false,
    );
  var hash = littlelandStaffHash_(token),
    matches = littlelandReadTable_("Sessions").rows.filter(function (r) {
      return String(r.record.tokenHash) === hash;
    });
  if (matches.length !== 1)
    throw littlelandApiError_(
      "STAFF_AUTH_INVALID",
      "登入工作階段無效。",
      false,
    );
  var session = matches[0].record;
  var expiry = session.expiresAt ? new Date(session.expiresAt).getTime() : NaN;
  if (session.revokedAt || !isFinite(expiry) || expiry <= Date.now())
    throw littlelandApiError_(
      "STAFF_AUTH_INVALID",
      "登入工作階段已過期或已登出。",
      false,
    );
  var staff = littlelandReadTable_("Staff").rows.filter(function (r) {
    return String(r.record.staffId) === String(session.staffId);
  });
  if (staff.length !== 1 || !littlelandStaffIsActive_(staff[0].record.isActive))
    throw littlelandApiError_("STAFF_AUTH_INVALID", "員工帳戶未啟用。", false);
  return { staff: staff[0].record, session: session, role: "ADMIN" };
}
function littlelandStaffLogout_(auth) {
  littlelandUpdateRecordByKey_(
    "Sessions",
    "sessionId",
    auth.session.sessionId,
    { revokedAt: littlelandNowIso_() },
  );
  return { loggedOut: true };
}
