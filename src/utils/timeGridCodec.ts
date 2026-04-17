// Encode/decode a weekly availability grid into a 336-bit UTC vector.
//
// Bit layout:
//   336 bits = 7 UTC days × 48 UTC half-hour slots
//   bit index = utcDayIndex * 48 + utcSlotIndex   (utcDayIndex 0 = Monday, 6 = Sunday)
//   packed into 42 bytes, MSB-first within each byte (bit 0 of byte 0 = 0x80)
//   wire format: base64url without padding (42 bytes → 56 chars)
//
// The grid represents a recurring weekly schedule. To map local ↔ UTC we anchor
// to the Monday of the current local week — cross-DST weeks are approximate,
// matching the Discord `<t:…:t>` approach already used in apply.astro.

export const TOTAL_BITS = 7 * 48;
export const ENCODED_LENGTH = 56;

export type DaySlotKey = `${number}-${number}`;

function mondayOfCurrentLocalWeek(): Date {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow, 0, 0, 0, 0);
  return monday;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad === 2) b64 += "==";
  else if (pad === 3) b64 += "=";
  else if (pad === 1) throw new Error("Invalid base64url length");
  if (!/^[A-Za-z0-9+/]*=*$/.test(b64)) throw new Error("Invalid base64url characters");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeSelection(localSelected: Set<string>): string {
  const bytes = new Uint8Array(42);
  const monday = mondayOfCurrentLocalWeek();
  for (const key of localSelected) {
    const [dStr, sStr] = key.split("-");
    const d = Number(dStr);
    const s = Number(sStr);
    if (!Number.isInteger(d) || !Number.isInteger(s)) continue;
    if (d < 0 || d > 6 || s < 0 || s > 47) continue;
    const m = new Date(monday);
    m.setDate(m.getDate() + d);
    m.setMinutes(m.getMinutes() + s * 30);
    const utcDow = (m.getUTCDay() + 6) % 7;
    const utcSlot = m.getUTCHours() * 2 + (m.getUTCMinutes() >= 30 ? 1 : 0);
    const bit = utcDow * 48 + utcSlot;
    bytes[bit >> 3] |= 0x80 >> (bit & 7);
  }
  return bytesToBase64Url(bytes);
}

export function decodeEncoded(encoded: string): Set<string> {
  if (typeof encoded !== "string" || encoded.length === 0) {
    throw new Error("Empty encoded value");
  }
  const bytes = base64UrlToBytes(encoded);
  if (bytes.length !== 42) throw new Error(`Expected 42 bytes, got ${bytes.length}`);

  const out = new Set<string>();
  const nowUtc = new Date();
  const utcDowNow = (nowUtc.getUTCDay() + 6) % 7;
  const mondayUtc = new Date(Date.UTC(
    nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(),
    nowUtc.getUTCDate() - utcDowNow, 0, 0, 0, 0,
  ));

  for (let bit = 0; bit < TOTAL_BITS; bit++) {
    const on = (bytes[bit >> 3] & (0x80 >> (bit & 7))) !== 0;
    if (!on) continue;
    const utcDow = Math.floor(bit / 48);
    const utcSlot = bit % 48;
    const u = new Date(mondayUtc);
    u.setUTCDate(u.getUTCDate() + utcDow);
    u.setUTCMinutes(u.getUTCMinutes() + utcSlot * 30);

    const localDow = (u.getDay() + 6) % 7;
    const localSlot = u.getHours() * 2 + (u.getMinutes() >= 30 ? 1 : 0);
    out.add(`${localDow}-${localSlot}`);
  }
  return out;
}
