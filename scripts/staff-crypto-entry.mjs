import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

const ITERATIONS = 120_000;
const DERIVED_KEY_LENGTH = 32;

function utf8Bytes(value) {
  const text = String(value);
  const bytes = [];
  for (let i = 0; i < text.length; i += 1) {
    let point = text.charCodeAt(i);
    if (point >= 0xd800 && point <= 0xdbff) {
      const low = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (low >= 0xdc00 && low <= 0xdfff) {
        point = 0x10000 + ((point - 0xd800) << 10) + (low - 0xdc00);
        i += 1;
      } else {
        point = 0xfffd;
      }
    } else if (point >= 0xdc00 && point <= 0xdfff) {
      point = 0xfffd;
    }

    if (point <= 0x7f) {
      bytes.push(point);
    } else if (point <= 0x7ff) {
      bytes.push(0xc0 | (point >> 6), 0x80 | (point & 0x3f));
    } else if (point <= 0xffff) {
      bytes.push(
        0xe0 | (point >> 12),
        0x80 | ((point >> 6) & 0x3f),
        0x80 | (point & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (point >> 18),
        0x80 | ((point >> 12) & 0x3f),
        0x80 | ((point >> 6) & 0x3f),
        0x80 | (point & 0x3f),
      );
    }
  }
  return Uint8Array.from(bytes);
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function staffPasswordHash(password, saltBytes) {
  const salt =
    saltBytes instanceof Uint8Array
      ? saltBytes
      : Uint8Array.from(Array.from(saltBytes || [], (byte) => Number(byte) & 0xff));
  if (salt.length < 8) throw new Error("PBKDF2 salt must be at least 8 bytes.");
  const derived = pbkdf2(
    sha256,
    utf8Bytes(password),
    salt,
    { c: ITERATIONS, dkLen: DERIVED_KEY_LENGTH },
  );
  return toHex(derived);
}
